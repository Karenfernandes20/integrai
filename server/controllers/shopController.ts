
import { Response } from 'express';
import { pool } from '../db';
import { RequestWithInstance } from '../middleware/validateCompanyAndInstance';
import { logEvent } from '../logger';

type GoalMetric = 'revenue' | 'sales_count' | 'product' | 'new_clients' | 'category' | 'avg_ticket';
type GoalScope = 'company' | 'seller' | 'channel';

let goalSchemaReady = false;

const VALID_SALE_STATUSES = ['completed', 'confirmed', 'paid'];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

const normalizeDateRange = (startDate?: string, endDate?: string) => {
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const ensureGoalSchema = async () => {
    if (!pool || goalSchemaReady) return;

    await pool.query(`
        ALTER TABLE goals
        ADD COLUMN IF NOT EXISTS name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS goal_metric VARCHAR(30) DEFAULT 'revenue',
        ADD COLUMN IF NOT EXISTS target_scope VARCHAR(20) DEFAULT 'company',
        ADD COLUMN IF NOT EXISTS channel VARCHAR(50),
        ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS category VARCHAR(100),
        ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(6,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS ticket_target DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS goal_progress (
            id SERIAL PRIMARY KEY,
            goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
            current_value DECIMAL(14,2) DEFAULT 0,
            percentage DECIMAL(8,2) DEFAULT 0,
            last_updated TIMESTAMP DEFAULT NOW(),
            UNIQUE(goal_id)
        )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_goals_scope_metric_period ON goals(company_id, instance_id, target_scope, goal_metric, start_date, end_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_goals_user_channel ON goals(user_id, channel)`);
    goalSchemaReady = true;
};

const computeGoalCurrentValue = async (
    goal: any,
    companyId: number,
    instanceId: number,
    rangeStart: Date,
    rangeEnd: Date
) => {
    if (!pool) return 0;

    const params: any[] = [companyId, instanceId, rangeStart.toISOString(), rangeEnd.toISOString(), VALID_SALE_STATUSES];
    const filters: string[] = [
        `s.company_id = $1`,
        `s.instance_id = $2`,
        `s.created_at BETWEEN $3 AND $4`,
        `s.status = ANY($5)`
    ];
    let idx = 6;

    if (goal.user_id) {
        filters.push(`s.user_id = $${idx++}`);
        params.push(goal.user_id);
    }
    if (goal.channel) {
        filters.push(`s.channel = $${idx++}`);
        params.push(goal.channel);
    }

    const whereClause = filters.join(' AND ');
    const metric: GoalMetric = goal.goal_metric || 'revenue';

    if (metric === 'revenue') {
        const r = await pool.query(`SELECT COALESCE(SUM(s.final_amount), 0) AS v FROM sales s WHERE ${whereClause}`, params);
        return Number(r.rows[0]?.v || 0);
    }

    if (metric === 'sales_count') {
        const r = await pool.query(`SELECT COUNT(*)::int AS v FROM sales s WHERE ${whereClause}`, params);
        return Number(r.rows[0]?.v || 0);
    }

    if (metric === 'avg_ticket') {
        const r = await pool.query(`
            SELECT
                COALESCE(SUM(s.final_amount), 0) AS revenue,
                COUNT(*)::int AS sales_count
            FROM sales s
            WHERE ${whereClause}
        `, params);
        const revenue = Number(r.rows[0]?.revenue || 0);
        const salesCount = Number(r.rows[0]?.sales_count || 0);
        return salesCount > 0 ? revenue / salesCount : 0;
    }

    if (metric === 'product' && goal.product_id) {
        params.push(goal.product_id);
        const productParam = idx++;
        const r = await pool.query(`
            SELECT COALESCE(SUM(si.quantity), 0) AS v
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            WHERE ${whereClause} AND si.inventory_id = $${productParam}
        `, params);
        return Number(r.rows[0]?.v || 0);
    }

    if (metric === 'category' && goal.category) {
        params.push(goal.category);
        const catParam = idx++;
        const r = await pool.query(`
            SELECT COALESCE(SUM(si.total_price), 0) AS v
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN inventory i ON i.id = si.inventory_id
            WHERE ${whereClause} AND i.category = $${catParam}
        `, params);
        return Number(r.rows[0]?.v || 0);
    }

    if (metric === 'new_clients') {
        const r = await pool.query(`
            SELECT COUNT(DISTINCT s.client_id)::int AS v
            FROM sales s
            WHERE ${whereClause} AND s.client_id IS NOT NULL
        `, params);
        return Number(r.rows[0]?.v || 0);
    }

    return 0;
};

const upsertGoalProgress = async (goalId: number, currentValue: number, targetValue: number) => {
    if (!pool) return;
    const percentage = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
    await pool.query(`
        INSERT INTO goal_progress (goal_id, current_value, percentage, last_updated)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (goal_id)
        DO UPDATE SET
            current_value = EXCLUDED.current_value,
            percentage = EXCLUDED.percentage,
            last_updated = NOW()
    `, [goalId, currentValue, percentage]);
};

const refreshGoalsForWindow = async (companyId: number, instanceId: number, rangeStart: Date, rangeEnd: Date) => {
    if (!pool) return;
    await ensureGoalSchema();

    const goalsRes = await pool.query(`
        SELECT *
        FROM goals
        WHERE company_id = $1
          AND instance_id = $2
          AND COALESCE(status, 'active') IN ('active', 'paused', 'completed')
          AND (start_date IS NULL OR end_date IS NULL OR daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]'))
    `, [companyId, instanceId, toDateOnly(rangeStart), toDateOnly(rangeEnd)]);

    for (const g of goalsRes.rows) {
        const goalStart = g.start_date ? new Date(g.start_date) : rangeStart;
        const goalEnd = g.end_date ? new Date(g.end_date) : rangeEnd;
        const current = await computeGoalCurrentValue(g, companyId, instanceId, goalStart, goalEnd);
        await upsertGoalProgress(g.id, current, Number(g.target_value || 0));
    }
};

export const getShopDashboard = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const { startDate, endDate } = req.query;

        // Default to today if no date provided
        const start = startDate ? new Date(String(startDate)) : new Date();
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(String(endDate)) : new Date();
        end.setHours(23, 59, 59, 999);

        // 1. Sales Today (or period)
        const salesRes = await pool!.query(`
            SELECT 
                COUNT(*) as count, 
                COALESCE(SUM(final_amount), 0) as total_revenue
            FROM sales 
            WHERE company_id = $1 AND instance_id = $2 
            AND created_at BETWEEN $3 AND $4
            AND status = 'completed'
        `, [company_id, instance_id, start, end]);

        const salesCount = parseInt(salesRes.rows[0].count);
        const revenue = parseFloat(salesRes.rows[0].total_revenue);
        const avgTicket = salesCount > 0 ? revenue / salesCount : 0;

        // 2. Open Orders (Pending Sales)
        const pendingRes = await pool!.query(`
            SELECT COUNT(*) as count FROM sales 
            WHERE company_id = $1 AND instance_id = $2 AND status = 'pending'
        `, [company_id, instance_id]);

        // 3. Receivables Overdue (Notas em Atraso)
        const overdueRes = await pool!.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
            FROM receivables 
            WHERE company_id = $1 AND instance_id = $2 
            AND status = 'pending' AND due_date < NOW()::DATE
        `, [company_id, instance_id]);

        // 4. Critical Stock
        const stockRes = await pool!.query(`
            SELECT COUNT(*) as count FROM inventory 
            WHERE company_id = $1 AND instance_id = $2 
            AND quantity <= min_quantity AND status = 'active'
        `, [company_id, instance_id]);

        // 5. Products Breakdown (Top 5)
        const topProducts = await pool!.query(`
            SELECT i.name, SUM(si.quantity) as qtd, SUM(si.total_price) as total
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN inventory i ON i.id = si.inventory_id
            WHERE s.company_id = $1 AND s.instance_id = $2
            AND s.created_at BETWEEN $3 AND $4
            GROUP BY i.name
            ORDER BY total DESC
            LIMIT 5
        `, [company_id, instance_id, start, end]);

        // 6. Payment Methods Breakdown
        const paymentsBreakdown = await pool!.query(`
            SELECT payment_method, COUNT(*) as count, SUM(final_amount) as total
            FROM sales
            WHERE company_id = $1 AND instance_id = $2
             AND created_at BETWEEN $3 AND $4
            GROUP BY payment_method
        `, [company_id, instance_id, start, end]);

        res.json({
            summary: {
                sales_count: salesCount,
                revenue,
                avg_ticket: avgTicket,
                pending_orders: parseInt(pendingRes.rows[0].count),
                overdue_receivables_count: parseInt(overdueRes.rows[0].count),
                overdue_receivables_value: parseFloat(overdueRes.rows[0].total),
                critical_stock: parseInt(stockRes.rows[0].count)
            },
            charts: {
                top_products: topProducts.rows,
                payment_methods: paymentsBreakdown.rows
            }
        });

    } catch (error) {
        console.error('Error fetching shop dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
};

// --- SALES ---

export const getSales = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const { limit = 20, offset = 0 } = req.query;

        const result = await pool!.query(`
            SELECT s.*, c.name as client_name, u.full_name as seller_name 
            FROM sales s
            LEFT JOIN crm_leads c ON s.client_id = c.id
            LEFT JOIN app_users u ON s.user_id = u.id
            WHERE s.company_id = $1 AND s.instance_id = $2
            ORDER BY s.created_at DESC
            LIMIT $3 OFFSET $4
        `, [company_id, instance_id, limit, offset]);

        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createSale = async (req: RequestWithInstance, res: Response) => {
    let client: any;
    try {
        if (!pool) throw new Error('Database pool not found');
        client = await pool.connect();

        const { company_id, id: user_id } = req.user;
        const instance_id = req.instanceId as number;
        const { client_id: inputClientId, items, payment_method, discount, channel, status } = req.body;

        // Sanitize client_id
        const client_id = inputClientId && inputClientId !== '0' && inputClientId !== 0 ? inputClientId : null;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('Lista de itens inválida ou vazia');
        }

        await client.query('BEGIN');

        // 1. Calculate totals
        let total_amount = 0;
        const saleItems = [];

        for (const item of items) {
            const qty = Number(item.quantity);
            const price = Number(item.unit_price);

            if (qty <= 0) throw new Error(`Quantidade inválida para o item #${item.inventory_id}`);

            const subtotal = qty * price;
            total_amount += subtotal;
            saleItems.push({ ...item, quantity: qty, unit_price: price, total: subtotal });

            // Check stock
            const stockCheck = await client.query('SELECT id, quantity, name FROM inventory WHERE id = $1', [item.inventory_id]);
            if (stockCheck.rows.length === 0) throw new Error(`Produto #${item.inventory_id} não encontrado no estoque.`);

            const currentStock = Number(stockCheck.rows[0].quantity);
            if (currentStock < qty) {
                throw new Error(`Estoque insuficiente para ${stockCheck.rows[0].name}. Disponível: ${currentStock}, Solicitado: ${qty}`);
            }
        }

        const final_amount = total_amount - (Number(discount) || 0);

        // 2. Create Sale
        const saleRes = await client.query(`
            INSERT INTO sales (company_id, instance_id, client_id, user_id, total_amount, discount, final_amount, payment_method, channel, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [
            company_id,
            instance_id,
            client_id || null,
            user_id,
            total_amount,
            discount || 0,
            final_amount,
            payment_method,
            channel || 'loja_fisica',
            status || 'completed'
        ]);

        const saleId = saleRes.rows[0].id;

        // 3. Create Items & Update Stock
        for (const item of saleItems) {
            await client.query(`
                INSERT INTO sale_items (sale_id, inventory_id, quantity, unit_price, total_price)
                VALUES ($1, $2, $3, $4, $5)
            `, [saleId, item.inventory_id, item.quantity, item.unit_price, item.total]);

            // Update Inventory (Decrease)
            await client.query(`
                UPDATE inventory SET quantity = quantity - $1 WHERE id = $2
            `, [item.quantity, item.inventory_id]);

            // Log Movement
            await client.query(`
                INSERT INTO inventory_movements (company_id, instance_id, inventory_id, type, quantity, reason, user_id)
                VALUES ($1, $2, $3, 'out', $4, 'Venda #' || $5, $6)
            `, [company_id, instance_id, item.inventory_id, item.quantity, saleId, user_id]);
        }

        // 4. Generate Receivable if necessary (if not paid instantly)
        if ((status || 'completed') === 'completed') {
            await client.query(`
                INSERT INTO receivables (company_id, instance_id, sale_id, client_id, description, amount, due_date, paid_at, status, payment_method)
                VALUES ($1, $2, $3, $4, 'Venda #' || $7, $5, NOW(), NOW(), 'paid', $6)
             `, [company_id, instance_id, saleId, client_id || null, final_amount, payment_method, saleId]);

            // 5. Sync with Financial Module (Financeiro > Receitas)
            await client.query(`
                INSERT INTO financial_transactions (
                    description, 
                    type, 
                    amount, 
                    status, 
                    due_date, 
                    issue_date, 
                    paid_at, 
                    category, 
                    notes, 
                    company_id
                )
                VALUES (
                    'Venda Loja #' || $1, 
                    'receivable', 
                    $2, 
                    'paid', 
                    NOW(), 
                    NOW(), 
                    NOW(), 
                    'Vendas', 
                    'Venda realizada via Loja. Método: ' || $3, 
                    $4
                )
            `, [saleId, final_amount, payment_method, company_id]);
        }

        console.log('--- COMMITTING SALE ---');
        await client.query('COMMIT');

        // Recompute goal progress
        refreshGoalsForWindow(company_id as number, instance_id as number, new Date(), new Date()).catch((e) =>
            console.error('[SHOP][GOALS] Failed to refresh after createSale:', e)
        );
        res.status(201).json({ success: true, saleId });

    } catch (error: any) {
        if (client) await client.query('ROLLBACK');
        console.error('Create sale error details:', {
            error: error.message,
            stack: error.stack,
            body: req.body,
            user: req.user,
            instanceId: req.instanceId
        });
        res.status(500).json({ error: error.message || 'Erro interno ao processar venda' });

        // Log to system logs
        logEvent({
            eventType: 'system_error',
            origin: 'system',
            status: 'error',
            message: `Erro ao criar venda: ${error.message}`,
            companyId: req.user?.company_id,
            details: {
                stack: error.stack,
                body: req.body,
                user: req.user,
                instanceId: req.instanceId
            }
        });
    } finally {
        if (client) client.release();
    }
};

export const updateSaleStatus = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const { id } = req.params;
        const { status } = req.body;

        const allowed = ['pending', 'completed', 'cancelled', 'confirmed', 'paid'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const check = await pool!.query(
            'SELECT id, status, final_amount, client_id, payment_method FROM sales WHERE id = $1 AND company_id = $2 AND instance_id = $3',
            [id, company_id, instance_id]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }

        const oldStatus = check.rows[0].status;
        const updated = await pool!.query(
            `UPDATE sales
             SET status = $1, updated_at = NOW()
             WHERE id = $2 AND company_id = $3 AND instance_id = $4
             RETURNING *`,
            [status, id, company_id, instance_id]
        );

        // Sync receivable with status changes.
        if (status === 'cancelled') {
            await pool!.query(
                `UPDATE receivables SET status = 'cancelled', updated_at = NOW()
                 WHERE sale_id = $1 AND company_id = $2 AND instance_id = $3`,
                [id, company_id, instance_id]
            );
        } else if (['completed', 'confirmed', 'paid'].includes(status) && !['completed', 'confirmed', 'paid'].includes(oldStatus)) {
            const sale = updated.rows[0];
            await pool!.query(
                `INSERT INTO receivables (company_id, instance_id, sale_id, client_id, description, amount, due_date, paid_at, status, payment_method)
                 VALUES ($1, $2, $3, $4, 'Venda #' || $3, $5, NOW(), NOW(), 'paid', $6)
                 ON CONFLICT DO NOTHING`,
                [company_id, instance_id, id, sale.client_id, sale.final_amount, sale.payment_method]
            );
        }

        refreshGoalsForWindow(company_id, Number(instance_id), new Date(), new Date()).catch((e) =>
            console.error('[SHOP][GOALS] Failed to refresh after updateSaleStatus:', e)
        );

        return res.json(updated.rows[0]);
    } catch (error: any) {
        console.error('[SHOP] Error updating sale status:', error);
        return res.status(500).json({ error: error.message });
    }
};

// --- INVENTORY ---

// --- INVENTORY ---

export const getInventory = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const { search, limit = 100, offset = 0 } = req.query;

        let query = `SELECT i.*, s.name as supplier_name FROM inventory i LEFT JOIN suppliers s ON i.supplier_id = s.id WHERE i.company_id = $1 AND i.instance_id = $2 AND i.status != 'deleted'`;
        const params: any[] = [company_id, instance_id];

        if (search) {
            query += ` AND (i.name ILIKE $3 OR i.sku ILIKE $3 OR i.category ILIKE $3 OR i.barcode ILIKE $3)`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY i.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createInventoryItem = async (req: RequestWithInstance, res: Response) => {
    const client = await pool!.connect();
    try {
        await client.query('BEGIN');
        const { company_id, id: user_id } = req.user;
        const instance_id = req.instanceId;
        const {
            name,
            sku,
            category,
            cost_price,
            sale_price,
            quantity,
            min_quantity,
            supplier_id,
            barcode,
            description,
            unit,
            location,
            image_url,
            status,
            channels,
            batch_number,
            expiration_date
        } = req.body;

        // Auto-generate SKU if missing (simple timestamp based)
        const finalSku = sku || `SKU-${Date.now()}`;

        // Calculate margin
        const cost = Number(cost_price) || 0;
        const sale = Number(sale_price) || 0;
        const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

        const result = await client.query(`
            INSERT INTO inventory (
                company_id, instance_id, name, sku, barcode, category, description,
                cost_price, sale_price, margin, quantity, min_quantity, location, unit,
                supplier_id, image_url, status, batch_number, expiration_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `, [
            company_id, instance_id, name, finalSku, barcode, category, description,
            cost, sale, margin.toFixed(2), quantity || 0, min_quantity || 0,
            location, unit || 'un', supplier_id, image_url, status || 'active',
            batch_number, expiration_date
        ]);

        const newItem = result.rows[0];

        // Log initial movement if quantity > 0
        if (Number(quantity) > 0) {
            await client.query(`
                INSERT INTO inventory_movements (company_id, instance_id, inventory_id, type, quantity, reason, user_id)
                VALUES ($1, $2, $3, 'in', $4, 'Entrada Inicial (Cadastro)', $5)
            `, [company_id, instance_id, newItem.id, quantity, user_id]);
        }

        // Handle Channels (Mock logic for now as requested tables don't specify channel storage yet, usually many-to-many)
        // Ignoring specialized channel logic for now per schema constraint, but assumed enabled.

        await client.query('COMMIT');
        res.status(201).json(newItem);
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Create Product Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

export const updateInventoryItem = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const {
            name,
            sale_price,
            cost_price,
            quantity,
            min_quantity,
            category,
            sku,
            barcode,
            status,
            description,
            location,
            unit,
            supplier_id,
            channels,
            batch_number,
            expiration_date
        } = req.body;

        // Validate ID
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ error: 'ID do produto inválido' });
        }

        // Check if product exists
        const checkProduct = await pool!.query(
            'SELECT id FROM inventory WHERE id = $1 AND company_id = $2',
            [id, company_id]
        );

        if (checkProduct.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (sale_price !== undefined) {
            updates.push(`sale_price = $${paramCount++}`);
            values.push(Number(sale_price) || 0);
        }
        if (cost_price !== undefined) {
            updates.push(`cost_price = $${paramCount++}`);
            values.push(Number(cost_price) || 0);
        }
        if (quantity !== undefined) {
            updates.push(`quantity = $${paramCount++}`);
            values.push(Number(quantity) || 0);
        }
        if (min_quantity !== undefined) {
            updates.push(`min_quantity = $${paramCount++}`);
            values.push(Number(min_quantity) || 0);
        }
        if (category !== undefined) {
            updates.push(`category = $${paramCount++}`);
            values.push(category);
        }
        if (sku !== undefined) {
            updates.push(`sku = $${paramCount++}`);
            values.push(sku);
        }
        if (barcode !== undefined) {
            updates.push(`barcode = $${paramCount++}`);
            values.push(barcode);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(status);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description);
        }
        if (location !== undefined) {
            updates.push(`location = $${paramCount++}`);
            values.push(location);
        }
        if (unit !== undefined) {
            updates.push(`unit = $${paramCount++}`);
            values.push(unit);
        }
        if (supplier_id !== undefined) {
            updates.push(`supplier_id = $${paramCount++}`);
            values.push(supplier_id ? Number(supplier_id) : null);
        }
        if (channels !== undefined) {
            updates.push(`channels = $${paramCount++}`);
            values.push(JSON.stringify(channels));
        }
        if (batch_number !== undefined) {
            updates.push(`batch_number = $${paramCount++}`);
            values.push(batch_number);
        }
        if (expiration_date !== undefined) {
            updates.push(`expiration_date = $${paramCount++}`);
            values.push(expiration_date || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        // Add updated_at
        updates.push(`updated_at = NOW()`);

        // Add WHERE clause parameters
        values.push(id, company_id);

        const query = `
            UPDATE inventory 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount++} AND company_id = $${paramCount}
            RETURNING *
        `;

        const result = await pool!.query(query, values);

        console.log(`[SHOP] Product ${id} updated successfully by company ${company_id}`);
        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('[SHOP] Error updating inventory item:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto', details: error.message });
    }
};

// --- SUPPLIERS ---
export const getSuppliers = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const result = await pool!.query(`SELECT * FROM suppliers WHERE company_id = $1 AND instance_id = $2`, [company_id, instance_id]);
        res.json(result.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const createSupplier = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const { name, contact_name, phone, email, cnpj } = req.body;
        const result = await pool!.query(`
            INSERT INTO suppliers (company_id, instance_id, name, contact_name, phone, email, cnpj)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [company_id, instance_id, name, contact_name, phone, email, cnpj]);
        res.json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

