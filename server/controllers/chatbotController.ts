
import { Request, Response } from 'express';
import { pool } from '../db';

/**
 * Chatbot Controller V2 - Professional Builder
 */

export const getChatbots = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user?.company_id;
        if (!companyId) return res.status(403).json({ error: 'ID de empresa nÃ£o encontrado na sessÃ£o.' });

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
        const companyId = (req as any).user?.company_id;
        if (!companyId) return res.status(403).json({ error: 'ID de empresa nÃ£o encontrado na sessÃ£o.' });

        const { name, description } = req.body;
        console.log(`[Create Chatbot] Company: ${companyId}, Name: ${name}`);

        const result = await pool!.query(
            `INSERT INTO chatbots (company_id, name, description, status) 
             VALUES ($1, $2, $3, 'draft') 
             RETURNING *`,
            [companyId, name, description || null]
        );

        const chatbotId = result.rows[0].id;

        // Create initial version 
        const initialFlow = {
            nodes: [
                { id: 'node-start', type: 'start', position: { x: 100, y: 100 }, data: { label: 'InÃ­cio' } }
            ],
            edges: []
        };

        await pool!.query(
            `INSERT INTO chatbot_versions (chatbot_id, version_number, flow_json, is_published)
             VALUES ($1, 1, $2, false)`,
            [chatbotId, initialFlow]
        );

        console.log(`[Create Chatbot] Success: Bot ID ${chatbotId}`);
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error("[Create Chatbot] FAILED:", error);
        res.status(500).json({ error: error.message });
    }
};

export const updateChatbot = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user?.company_id;
        if (!companyId) return res.status(403).json({ error: 'ID de empresa nÃ£o encontrado na sessÃ£o.' });

        const { id } = req.params;
        const { name, description, status } = req.body;

        const result = await pool!.query(
            `UPDATE chatbots SET 
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                updated_at = NOW()
             WHERE id = $4 AND company_id = $5
             RETURNING *`,
            [name, description, status, id, companyId]
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
        const companyId = (req as any).user?.company_id;
        if (!companyId) return res.status(403).json({ error: 'ID de empresa nÃ£o encontrado na sessÃ£o.' });

        const { id } = req.params;
        const { flow } = req.body;

        console.log(`[Save Flow] Bot: ${id}, Company: ${companyId}`);
        console.log(`[Save Flow] Nodes: ${flow?.nodes?.length}, Edges: ${flow?.edges?.length}`);

        // Verify ownership
        const botCheck = await pool!.query("SELECT id FROM chatbots WHERE id = $1 AND company_id = $2", [id, companyId]);
        if (botCheck.rows.length === 0) {
            console.error(`[Save Flow] Bot ${id} not found for company ${companyId}`);
            return res.status(404).json({ error: 'Chatbot not found' });
        }

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
        const user = (req as any).user;
        let companyId = user?.company_id ? Number(user.company_id) : null;
        const { id } = req.params;

        if (!companyId) {
            const ownerRes = await pool!.query('SELECT company_id FROM chatbots WHERE id = $1', [id]);
            if (ownerRes.rows.length === 0) return res.status(404).json({ error: 'Chatbot not found' });
            companyId = Number(ownerRes.rows[0].company_id);
        }

        const botCheck = await pool!.query(
            'SELECT id FROM chatbots WHERE id = $1 AND company_id = $2',
            [id, companyId]
        );
        if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Chatbot not found' });

        let result = await pool!.query(`
            SELECT 
                ci.instance_key,
                COALESCE(ci.name, ci.instance_key) as instance_friendly_name,
                COALESCE(bi.is_active, false) as is_connected
            FROM company_instances ci
            LEFT JOIN chatbot_instances bi ON bi.instance_key = ci.instance_key AND bi.chatbot_id = $2
            WHERE ci.company_id = $1
            ORDER BY ci.created_at ASC, ci.id ASC
        `, [companyId, id]);

        // Fallback for legacy companies that still only use companies.evolution_instance
        if (result.rows.length === 0) {
            const legacyRes = await pool!.query(
                'SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1',
                [companyId]
            );

            if (legacyRes.rows.length > 0 && legacyRes.rows[0].evolution_instance) {
                const legacyKey = String(legacyRes.rows[0].evolution_instance).trim();

                const seeded = await pool!.query(`
                    INSERT INTO company_instances (company_id, name, instance_key, api_key, status)
                    VALUES ($1, 'InstÃ¢ncia Principal', $2, $3, 'disconnected')
                    ON CONFLICT (instance_key) DO NOTHING
                    RETURNING id
                `, [companyId, legacyKey, legacyRes.rows[0].evolution_apikey || null]);

                if (seeded.rows.length === 0) {
                    // Instance key already exists globally; return as virtual fallback for this company
                    return res.json([{
                        instance_key: legacyKey,
                        instance_friendly_name: 'InstÃ¢ncia Principal',
                        is_connected: false
                    }]);
                }

                result = await pool!.query(`
                    SELECT 
                        ci.instance_key,
                        COALESCE(ci.name, ci.instance_key) as instance_friendly_name,
                        COALESCE(bi.is_active, false) as is_connected
                    FROM company_instances ci
                    LEFT JOIN chatbot_instances bi ON bi.instance_key = ci.instance_key AND bi.chatbot_id = $2
                    WHERE ci.company_id = $1
                    ORDER BY ci.created_at ASC, ci.id ASC
                `, [companyId, id]);
            }
        }

        res.json(result.rows);
    } catch (error: any) {
        console.error('Error getting chatbot instances:', error);
        res.status(500).json({ error: error.message });
    }
};

export const toggleInstance = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let companyId = user?.company_id ? Number(user.company_id) : null;
        const { id } = req.params;
        const { instance_key, active } = req.body;

        if (!instance_key) {
            return res.status(400).json({ error: 'instance_key is required' });
        }

        if (!companyId) {
            const ownerRes = await pool!.query('SELECT company_id FROM chatbots WHERE id = $1', [id]);
            if (ownerRes.rows.length === 0) return res.status(404).json({ error: 'Chatbot not found' });
            companyId = Number(ownerRes.rows[0].company_id);
        }

        const botCheck = await pool!.query(
            'SELECT id FROM chatbots WHERE id = $1 AND company_id = $2',
            [id, companyId]
        );
        if (botCheck.rows.length === 0) return res.status(404).json({ error: 'Chatbot not found' });

        const instanceCheck = await pool!.query(
            'SELECT id FROM company_instances WHERE company_id = $1 AND instance_key = $2',
            [companyId, instance_key]
        );
        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Instance does not belong to chatbot company' });
        }

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

