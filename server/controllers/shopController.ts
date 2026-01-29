
import { Response } from 'express';
import { pool } from '../db';
import { RequestWithInstance } from '../middleware/validateCompanyAndInstance';

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
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createSale = async (req: RequestWithInstance, res: Response) => {
    const client = await pool!.connect();
    try {
        const { company_id, id: user_id } = req.user;
        const instance_id = req.instanceId;
        const { client_id, items, payment_method, discount, channel, status } = req.body; // items: [{inventory_id, quantity, unit_price}]

        await client.query('BEGIN');

        // 1. Calculate totals
        let total_amount = 0;
        const saleItems = [];

        for (const item of items) {
            const subtotal = Number(item.quantity) * Number(item.unit_price);
            total_amount += subtotal;
            saleItems.push({ ...item, total: subtotal });

            // Check stock
            const stockCheck = await client.query('SELECT quantity, name FROM inventory WHERE id = $1', [item.inventory_id]);
            if (stockCheck.rows.length === 0) throw new Error(`Product ${item.inventory_id} not found`);
            // if (stockCheck.rows[0].quantity < item.quantity) throw new Error(`Insufficient stock for ${stockCheck.rows[0].name}`);
        }

        const final_amount = total_amount - (Number(discount) || 0);

        // 2. Create Sale
        const saleRes = await client.query(`
            INSERT INTO sales (company_id, instance_id, client_id, user_id, total_amount, discount, final_amount, payment_method, channel, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [company_id, instance_id, client_id, user_id, total_amount, discount || 0, final_amount, payment_method, channel || 'loja_fisica', status || 'completed']);

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
        // Ignoring for now or can calculate based on payment_method logic
        if (status === 'completed') {
            await client.query(`
                INSERT INTO receivables (company_id, instance_id, sale_id, client_id, description, amount, due_date, paid_at, status, payment_method)
                VALUES ($1, $2, $3, $4, 'Venda #' || $3, $5, NOW(), NOW(), 'paid', $6)
             `, [company_id, instance_id, saleId, client_id, final_amount, payment_method]);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, saleId });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Create sale error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

// --- INVENTORY ---

export const getInventory = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const { search } = req.query;

        let query = `SELECT * FROM inventory WHERE company_id = $1 AND instance_id = $2 AND status = 'active'`;
        const params: any[] = [company_id, instance_id];

        if (search) {
            query += ` AND (name ILIKE $3 OR sku ILIKE $3 OR category ILIKE $3)`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY name ASC`;

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createInventoryItem = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const instance_id = req.instanceId;
        const { name, sku, category, cost_price, sale_price, quantity, min_quantity, supplier_id } = req.body;

        const result = await pool!.query(`
            INSERT INTO inventory (company_id, instance_id, name, sku, category, cost_price, sale_price, quantity, min_quantity, supplier_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [company_id, instance_id, name, sku, category, cost_price, sale_price, quantity, min_quantity, supplier_id]);

        // Log initial movement if quantity > 0
        if (Number(quantity) > 0) {
            await pool!.query(`
                INSERT INTO inventory_movements (company_id, instance_id, inventory_id, type, quantity, reason, user_id)
                VALUES ($1, $2, $3, 'in', $4, 'Estoque Inicial', $5)
             `, [company_id, instance_id, result.rows[0].id, quantity, req.user.id]);
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateInventoryItem = async (req: RequestWithInstance, res: Response) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const { name, sale_price, quantity, min_quantity } = req.body; // Partial update supported

        // If updating quantity directly, we should log it? Or separate endpoint for stock adjustment?
        // For simplicity assume simple edit for now, but real world needs adjustment flow. Use 'inventory/adjustment' endpoint ideally.

        const result = await pool!.query(`
            UPDATE inventory SET name = COALESCE($1, name), sale_price = COALESCE($2, sale_price), min_quantity = COALESCE($3, min_quantity)
            WHERE id = $4 AND company_id = $5
            RETURNING *
         `, [name, sale_price, min_quantity, id, company_id]);

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