// --- PAYMENTS & RECEIVABLES ---
export const getPayments = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const result = await pool!.query(`SELECT * FROM payments WHERE company_id = $1 AND instance_id = $2 ORDER BY due_date ASC`, [company_id, instance_id]);
        res.json(result.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getReceivables = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const result = await pool!.query(`SELECT * FROM receivables WHERE company_id = $1 AND instance_id = $2 ORDER BY due_date ASC`, [company_id, instance_id]);
        res.json(result.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

const getDateSeries = (start: Date, end: Date) => {
    const arr: string[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
        arr.push(toDateOnly(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return arr;
};

const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'red';
    if (percentage < 80) return 'yellow';
    if (percentage <= 100) return 'green';
    return 'purple';
};

export const getGoalsOverview = async (req: RequestWithInstance, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureGoalSchema();

        const { company_id } = req.user;
        const instance_id = req.instanceId as number;
        const { startDate, endDate } = req.query as any;
        const { start, end } = normalizeDateRange(startDate, endDate);

        await refreshGoalsForWindow(company_id, instance_id, start, end);

        const rangeStart = toDateOnly(start);
        const rangeEnd = toDateOnly(end);

        const goalsRes = await pool.query(`
            SELECT g.*, gp.current_value, gp.percentage, gp.last_updated
            FROM goals g
            LEFT JOIN goal_progress gp ON gp.goal_id = g.id
            WHERE g.company_id = $1
              AND g.instance_id = $2
              AND (
                    (g.start_date IS NULL OR g.end_date IS NULL)
                    OR daterange(g.start_date, g.end_date, '[]') && daterange($3::date, $4::date, '[]')
                  )
            ORDER BY g.created_at DESC
        `, [company_id, instance_id, rangeStart, rangeEnd]);
        const goals = goalsRes.rows;

        // Summary goal: active company-wide revenue goal in selected period.
        const summaryGoal =
            goals.find((g: any) => (g.target_scope || 'company') === 'company' && (g.goal_metric || 'revenue') === 'revenue' && (g.status || 'active') === 'active') ||
            goals.find((g: any) => (g.target_scope || 'company') === 'company' && (g.goal_metric || 'revenue') === 'revenue') ||
            null;

        const salesWindowRes = await pool.query(`
            SELECT
                COALESCE(SUM(s.final_amount), 0) AS revenue,
                COUNT(*)::int AS sales_count
            FROM sales s
            WHERE s.company_id = $1
              AND s.instance_id = $2
              AND s.created_at BETWEEN $3 AND $4
              AND s.status = ANY($5)
        `, [company_id, instance_id, start.toISOString(), end.toISOString(), VALID_SALE_STATUSES]);

        const sold = Number(salesWindowRes.rows[0]?.revenue || 0);
        const salesCount = Number(salesWindowRes.rows[0]?.sales_count || 0);
        const target = Number(summaryGoal?.target_value || 0);
        const percentage = target > 0 ? (sold / target) * 100 : 0;
        const missing = Math.max(0, target - sold);
        const today = new Date();
        const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
        const elapsedDays = clamp(Math.ceil((Math.min(today.getTime(), end.getTime()) - start.getTime()) / 86400000) + 1, 0, totalDays);
        const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
        const requiredDaily = remainingDays > 0 ? (missing / remainingDays) : missing;
        const expectedUntilToday = target > 0 ? (target / totalDays) * elapsedDays : 0;
        const paceDiff = expectedUntilToday > 0 ? ((sold - expectedUntilToday) / expectedUntilToday) * 100 : 0;

        let insight = '';
        if (target > 0 && sold < expectedUntilToday) {
            insight = 'Seu ritmo atual não é suficiente para bater a meta.';
        } else if (target > 0 && sold >= expectedUntilToday) {
            insight = `Você está ${Math.abs(paceDiff).toFixed(1)}% acima da meta esperada para hoje.`;
        }

        // Seller ranking and goal table
        const sellersRes = await pool.query(`
            SELECT
                u.id,
                u.full_name,
                COALESCE(SUM(s.final_amount), 0) AS sold
            FROM app_users u
            LEFT JOIN sales s
              ON s.user_id = u.id
             AND s.company_id = $1
             AND s.instance_id = $2
             AND s.created_at BETWEEN $3 AND $4
             AND s.status = ANY($5)
            WHERE u.company_id = $1
              AND u.is_active = true
            GROUP BY u.id, u.full_name
            ORDER BY sold DESC
        `, [company_id, instance_id, start.toISOString(), end.toISOString(), VALID_SALE_STATUSES]);

        const sellerGoals = goals.filter((g: any) => (g.target_scope || 'company') === 'seller' && (g.goal_metric || 'revenue') === 'revenue');
        const sellerMap = new Map<number, any>();
        sellersRes.rows.forEach((r: any, i: number) => {
            sellerMap.set(r.id, {
                seller_id: r.id,
                seller_name: r.full_name,
                sold: Number(r.sold || 0),
                ranking: i + 1,
                target: 0,
                percentage: 0,
                commission_estimate: 0,
                has_medal: false,
                badge: ''
            });
        });
        for (const g of sellerGoals) {
            if (!g.user_id) continue;
            const s = sellerMap.get(g.user_id);
            if (!s) continue;
            s.target += Number(g.target_value || 0);
            const base = s.target > 0 ? (s.sold / s.target) * 100 : 0;
            s.percentage = base;
            const commissionRate = Number(g.commission_rate || 0);
            s.commission_estimate += (s.sold * commissionRate) / 100;
        }
        const sellerRows = Array.from(sellerMap.values()).map((s: any) => {
            if (s.percentage >= 100) {
                s.has_medal = true;
                s.badge = 'Top Vendas';
            }
            return s;
        });

        // Channel goals
        const channelsBase = ['whatsapp', 'loja_fisica', 'instagram', 'marketplace', 'outros'];
        const salesByChannel = await pool.query(`
            SELECT
                COALESCE(NULLIF(TRIM(channel), ''), 'outros') AS channel,
                COALESCE(SUM(final_amount), 0) AS sold
            FROM sales
            WHERE company_id = $1
              AND instance_id = $2
              AND created_at BETWEEN $3 AND $4
              AND status = ANY($5)
            GROUP BY 1
        `, [company_id, instance_id, start.toISOString(), end.toISOString(), VALID_SALE_STATUSES]);

        const channelTargetMap = new Map<string, number>();
        goals
            .filter((g: any) => (g.target_scope || 'company') === 'channel' && (g.goal_metric || 'revenue') === 'revenue')
            .forEach((g: any) => {
                const ch = (g.channel || 'outros').toLowerCase();
                channelTargetMap.set(ch, Number(channelTargetMap.get(ch) || 0) + Number(g.target_value || 0));
            });

        const channelSoldMap = new Map<string, number>();
        salesByChannel.rows.forEach((r: any) => channelSoldMap.set((r.channel || 'outros').toLowerCase(), Number(r.sold || 0)));
        const allChannels = Array.from(new Set([...channelsBase, ...Array.from(channelTargetMap.keys()), ...Array.from(channelSoldMap.keys())]));
        const channelRows = allChannels.map((ch) => {
            const targetValue = Number(channelTargetMap.get(ch) || 0);
            const soldValue = Number(channelSoldMap.get(ch) || 0);
            const pct = targetValue > 0 ? (soldValue / targetValue) * 100 : 0;
            return { channel: ch, target: targetValue, sold: soldValue, percentage: pct };
        }).sort((a, b) => b.sold - a.sold);

        // Daily chart meta x realizado
        const dailySales = await pool.query(`
            SELECT DATE(created_at) AS day, COALESCE(SUM(final_amount), 0) AS sold
            FROM sales
            WHERE company_id = $1
              AND instance_id = $2
              AND created_at BETWEEN $3 AND $4
              AND status = ANY($5)
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        `, [company_id, instance_id, start.toISOString(), end.toISOString(), VALID_SALE_STATUSES]);
        const soldPerDay = new Map<string, number>();
        dailySales.rows.forEach((r: any) => soldPerDay.set(toDateOnly(new Date(r.day)), Number(r.sold || 0)));
        const dateSeries = getDateSeries(start, end);
        const dailyTarget = target > 0 ? target / totalDays : 0;
        let cumulativeSold = 0;
        let cumulativeTarget = 0;
        const lineChart = dateSeries.map((d) => {
            cumulativeSold += Number(soldPerDay.get(d) || 0);
            cumulativeTarget += dailyTarget;
            return {
                date: d,
                sold: Number(soldPerDay.get(d) || 0),
                target_daily: dailyTarget,
                sold_cumulative: cumulativeSold,
                target_cumulative: cumulativeTarget
            };
        });

        // Goal history and comparison
        const previousStart = new Date(start);
        const previousEnd = new Date(end);
        const diffMs = end.getTime() - start.getTime();
        previousEnd.setTime(start.getTime() - 1);
        previousStart.setTime(previousEnd.getTime() - diffMs);

        const prevRevenueRes = await pool.query(`
            SELECT COALESCE(SUM(final_amount), 0) AS revenue
            FROM sales
            WHERE company_id = $1 AND instance_id = $2
              AND created_at BETWEEN $3 AND $4
              AND status = ANY($5)
        `, [company_id, instance_id, previousStart.toISOString(), previousEnd.toISOString(), VALID_SALE_STATUSES]);
        const prevRevenue = Number(prevRevenueRes.rows[0]?.revenue || 0);
        const monthComparison = prevRevenue > 0 ? ((sold - prevRevenue) / prevRevenue) * 100 : 0;

        const historyRows = goals.map((g: any) => {
            const current = Number(g.current_value || 0);
            const targetValue = Number(g.target_value || 0);
            const pct = targetValue > 0 ? (current / targetValue) * 100 : 0;
            const reached = pct >= 100;
            return {
                id: g.id,
                name: g.name || `Meta #${g.id}`,
                metric: g.goal_metric || 'revenue',
                scope: g.target_scope || 'company',
                status: reached ? 'achieved' : ((g.status || 'active') === 'active' ? 'in_progress' : 'not_achieved'),
                percentage: pct,
                target: targetValue,
                current,
                start_date: g.start_date,
                end_date: g.end_date
            };
        });

        return res.json({
            summary: {
                target,
                sold,
                percentage,
                missing,
                days_remaining: remainingDays,
                required_daily: requiredDaily,
                ticket_average: salesCount > 0 ? sold / salesCount : 0,
                progress_color: getProgressColor(percentage)
            },
            intelligence: {
                expected_until_today: expectedUntilToday,
                pace_diff_percentage: paceDiff,
                insight
            },
            sellers: sellerRows,
            channels: channelRows,
            charts: {
                meta_vs_realized_daily: lineChart,
                seller_ranking: sellerRows.map((s: any) => ({ name: s.seller_name, sold: s.sold, percentage: s.percentage })),
                channel_breakdown: channelRows.map((c: any) => ({ channel: c.channel, sold: c.sold, target: c.target }))
            },
            history: {
                goals: historyRows,
                previous_period_revenue: prevRevenue,
                period_comparison_percentage: monthComparison
            },
            goals
        });
    } catch (error: any) {
        console.error('[SHOP][GOALS] Error loading overview:', error);
        return res.status(500).json({ error: error.message });
    }
};

export const createGoal = async (req: RequestWithInstance, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureGoalSchema();

        const { company_id } = req.user;
        const instance_id = req.instanceId as number;
        const {
            name,
            type,
            targetValue,
            startDate,
            endDate,
            sellerId,
            channel,
            status,
            recurring,
            recurrence,
            productId,
            category,
            commissionRate,
            scope
        } = req.body;

        if (!name || !type || !targetValue || !startDate || !endDate) {
            return res.status(400).json({ error: 'Campos obrigatórios: name, type, targetValue, startDate, endDate' });
        }

        const metric: GoalMetric = type;
        const targetScope: GoalScope = scope || (sellerId ? 'seller' : (channel ? 'channel' : 'company'));
        const normalizedChannel = channel ? String(channel).toLowerCase() : null;

        // Avoid duplicate goals for same entity/scope/period/metric
        const duplicate = await pool.query(`
            SELECT id
            FROM goals
            WHERE company_id = $1
              AND instance_id = $2
              AND goal_metric = $3
              AND COALESCE(target_scope, 'company') = $4
              AND COALESCE(user_id, 0) = COALESCE($5, 0)
              AND COALESCE(channel, '') = COALESCE($6, '')
              AND daterange(start_date, end_date, '[]') && daterange($7::date, $8::date, '[]')
              AND COALESCE(status, 'active') != 'cancelled'
            LIMIT 1
        `, [company_id, instance_id, metric, targetScope, sellerId || null, normalizedChannel, startDate, endDate]);
        if (duplicate.rows.length > 0) {
            return res.status(409).json({ error: 'Já existe uma meta para essa entidade no mesmo período.' });
        }

        const result = await pool.query(`
            INSERT INTO goals (
                company_id, instance_id, name, goal_metric, target_scope, target_value,
                start_date, end_date, user_id, channel, product_id, category,
                status, is_recurring, recurrence, commission_rate
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `, [
            company_id, instance_id, name, metric, targetScope, Number(targetValue),
            startDate, endDate, sellerId || null, normalizedChannel, productId || null, category || null,
            status || 'active', recurring === true, recurrence || 'none', Number(commissionRate || 0)
        ]);

        const created = result.rows[0];
        const current = await computeGoalCurrentValue(created, company_id, instance_id, new Date(startDate), new Date(endDate));
        await upsertGoalProgress(created.id, current, Number(created.target_value || 0));

        return res.status(201).json(created);
    } catch (error: any) {
        console.error('[SHOP][GOALS] createGoal error:', error);
        return res.status(500).json({ error: error.message });
    }
};

export const distributeRevenueGoalBySellers = async (req: RequestWithInstance, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureGoalSchema();

        const { company_id } = req.user;
        const instance_id = req.instanceId as number;
        const { totalTarget, startDate, endDate, namePrefix, commissionRate, distributions } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Campos obrigatórios: startDate, endDate' });
        }

        const createdGoals: any[] = [];

        // Manual Distribution Mode
        if (Array.isArray(distributions) && distributions.length > 0) {
            for (const dist of distributions) {
                if (!dist.sellerId || !dist.targetValue) continue;

                // Get seller name for goal name
                const sellerRes = await pool.query('SELECT full_name FROM app_users WHERE id = $1', [dist.sellerId]);
                const sellerName = sellerRes.rows[0]?.full_name || `Vendedor #${dist.sellerId}`;
                const goalName = `${namePrefix || 'Meta'} - ${sellerName}`;

                const row = await pool.query(`
                    INSERT INTO goals (
                        company_id, instance_id, name, goal_metric, target_scope, target_value,
                        start_date, end_date, user_id, status, is_recurring, recurrence, commission_rate
                    )
                    VALUES ($1, $2, $3, 'revenue', 'seller', $4, $5::date, $6::date, $7, 'active', false, 'none', $8)
                    RETURNING *
                `, [company_id, instance_id, goalName, Number(dist.targetValue), startDate, endDate, dist.sellerId, Number(commissionRate || 0)]);
                createdGoals.push(row.rows[0]);
            }
        }
        // Automatic Equal Split Mode
        else {
            if (!totalTarget) {
                return res.status(400).json({ error: 'Total target ou distributions obrigatório.' });
            }

            const sellersRes = await pool.query(`
                SELECT id, full_name
                FROM app_users
                WHERE company_id = $1 AND is_active = true
                ORDER BY full_name ASC
            `, [company_id]);

            if (sellersRes.rows.length === 0) {
                return res.status(400).json({ error: 'Nenhum vendedor ativo encontrado.' });
            }

            const split = Number(totalTarget) / sellersRes.rows.length;

            for (const s of sellersRes.rows) {
                const goalName = `${namePrefix || 'Meta'} - ${s.full_name}`;
                const row = await pool.query(`
                    INSERT INTO goals (
                        company_id, instance_id, name, goal_metric, target_scope, target_value,
                        start_date, end_date, user_id, status, is_recurring, recurrence, commission_rate
                    )
                    VALUES ($1, $2, $3, 'revenue', 'seller', $4, $5::date, $6::date, $7, 'active', false, 'none', $8)
                    RETURNING *
                `, [company_id, instance_id, goalName, split, startDate, endDate, s.id, Number(commissionRate || 0)]);
                createdGoals.push(row.rows[0]);
            }
        }

        await refreshGoalsForWindow(company_id, instance_id, new Date(startDate), new Date(endDate));
        return res.status(201).json({ success: true, created: createdGoals.length, goals: createdGoals });
    } catch (error: any) {
        console.error('[SHOP][GOALS] distributeRevenueGoalBySellers error:', error);
        return res.status(500).json({ error: error.message });
    }
};

export const getGoalSellers = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const rows = await pool!.query(`
            SELECT id, full_name
            FROM app_users
            WHERE company_id = $1 AND is_active = true
            ORDER BY full_name ASC
        `, [company_id]);
        return res.json(rows.rows);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};
