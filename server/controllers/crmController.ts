import { Request, Response } from 'express';
import { pool } from '../db';

// Ensure default stages exist
const ensureDefaultStages = async () => {
    if (!pool) return;

    // Check specifically for 'Leads' stage
    const leadsStageCheck = await pool.query("SELECT id FROM crm_stages WHERE name = 'Leads'");

    if (leadsStageCheck.rows.length === 0) {
        // Create Leads stage if it doesn't exist. Force position 0 or 1.
        await pool.query("INSERT INTO crm_stages (name, position) VALUES ('Leads', 1)");
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM crm_stages');
    if (parseInt(countResult.rows[0].count) <= 1 && leadsStageCheck.rows.length === 0) {
        // If table was basically empty (or we just added Leads), add the others.
        // This prevents adding duplicates if only Leads was missing.
        // Only run full seed if table was previously empty.
        const defaultStages = [
            { name: 'Em contato', position: 2 },
            { name: 'Agendamento', position: 3 },
            { name: 'Venda realizada', position: 4 },
            { name: 'Perdido', position: 5 }
        ];

        for (const stage of defaultStages) {
            // Avoid duplicates by name
            await pool.query('INSERT INTO crm_stages (name, position) VALUES ($1, $2) ON CONFLICT DO NOTHING', [stage.name, stage.position]);
        }
    }
};

export const getStages = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        await ensureDefaultStages();

        const result = await pool.query('SELECT * FROM crm_stages ORDER BY position ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching stages:', error);
        res.status(500).json({ error: 'Failed to fetch stages' });
    }
};

export const getLeads = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const result = await pool.query(`
            SELECT l.*, s.name as stage_name, s.position as stage_position 
            FROM crm_leads l
            LEFT JOIN crm_stages s ON l.stage_id = s.id
            ORDER BY l.updated_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};

export const updateLeadStage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const { stageId } = req.body; // Expecting stage_id (integer) OR stageId (integer)

        if (!stageId) {
            return res.status(400).json({ error: 'stageId is required' });
        }

        const result = await pool.query(
            'UPDATE crm_leads SET stage_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [stageId, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating lead stage:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
};

export const createStage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }

        // Define próxima posição após a última fase existente
        const posResult = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM crm_stages');
        const nextPos = posResult.rows[0].next_pos as number;

        const insertResult = await pool.query(
            'INSERT INTO crm_stages (name, position) VALUES ($1, $2) RETURNING *',
            [name.trim(), nextPos]
        );

        res.status(201).json(insertResult.rows[0]);
    } catch (error) {
        console.error('Error creating stage:', error);
        res.status(500).json({ error: 'Failed to create stage' });
    }
};

export const deleteStage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;

        // 1. Check if stage exists and get details
        const stageRes = await pool.query('SELECT * FROM crm_stages WHERE id = $1', [id]);
        if (stageRes.rows.length === 0) {
            return res.status(404).json({ error: 'Stage not found' });
        }
        const stageToDelete = stageRes.rows[0];

        // 2. Prevent deleting "Leads" or critical stages
        // 2. Prevent deleting "Leads" (system stage)
        if (stageToDelete.name === 'Leads') {
            return res.status(400).json({ error: 'Não é permitido excluir a fase inicial de Leads.' });
        }

        // 3. Move leads to "Leads" stage (ID 1 usually, or find by name)
        // Find default 'Leads' stage
        const defaultStageRes = await pool.query("SELECT id FROM crm_stages WHERE name = 'Leads' LIMIT 1");
        let fallbackStageId = defaultStageRes.rows.length > 0 ? defaultStageRes.rows[0].id : null;

        if (!fallbackStageId) {
            // Fallback to any other stage that is not the one being deleted
            const specificRes = await pool.query('SELECT id FROM crm_stages WHERE id != $1 ORDER BY position ASC LIMIT 1', [id]);
            if (specificRes.rows.length > 0) fallbackStageId = specificRes.rows[0].id;
        }

        if (fallbackStageId) {
            await pool.query('UPDATE crm_leads SET stage_id = $1 WHERE stage_id = $2', [fallbackStageId, id]);
        } else {
            const leadCount = await pool.query('SELECT COUNT(*) FROM crm_leads WHERE stage_id = $1', [id]);
            if (parseInt(leadCount.rows[0].count) > 0) {
                return res.status(400).json({ error: 'Não é possível excluir fase com leads sem uma fase de destino alternativa.' });
            }
        }

        // 4. Delete stage
        await pool.query('DELETE FROM crm_stages WHERE id = $1', [id]);

        res.json({ message: 'Stage deleted successfully' });

    } catch (error) {
        console.error('Error deleting stage:', error);
        res.status(500).json({ error: 'Failed to delete stage' });
    }
};

export const getCrmDashboardStats = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        // 1. Funnel Data (Stages + Lead Counts)
        const funnelRes = await pool.query(`
            SELECT s.name as label, COUNT(l.id) as count, s.position
            FROM crm_stages s
            LEFT JOIN crm_leads l ON s.id = l.stage_id
            GROUP BY s.id, s.name, s.position
            ORDER BY s.position ASC
        `);

        const funnelData = funnelRes.rows.map((row, idx) => {
            // Simple color cycle
            const colors = [
                { border: "border-blue-500", bg: "bg-blue-50" },
                { border: "border-indigo-500", bg: "bg-indigo-50" },
                { border: "border-purple-500", bg: "bg-purple-50" },
                { border: "border-orange-500", bg: "bg-orange-50" },
                { border: "border-green-500", bg: "bg-green-50" }
            ];
            const theme = colors[idx % colors.length];

            return {
                label: row.label,
                count: parseInt(row.count),
                value: "R$ 0", // Placeholder for value
                color: theme.border,
                bg: theme.bg
            };
        });

        // 2. Overview Stats
        const activeConvsRes = await pool.query(`SELECT COUNT(*) FROM whatsapp_conversations`);
        const msgsTodayRes = await pool.query(`
            SELECT COUNT(*) FROM whatsapp_messages 
            WHERE direction = 'inbound' 
            AND sent_at::date = CURRENT_DATE
        `);
        const newLeadsRes = await pool.query(`
            SELECT COUNT(*) FROM crm_leads 
            WHERE created_at::date = CURRENT_DATE
        `);
        const attendedClientsRes = await pool.query(`
             SELECT COUNT(DISTINCT conversation_id) 
             FROM whatsapp_messages 
             WHERE direction = 'outbound' AND sent_at::date = CURRENT_DATE
        `);

        // 3. Realtime Activities
        const recentMsgsRes = await pool.query(`
             SELECT m.content as text, m.sent_at, m.direction, c.phone, c.contact_name
             FROM whatsapp_messages m
             JOIN whatsapp_conversations c ON m.conversation_id = c.id
             ORDER BY m.sent_at DESC
             LIMIT 5
        `);

        const recentActivities = recentMsgsRes.rows.map(m => ({
            type: m.direction === 'inbound' ? 'msg_in' : 'msg_out',
            user: m.contact_name || m.phone,
            text: m.text,
            time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: m.direction === 'inbound' ? 'w_agent' : 'w_client'
        }));

        res.json({
            funnel: funnelData,
            overview: {
                activeConversations: activeConvsRes.rows[0].count,
                receivedMessages: msgsTodayRes.rows[0].count,
                attendedClients: attendedClientsRes.rows[0].count,
                newLeads: newLeadsRes.rows[0].count,
            },
            activities: recentActivities
        });

    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
