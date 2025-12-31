import { Request, Response } from 'express';
import { pool } from '../db';

// Helper to get Evolution Config based on User Context (Replicated from evolutionController for speed/shared logic)
const getEvolutionConfig = async (user: any) => {
    let config = {
        url: process.env.EVOLUTION_API_URL,
        apikey: process.env.EVOLUTION_API_KEY,
        instance: "integrai"
    };

    if (user && pool) {
        try {
            const userRes = await pool.query('SELECT company_id FROM app_users WHERE id = $1', [user.id]);
            if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
                const companyId = userRes.rows[0].company_id;
                // console.log(`[CRM Config] Resolving config for Company ID: ${companyId}`);

                const compRes = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1', [companyId]);
                if (compRes.rows.length > 0) {
                    const { evolution_instance, evolution_apikey } = compRes.rows[0];
                    if (evolution_instance && evolution_apikey) {
                        config.instance = evolution_instance;
                        config.apikey = evolution_apikey;
                        // console.log(`[CRM Config] Found DB Config - Instance: ${evolution_instance}`);
                    }
                }
            }
        } catch (e) {
            console.error("Error fetching company evolution config in CRM:", e);
        }
    }
    return config;
};

const getEvolutionConnectionStateInternal = async (user: any) => {
    const config = await getEvolutionConfig(user);
    const { url, apikey, instance } = config;

    console.log(`[CRM Dashboard] Checking WhatsApp Status for Instance: ${instance || 'N/A'}`);

    if (!url || !apikey || !instance) {
        console.warn(`[CRM Dashboard] Missing Evolution Config. URL: ${!!url}, Key: ${!!apikey}, Instance: ${!!instance}`);
        return 'Offline';
    }

    try {
        const fetchUrl = `${url.replace(/\/$/, "")}/instance/connectionState/${instance}`;
        console.log(`[CRM Dashboard] Fetching URL: ${fetchUrl}`);

        const response = await fetch(fetchUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "apikey": apikey
            },
        });

        if (!response.ok) {
            console.error(`[CRM Dashboard] Status Fetch Failed for '${instance}'. Status: ${response.status}`);
            return 'Offline';
        }

        const data = await response.json();
        // Evolution returns { instance: { state: 'open' | 'close' | 'connecting' ... } }
        const rawState = data?.instance?.state || data?.state;

        // Log explicitly for debugging
        console.log(`[CRM Dashboard] Instance '${instance}' Status: ${rawState}`);

        if (!rawState) return 'Offline';


        if (!rawState) return 'Offline';

        const state = String(rawState).toLowerCase();

        if (state === 'open') return 'Online';
        if (state === 'connecting') return 'Conectando';
        if (state === 'close') return 'Offline';
        if (state.includes('qr') || state.includes('scann')) return 'QR Code pendente';

        return 'Offline'; // Default for unknown states
    } catch (error) {
        console.error(`[CRM Dashboard] Exception checking status:`, error);
        return 'Offline';
    }
};

