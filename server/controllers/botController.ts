
import { Request, Response } from 'express';
import { pool } from '../db';

// --- BOTS CRUD ---

export const getBots = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const result = await pool!.query(
            `SELECT b.*, 
                (SELECT COUNT(*) FROM bot_instances bi WHERE bi.bot_id = b.id AND bi.active = true) as active_instances_count
             FROM bots b 
             WHERE b.company_id = $1 
             ORDER BY b.updated_at DESC`,
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error("Error getting bots:", error);
        res.status(500).json({ error: error.message });
    }
};

export const createBot = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { name, description } = req.body;

        const result = await pool!.query(
            `INSERT INTO bots (company_id, name, description, status) 
             VALUES ($1, $2, $3, 'inactive') 
             RETURNING *`,
            [companyId, name, description]
        );

        // Create a default "Start" node
        const botId = result.rows[0].id;
        await pool!.query(
            `INSERT INTO bot_nodes (bot_id, type, position_x, position_y, content)
             VALUES ($1, 'start', 100, 100, '{"label": "Início"}')`,
            [botId]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error("Error creating bot:", error);
        res.status(500).json({ error: error.message });
    }
};

export const updateBot = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const { name, description, status, trigger_type, trigger_config, settings } = req.body;

        const result = await pool!.query(
            `UPDATE bots SET 
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                trigger_type = COALESCE($4, trigger_type),
                trigger_config = COALESCE($5, trigger_config),
                settings = COALESCE($6, settings),
                updated_at = NOW()
             WHERE id = $7 AND company_id = $8
             RETURNING *`,
            [name, description, status, trigger_type, trigger_config, settings, id, companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error("Error updating bot:", error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteBot = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        const result = await pool!.query(
            "DELETE FROM bots WHERE id = $1 AND company_id = $2 RETURNING id",
            [id, companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bot not found' });
        }

        res.json({ message: 'Bot deleted successfully' });
    } catch (error: any) {
        console.error("Error deleting bot:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- FLOW (NODES & EDGES) ---

export const getBotFlow = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        // Verify ownership
        const botCheck = await pool!.query("SELECT id FROM bots WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });

        const nodes = await pool!.query("SELECT * FROM bot_nodes WHERE bot_id = $1", [id]);
        const edges = await pool!.query("SELECT * FROM bot_edges WHERE bot_id = $1", [id]);

        res.json({
            nodes: nodes.rows,
            edges: edges.rows
        });
    } catch (error: any) {
        console.error("Error getting bot flow:", error);
        res.status(500).json({ error: error.message });
    }
};

export const saveBotFlow = async (req: Request, res: Response) => {
    const client = await pool!.connect();
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const { nodes, edges } = req.body; // Expecting arrays of new/updated nodes/edges

        await client.query('BEGIN');

        // Verify ownership
        const botCheck = await client.query("SELECT id FROM bots WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (botCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Bot not found' });
        }

        // Full replace strategy for flow (simplest for consistent state)
        // 1. Delete existing
        await client.query("DELETE FROM bot_edges WHERE bot_id = $1", [id]);
        await client.query("DELETE FROM bot_nodes WHERE bot_id = $1", [id]);

        // 2. Insert nodes
        if (nodes && nodes.length > 0) {
            for (const node of nodes) {
                await client.query(
                    `INSERT INTO bot_nodes (id, bot_id, type, position_x, position_y, content)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [node.id, id, node.type, node.position.x, node.position.y, node.data]
                );
            }
        }

        // 3. Insert edges
        if (edges && edges.length > 0) {
            for (const edge of edges) {
                await client.query(
                    `INSERT INTO bot_edges (id, bot_id, source_node_id, target_node_id, source_handle, target_handle, label)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [edge.id, id, edge.source, edge.target, edge.sourceHandle, edge.targetHandle, edge.label]
                );
            }
        }

        // Update bot timestamp
        await client.query("UPDATE bots SET updated_at = NOW() WHERE id = $1", [id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error("Error saving bot flow:", error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

// --- INSTANCES ---

export const getBotInstances = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        // Verify ownership
        const botCheck = await pool!.query("SELECT id FROM bots WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });

        // Get all company instances and join with bot_instances
        const result = await pool!.query(`
            SELECT 
                ci.instance_key,
                ci.name as instance_friendly_name,
                COALESCE(bi.active, false) as is_connected
            FROM company_instances ci
            LEFT JOIN bot_instances bi ON bi.instance_key = ci.instance_key AND bi.bot_id = $2
            WHERE ci.company_id = $1
        `, [companyId, id]);

        console.log(`[getBotInstances] Found ${result.rows.length} instances for bot ${id}, company ${companyId}`);
        res.json(result.rows);
    } catch (error: any) {
        console.error("Error getting bot instances:", error);
        res.status(500).json({ error: error.message });
    }
};

export const toggleBotInstance = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const { instance_key, active } = req.body;

        // Verify ownership of bot
        const botCheck = await pool!.query("SELECT id FROM bots WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Bot not found' });

        // Verify ownership of instance
        const instanceCheck = await pool!.query("SELECT id FROM company_instances WHERE instance_key = $1 AND company_id = $2", [instance_key, companyId]);
        if (instanceCheck.rows.length === 0) return res.status(403).json({ error: 'Instance does not belong to company' });

        if (active) {
            // Upsert
            await pool!.query(`
                INSERT INTO bot_instances (bot_id, instance_key, active)
                VALUES ($1, $2, true)
                ON CONFLICT (bot_id, instance_key) 
                DO UPDATE SET active = true
            `, [id, instance_key]);
        } else {
            // Deactivate
            await pool!.query(`
                UPDATE bot_instances SET active = false WHERE bot_id = $1 AND instance_key = $2
            `, [id, instance_key]);
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error("Error toggling bot instance:", error);
        res.status(500).json({ error: error.message });
    }
};
