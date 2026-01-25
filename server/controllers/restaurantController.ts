
import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';

/**
 * Restaurant Dashboard Stats
 */
export const getRestaurantStats = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, shift } = req.query;
        const user = (req as any).user;
        const companyId = user.company_id;

        if (!companyId) return res.status(400).json({ error: 'Company ID restricted' });

        // Resolve instance_id
        let instanceId = req.query.instanceId;
        if (!instanceId) {
            const instRes = await pool!.query(
                "SELECT id FROM company_instances WHERE company_id = $1 AND status = 'connected' LIMIT 1",
                [companyId]
            );
            instanceId = instRes.rows[0]?.id;
        }

        const dateFilter = startDate && endDate ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'` : '';
        const shiftFilter = shift ? `AND shift = '${shift}'` : '';

        // 1. Pedidos Ativos
        const activeOrders = await pool!.query(
            "SELECT COUNT(*) FROM restaurant_orders WHERE company_id = $1 AND instance_id = $2 AND status IN ('novo', 'confirmado', 'preparo', 'entrega')",
            [companyId, instanceId]
        );

        // 2. Pedidos do Período
        const totalOrders = await pool!.query(
            `SELECT COUNT(*) FROM restaurant_orders WHERE company_id = $1 AND instance_id = $2 ${dateFilter} ${shiftFilter}`,
            [companyId, instanceId]
        );

        // 3. Clientes Atendidos
        const clientsServed = await pool!.query(
            `SELECT COUNT(*) FROM restaurant_orders WHERE company_id = $1 AND instance_id = $2 AND status = 'finalizado' ${dateFilter} ${shiftFilter}`,
            [companyId, instanceId]
        );

        // 4. Faturamento
        const revenue = await pool!.query(
            `SELECT SUM(total_value) as total FROM restaurant_orders WHERE company_id = $1 AND instance_id = $2 AND payment_status = 'paid' ${dateFilter} ${shiftFilter}`,
            [companyId, instanceId]
        );

        // 5. WhatsApp Status
        const waStatus = await pool!.query(
            "SELECT status FROM company_instances WHERE company_id = $1 AND id = $2",
            [companyId, instanceId]
        );

        // 6. Mesas Ocupadas
        const occupiedTables = await pool!.query(
            "SELECT COUNT(*) FROM restaurant_tables WHERE company_id = $1 AND instance_id = $2 AND status = 'ocupada'",
            [companyId, instanceId]
        );
        const totalTables = await pool!.query(
            "SELECT COUNT(*) FROM restaurant_tables WHERE company_id = $1 AND instance_id = $2",
            [companyId, instanceId]
        );

        // 7. Tempo Médio de Preparo
        const avgPrep = await pool!.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (prepared_at - started_at))/60) as avg_min 
             FROM restaurant_orders 
             WHERE company_id = $1 AND instance_id = $2 AND prepared_at IS NOT NULL ${dateFilter}`,
            [companyId, instanceId]
        );

        const totalRevenue = parseFloat(revenue.rows[0]?.total || 0);
        const totalServed = parseInt(clientsServed.rows[0]?.count || 0);
        const ticketMedio = totalServed > 0 ? (totalRevenue / totalServed) : 0;

        res.json({
            activeOrders: parseInt(activeOrders.rows[0].count),
            totalOrders: parseInt(totalOrders.rows[0].count),
            clientsServed: totalServed,
            revenue: totalRevenue,
            ticketMedio: ticketMedio,
            whatsappStatus: waStatus.rows[0]?.status || 'disconnected',
            occupiedTables: parseInt(occupiedTables.rows[0].count),
            totalTables: parseInt(totalTables.rows[0].count),
            avgPrepTime: Math.round(parseFloat(avgPrep.rows[0]?.avg_min || 0))
        });

    } catch (error: any) {
        console.error('[Restaurant Stats Error]:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Funnel Stats (Pipeline)
 */
export const getRestaurantFunnel = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;

        const funnel = await pool!.query(`
            SELECT 
                status, 
                COUNT(*) as count, 
                SUM(total_value) as value
            FROM restaurant_orders
            WHERE company_id = $1
            GROUP BY status
        `, [companyId]);

        res.json(funnel.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Tables Management
 */
export const getTables = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const result = await pool!.query(
            "SELECT * FROM restaurant_tables WHERE company_id = $1 ORDER BY table_number ASC",
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Menu Management
 */
export const getMenu = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const categories = await pool!.query(
            "SELECT * FROM restaurant_menu_categories WHERE company_id = $1 ORDER BY position ASC",
            [companyId]
        );

        const items = await pool!.query(
            "SELECT * FROM restaurant_menu_items WHERE company_id = $1 ORDER BY name ASC",
            [companyId]
        );

        res.json({
            categories: categories.rows,
            items: items.rows
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Orders Management
 */
export const getOrders = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { status } = req.query;

        let query = `
            SELECT o.*, t.table_number, l.name as client_name 
            FROM restaurant_orders o
            LEFT JOIN restaurant_tables t ON o.table_id = t.id
            LEFT JOIN crm_leads l ON o.client_id = l.id
            WHERE o.company_id = $1
        `;
        const params: any[] = [companyId];

        if (status) {
            query += " AND o.status = $2";
            params.push(status);
        }

        query += " ORDER BY o.created_at DESC";

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createOrder = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { table_id, client_id, channel, items, notes, shift } = req.body;

        const client = await pool!.connect();
        try {
            await client.query('BEGIN');

            // 1. Create Order
            const orderRes = await client.query(
                `INSERT INTO restaurant_orders (company_id, table_id, client_id, channel, notes, shift, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'novo') RETURNING *`,
                [companyId, table_id, client_id, channel || 'salao', notes, shift]
            );
            const order = orderRes.rows[0];

            // 2. Add Items
            let totalValue = 0;
            for (const item of items) {
                totalValue += (item.price * item.quantity);
                await client.query(
                    `INSERT INTO restaurant_order_items (order_id, menu_item_id, quantity, unit_price, notes)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [order.id, item.menu_item_id, item.quantity, item.price, item.item_notes]
                );
            }

            // 3. Update Order Total
            await client.query(
                "UPDATE restaurant_orders SET total_value = $1 WHERE id = $2",
                [totalValue, order.id]
            );

            // 4. Update Table Status
            if (table_id) {
                await client.query(
                    "UPDATE restaurant_tables SET status = 'ocupada' WHERE id = $1",
                    [table_id]
                );
            }

            await client.query('COMMIT');
            res.status(201).json({ ...order, total_value: totalValue });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Deliveries
 */
export const getDeliveries = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const result = await pool!.query(
            `SELECT d.*, o.total_value, o.notes, l.name as client_name, u.full_name as driver_name
             FROM restaurant_deliveries d
             JOIN restaurant_orders o ON d.order_id = o.id
             LEFT JOIN crm_leads l ON o.client_id = l.id
             LEFT JOIN app_users u ON d.delivery_staff_id = u.id
             WHERE o.company_id = $1`,
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