// Ensure default stages exist
const ensureDefaultStages = async () => {
    if (!pool) return;

    try {
        // 1. Check for 'Leads' stage specifically
        const leadsStageCheck = await pool.query("SELECT id FROM crm_stages WHERE name = 'Leads'");

        if (leadsStageCheck.rows.length === 0) {
            // Create Leads stage at position 0
            await pool.query("INSERT INTO crm_stages (name, position, color) VALUES ('Leads', 0, '#cbd5e1')");
        } else {
            // Ensure it is at position 0
            await pool.query("UPDATE crm_stages SET position = 0 WHERE name = 'Leads'");
        }

        // 2. Ensure other defaults if strictly empty
        const countResult = await pool.query('SELECT COUNT(*) FROM crm_stages');
        if (parseInt(countResult.rows[0].count) <= 1) {
            const defaultStages = [
                { name: 'Em Atendimento', position: 1, color: '#93c5fd' },
                { name: 'Agendamento', position: 2, color: '#fde047' },
                { name: 'Venda Realizada', position: 3, color: '#86efac' },
                { name: 'Perdido', position: 4, color: '#fca5a5' }
            ];

            for (const stage of defaultStages) {
                await pool.query(
                    'INSERT INTO crm_stages (name, position, color) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [stage.name, stage.position, stage.color]
                );
            }
        }
    } catch (error) {
        console.error("Error ensuring default stages:", error);
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

        const user = (req as any).user;
        const companyId = user?.company_id;

        let query = `
            SELECT l.*, s.name as stage_name, s.position as stage_position,
            (
                SELECT status FROM crm_follow_ups 
                WHERE lead_id = l.id AND status IN ('pending', 'overdue')
                ORDER BY scheduled_at ASC LIMIT 1
            ) as follow_up_status,
            (
                SELECT scheduled_at FROM crm_follow_ups 
                WHERE lead_id = l.id AND status IN ('pending', 'overdue')
                ORDER BY scheduled_at ASC LIMIT 1
            ) as follow_up_date
            FROM crm_leads l
            LEFT JOIN crm_stages s ON l.stage_id = s.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (user.role !== 'SUPERADMIN' || companyId) {
            query += ` AND l.company_id = $1`;
            params.push(companyId);
        }

        query += ` ORDER BY l.updated_at DESC`;

        const result = await pool.query(query, params);
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
        const { stageId } = req.body;

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

export const updateLead = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const { name, email, phone, stage_id, description, value, origin } = req.body;

        const result = await pool.query(
            `UPDATE crm_leads 
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 phone = COALESCE($3, phone),
                 stage_id = COALESCE($4, stage_id),
                 description = COALESCE($5, description),
                 value = COALESCE($6, value),
                 origin = COALESCE($7, origin),
                 updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [name, email, phone, stage_id, description, value, origin, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating lead:', error);
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

        const user = (req as any).user;
        const companyId = user?.company_id;
        const filterClause = (user.role !== 'SUPERADMIN' || companyId) ? 'WHERE company_id = $1' : 'WHERE 1=1';
        const filterParams = (user.role !== 'SUPERADMIN' || companyId) ? [companyId] : [];

        // 1. Funnel Data (Stages + Lead Counts)
        const funnelRes = await pool.query(`
            SELECT s.name as label, COUNT(l.id) as count, s.position
            FROM crm_stages s
            LEFT JOIN crm_leads l ON s.id = l.stage_id ${filterClause.replace('WHERE', 'AND')}
            GROUP BY s.id, s.name, s.position
            ORDER BY s.position ASC
        `, filterParams);

        const funnelData = funnelRes.rows.map((row, idx) => {
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
                value: "R$ 0",
                color: theme.border,
                bg: theme.bg
            };
        });

        // 2. Overview Stats
        const activeConvsRes = await pool.query(`SELECT COUNT(*) FROM whatsapp_conversations ${filterClause}`, filterParams);
        const msgsTodayRes = await pool.query(`
            SELECT COUNT(*) FROM whatsapp_messages m
            JOIN whatsapp_conversations c ON m.conversation_id = c.id
            ${filterClause.replace('WHERE', 'WHERE c.')}
            AND m.direction = 'inbound' 
            AND m.sent_at::date = CURRENT_DATE
        `, filterParams);
        const newLeadsRes = await pool.query(`
            SELECT COUNT(*) FROM crm_leads 
            ${filterClause}
            AND created_at::date = CURRENT_DATE
        `, filterParams);
        const attendedClientsRes = await pool.query(`
             SELECT COUNT(DISTINCT m.conversation_id) 
             FROM whatsapp_messages m
             JOIN whatsapp_conversations c ON m.conversation_id = c.id
             ${filterClause.replace('WHERE', 'WHERE c.')}
             AND m.direction = 'outbound' AND m.sent_at::date = CURRENT_DATE
        `, filterParams);

        // Follow-ups summary
        const followUpsStatRes = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'pending' AND scheduled_at < NOW()) as overdue
            FROM crm_follow_ups
            ${filterClause}
        `, filterParams);

        const recentFollowUpsRes = await pool.query(`
            SELECT f.*, COALESCE(l.name, c.contact_name) as contact_name
            FROM crm_follow_ups f
            LEFT JOIN crm_leads l ON f.lead_id = l.id
            LEFT JOIN whatsapp_conversations c ON f.conversation_id = c.id
            ${filterClause}
            AND f.status = 'pending'
            ORDER BY f.scheduled_at ASC
            LIMIT 5
        `, filterParams);

        // 3. Realtime Activities
        const recentMsgsRes = await pool.query(`
             SELECT m.content as text, m.sent_at, m.direction, c.phone, c.contact_name
             FROM whatsapp_messages m
             JOIN whatsapp_conversations c ON m.conversation_id = c.id
             ${filterClause.replace('WHERE', 'WHERE c.')}
             ORDER BY m.sent_at DESC
             LIMIT 5
        `, filterParams);

        const recentActivities = recentMsgsRes.rows.map(m => ({
            type: m.direction === 'inbound' ? 'msg_in' : 'msg_out',
            user: m.contact_name || m.phone,
            text: m.text,
            time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: m.direction === 'inbound' ? 'w_agent' : 'w_client'
        }));

        // 4. WhatsApp Status Update
        const whatsappStatus = await getEvolutionConnectionStateInternal(user);

        res.json({
            funnel: funnelData,
            overview: {
                activeConversations: activeConvsRes.rows[0].count,
                receivedMessages: msgsTodayRes.rows[0].count,
                attendedClients: attendedClientsRes.rows[0].count,
                newLeads: newLeadsRes.rows[0].count,
                whatsappStatus: whatsappStatus,
                followUpPending: followUpsStatRes.rows[0].pending,
                followUpOverdue: followUpsStatRes.rows[0].overdue
            },
            activities: recentActivities,
            followups: recentFollowUpsRes.rows
        });

    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};
