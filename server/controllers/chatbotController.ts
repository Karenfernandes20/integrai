
import { Request, Response } from 'express';
import { pool } from '../db';

/**
 * Chatbot Controller V2 - Professional Builder
 */

export const getChatbots = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const result = await pool!.query(
            `SELECT c.*, 
                (SELECT COUNT(*) FROM chatbot_instances ci WHERE ci.chatbot_id = c.id AND ci.is_active = true) as active_instances_count
             FROM chatbots c 
             WHERE c.company_id = $1 
             ORDER BY c.updated_at DESC`,
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error("Error getting chatbots:", error);
        res.status(500).json({ error: error.message });
    }
};

export const createChatbot = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { name, description } = req.body;

        const result = await pool!.query(
            `INSERT INTO chatbots (company_id, name, status) 
             VALUES ($1, $2, 'draft') 
             RETURNING *`,
            [companyId, name]
        );

        const chatbotId = result.rows[0].id;

        // Create initial version 
        const initialFlow = {
            nodes: [
                { id: 'node-start', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Início' } }
            ],
            edges: []
        };

        await pool!.query(
            `INSERT INTO chatbot_versions (chatbot_id, version_number, flow_json, is_published)
             VALUES ($1, 1, $2, false)`,
            [chatbotId, initialFlow]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error("Error creating chatbot:", error);
        res.status(500).json({ error: error.message });
    }
};

export const updateChatbot = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const { name, status } = req.body;

        const result = await pool!.query(
            `UPDATE chatbots SET 
                name = COALESCE($1, name),
                status = COALESCE($2, status),
                updated_at = NOW()
             WHERE id = $3 AND company_id = $4
             RETURNING *`,
            [name, status, id, companyId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Chatbot not found' });
        res.json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteChatbot = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        const result = await pool!.query(
            "DELETE FROM chatbots WHERE id = $1 AND company_id = $2 RETURNING id",
            [id, companyId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Chatbot not found' });
        res.json({ message: 'Chatbot deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getFlow = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params; // chatbot id

        // Get latest version (usually draft or active)
        const result = await pool!.query(
            `SELECT v.* FROM chatbot_versions v
             JOIN chatbots c ON c.id = v.chatbot_id
             WHERE c.id = $1 AND c.company_id = $2
             ORDER BY v.version_number DESC LIMIT 1`,
            [id, companyId]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });
        res.json(result.rows[0].flow_json);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const saveFlow = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const { flow } = req.body;

        // Verify ownership
        const botCheck = await pool!.query("SELECT id FROM chatbots WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Chatbot not found' });

        // Get current version count
        const vCheck = await pool!.query("SELECT MAX(version_number) as max_v FROM chatbot_versions WHERE chatbot_id = $1", [id]);
        const nextV = (vCheck.rows[0].max_v || 0) + 1;

        // Create new version as draft
        await pool!.query(
            `INSERT INTO chatbot_versions (chatbot_id, version_number, flow_json, is_published)
             VALUES ($1, $2, $3, false)`,
            [id, nextV, flow]
        );

        await pool!.query("UPDATE chatbots SET updated_at = NOW(), status = 'draft' WHERE id = $1", [id]);

        res.json({ success: true, version: nextV });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const publishFlow = async (req: Request, res: Response) => {
    const client = await pool!.connect();
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        await client.query('BEGIN');

        // 1. Get total versions to find the one to publish
        const vCheck = await client.query(
            `SELECT v.id, v.version_number FROM chatbot_versions v
             JOIN chatbots c ON c.id = v.chatbot_id
             WHERE c.id = $1 AND c.company_id = $2
             ORDER BY v.version_number DESC LIMIT 1`,
            [id, companyId]
        );

        if (vCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No version to publish' });
        }

        const versionToPublish = vCheck.rows[0];

        // 2. Mark this version as published (and others as not published for this bot)
        await client.query("UPDATE chatbot_versions SET is_published = false WHERE chatbot_id = $1", [id]);
        await client.query("UPDATE chatbot_versions SET is_published = true WHERE id = $1", [versionToPublish.id]);

        // 3. Update chatbot status and active_version_id
        await client.query(
            `UPDATE chatbots SET 
                status = 'published',
                active_version_id = $1,
                updated_at = NOW()
             WHERE id = $2`,
            [versionToPublish.id, id]
        );

        await client.query('COMMIT');
        res.json({ success: true, version: versionToPublish.version_number });
    } catch (error: any) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
};

export const getInstances = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        const result = await pool!.query(`
            SELECT 
                ci.instance_key,
                ci.instance_friendly_name,
                COALESCE(bi.is_active, false) as is_connected
            FROM company_instances ci
            LEFT JOIN chatbot_instances bi ON bi.instance_key = ci.instance_key AND bi.chatbot_id = $2
            WHERE ci.company_id = $1
        `, [companyId, id]);

        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const toggleInstance = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const { instance_key, active } = req.body;

        if (active) {
            await pool!.query(`
                INSERT INTO chatbot_instances (chatbot_id, instance_key, is_active)
                VALUES ($1, $2, true)
                ON CONFLICT (chatbot_id, instance_key) 
                DO UPDATE SET is_active = true
            `, [id, instance_key]);
        } else {
            await pool!.query(`
                UPDATE chatbot_instances SET is_active = false WHERE chatbot_id = $1 AND instance_key = $2
            `, [id, instance_key]);
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
