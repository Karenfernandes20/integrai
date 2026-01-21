import { Request, Response } from 'express';
import { pool } from '../db';

// Helper to get Evolution Config based on User Context (Replicated from evolutionController for speed/shared logic)
const DEFAULT_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";

const getEvolutionConfig = async (user: any, targetCompanyId?: string) => {
    let config = {
        url: process.env.EVOLUTION_API_URL || DEFAULT_URL,
        apikey: process.env.EVOLUTION_API_KEY,
        instance: "integrai"
    };

    if (pool) {
        try {
            // Priority 1: targetCompanyId (Explicitly requested by SuperAdmin)
            if (targetCompanyId && targetCompanyId !== 'superadmin-view') {
                const compRes = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1', [targetCompanyId]);
                if (compRes.rows.length > 0) {
                    const { evolution_instance, evolution_apikey } = compRes.rows[0];
                    if (evolution_instance && evolution_apikey) {
                        config.instance = evolution_instance;
                        config.apikey = evolution_apikey;
                        return config;
                    }
                }
            }

            // Priority 2: User Role context
            const role = (user?.role || '').toUpperCase();
            const isMasterUser = !user || role === 'SUPERADMIN' || role === 'ADMIN';

            if (isMasterUser) {
                config.instance = "integrai";

                // Priority for SuperAdmin: DB Key (Company 1) > ENV Key
                // Priority for SuperAdmin: DB Instance & Key (Company 1) > ENV Key
                const res = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = 1 LIMIT 1');
                if (res.rows.length > 0) {
                    if (res.rows[0].evolution_instance) {
                        config.instance = res.rows[0].evolution_instance;
                    }
                    if (res.rows[0].evolution_apikey) {
                        config.apikey = res.rows[0].evolution_apikey;
                    }
                }
                return config;
            }

            if (user && !isMasterUser) {
                const userRes = await pool.query('SELECT company_id FROM app_users WHERE id = $1', [user.id]);
                if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
                    const companyId = userRes.rows[0].company_id;

                    const compRes = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1', [companyId]);
                    if (compRes.rows.length > 0) {
                        const { evolution_instance, evolution_apikey } = compRes.rows[0];
                        if (evolution_instance && evolution_apikey) {
                            config.instance = evolution_instance;
                            config.apikey = evolution_apikey;
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error fetching company evolution config in CRM:", e);
        }
    }
    return config;
};

const getEvolutionConnectionStateInternal = async (user: any, targetCompanyId?: string) => {
    const config = await getEvolutionConfig(user, targetCompanyId);
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
            return `Offline (API ${response.status})`;
        }

        const data = await response.json();
        const rawState = data?.instance?.state || data?.state;

        console.log(`[CRM Dashboard] Instance '${instance}' Status: ${rawState}`);

        if (!rawState) return 'Offline (No State Data)';

        const state = String(rawState).toLowerCase();

        if (state === 'open' || state === 'connected') return 'Online';
        if (state === 'connecting') return 'Conectando';
        if (state === 'close') return 'Offline';
        if (state.includes('qr') || state.includes('scann')) return 'QR Code pendente';

        return `Offline (Raw: ${rawState})`;
    } catch (error: any) {
        console.error(`[CRM Dashboard] Exception checking status:`, error);
        return `Offline (Err: ${error.message})`;
    }
};

export const getStages = async (req: Request, res: Response) => {
    try {
        if (!pool) throw new Error('DB not configured');

        const user = (req as any).user;
        const companyId = user?.company_id;

        if (!companyId) {
            return res.status(400).json({ error: 'Company ID is required' });
        }

        // Get ONLY stages for this specific company
        let result = await pool.query(
            'SELECT * FROM crm_stages WHERE company_id = $1 ORDER BY position ASC',
            [companyId]
        );

        // Failsafe: Ensure LEADS stage exists specifically
        const hasLeads = result.rows.some(s => s.name.toUpperCase() === 'LEADS');

        if (!hasLeads) {
            console.log(`[CRM] No LEADS stage found for company ${companyId}. Creating it.`);
            await pool.query(
                `INSERT INTO crm_stages (name, position, color, company_id) 
                 VALUES ($1, $2, $3, $4)`,
                ['LEADS', 0, '#cbd5e1', companyId]
            );

            // Re-fetch stages after creation
            result = await pool.query(
                'SELECT * FROM crm_stages WHERE company_id = $1 ORDER BY position ASC',
                [companyId]
            );
        }

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching stages, returning MOCK:', error);
        // MOCK DATA FALLBACK
        res.json([
            { id: 1, name: 'LEADS', color: '#cbd5e1', position: 0 },
            { id: 2, name: 'Interesse', color: '#3b82f6', position: 1 },
            { id: 3, name: 'Negociação', color: '#f59e0b', position: 2 },
            { id: 4, name: 'Fechado', color: '#22c55e', position: 3 }
        ]);
    }
};

export const getLeads = async (req: Request, res: Response) => {
    try {
        if (!pool) throw new Error('DB not configured');

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
            ) as follow_up_date,
            (
                SELECT COALESCE(ci.name, wc.instance)
                FROM whatsapp_conversations wc
                LEFT JOIN company_instances ci ON wc.instance = ci.instance_key
                WHERE wc.phone = l.phone AND wc.company_id = l.company_id 
                ORDER BY wc.last_message_at DESC LIMIT 1
            ) as instance_friendly_name,
            (
                SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                FROM crm_tags t
                JOIN crm_lead_tags lt ON lt.tag_id = t.id
                WHERE lt.lead_id = l.id
            ) as tags
            FROM crm_leads l
            LEFT JOIN crm_stages s ON l.stage_id = s.id
            WHERE 1=1
        `;
        const params: any[] = [];

        // If user is NOT a SuperAdmin, OR if they have a company_id, filter by company
        if (user.role !== 'SUPERADMIN') {
            query += ` AND l.company_id = $1`;
            params.push(companyId);
        } else if (companyId) {
            // SuperAdmin with company_id: show only that company's leads
            query += ` AND l.company_id = $1`;
            params.push(companyId);
        }
        // SuperAdmin without company_id: show ALL leads (no filter)

        query += ` ORDER BY l.updated_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching leads, returning MOCK:', error);
        // MOCK DATA FALLBACK
        res.json([
            {
                id: 1,
                name: 'Cliente Exemplo (Offline)',
                phone: '5511999999999',
                stage_id: 1,
                value: 1500.00,
                description: 'Este lead é simulado pois o banco está offline',
                origin: 'Simulação',
                created_at: new Date().toISOString()
            }
        ]);
    }
};

export const updateLeadStage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const { stageId } = req.body;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        if (!stageId) {
            return res.status(400).json({ error: 'stageId is required' });
        }

        // Access Check
        const checkLead = await pool.query('SELECT company_id FROM crm_leads WHERE id = $1', [id]);
        if (checkLead.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });

        if (!isSuperAdmin && checkLead.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool.query(
            'UPDATE crm_leads SET stage_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [stageId, id]
        );

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
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Access Check
        const checkLead = await pool.query('SELECT company_id FROM crm_leads WHERE id = $1', [id]);
        if (checkLead.rowCount === 0) return res.status(404).json({ error: 'Lead not found' });

        if (!isSuperAdmin && checkLead.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

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

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
};

export const createStage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { name, color } = req.body;
        const user = (req as any).user;
        const companyId = user?.company_id;

        if (!companyId) {
            return res.status(400).json({ error: 'Company ID is required' });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }

        // Define próxima posição após a última fase existente DA EMPRESA
        const posResult = await pool.query(
            'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM crm_stages WHERE company_id = $1',
            [companyId]
        );
        const nextPos = posResult.rows[0].next_pos as number;

        const insertResult = await pool.query(
            'INSERT INTO crm_stages (name, position, company_id, color) VALUES ($1, $2, $3, $4) RETURNING *',
            [name.trim(), nextPos, companyId, color || '#cbd5e1']
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
        const user = (req as any).user;
        const companyId = user?.company_id;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // 1. Check if stage exists and get details
        const stageRes = await pool.query('SELECT * FROM crm_stages WHERE id = $1', [id]);
        if (stageRes.rows.length === 0) {
            return res.status(404).json({ error: 'Stage not found' });
        }
        const stageToDelete = stageRes.rows[0];

        // Access Check
        if (!isSuperAdmin && stageToDelete.company_id !== companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // 2. Prevent deleting "LEADS" (system stage) - case insensitive
        if (stageToDelete.name.toUpperCase() === 'LEADS') {
            return res.status(400).json({ error: 'Não é permitido excluir a fase LEADS.' });
        }

        // 3. Move leads to "LEADS" stage within same company
        const defaultStageRes = await pool.query(
            `SELECT id FROM crm_stages WHERE UPPER(name) = 'LEADS' AND company_id = $1 LIMIT 1`,
            [companyId]
        );
        let fallbackStageId = defaultStageRes.rows.length > 0 ? defaultStageRes.rows[0].id : null;

        if (!fallbackStageId) {
            // Fallback to any other stage of the same company that is not being deleted
            const specificRes = await pool.query(
                'SELECT id FROM crm_stages WHERE id != $1 AND company_id = $2 ORDER BY position ASC LIMIT 1',
                [id, companyId]
            );
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
        let companyId = user?.company_id;

        // Allow SuperAdmin to override companyId via query param
        if (user.role === 'SUPERADMIN' && req.query.companyId) {
            companyId = req.query.companyId;
        }

        const { startDate, endDate } = req.query;

        // Helper to generate safe filter clause with table alias
        const getFilter = (alias: string = '') => {
            const prefix = alias ? `${alias}.` : '';
            return companyId ? `${prefix}company_id = $1` : '1=1';
        };

        // TARGET INSTANCE LOGIC FOR FILTERING
        let targetInstance: string | null = null;
        if (companyId && pool) {
            const instRes = await pool.query('SELECT evolution_instance FROM companies WHERE id = $1', [companyId]);
            if (instRes.rows.length > 0) {
                targetInstance = instRes.rows[0].evolution_instance;
            }
        }

        const filterParams = companyId ? [companyId] : [];
        let dateFilterParams = [...filterParams]; // Copy for date-dependent queries in case we need index shifting if necessary, but here we can just append if strict order

        // However, pg node driver uses $1, $2. So we need to be careful with index.
        // Let's create specific parameter sets for each query to avoid index confusion.

        // Base Params for Company Filter
        const baseParams = companyId ? [companyId] : [];

        // Date Logic
        let dateCondition = "current_date";
        let dateParams = [...baseParams];
        let dateParamStartIndex = baseParams.length + 1;

        if (startDate && endDate) {
            dateCondition = `$${dateParamStartIndex}::date AND $${dateParamStartIndex + 1}::date`; // BETWEEN $2 AND $3
            dateParams.push(String(startDate), String(endDate));
        } else {
            dateCondition = "CURRENT_DATE"; // Default to Today if no range
        }


        // 1. Funnel Data (Stages + Lead Counts)
        // Note: Funnel counts leads. Filters: Company + Instance (if applicable)
        let funnelParams = [...baseParams];
        let funnelInstanceFilter = '';
        if (targetInstance) {
            funnelParams.push(targetInstance);
            funnelInstanceFilter = ` AND l.instance = $${funnelParams.length}`;
        }

        let funnelRes;
        if (companyId) {
            funnelRes = await pool.query(`
                SELECT s.name as label, COUNT(l.id) as count, s.position
                FROM crm_stages s
                LEFT JOIN crm_leads l ON s.id = l.stage_id AND l.company_id = $1 ${funnelInstanceFilter} AND l.origin != 'Simulação'
                WHERE s.company_id = $1
                GROUP BY s.id, s.name, s.position
                ORDER BY s.position ASC
            `, funnelParams);
        } else {
            funnelRes = await pool.query(`
                SELECT name as label, COUNT(id) as count, 0 as position
                FROM crm_leads
                GROUP BY name
                LIMIT 0
            `);
        }

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

        // Active Conversas Params
        let activeParams = [...baseParams];
        let activeInstanceFilter = '';
        if (targetInstance) {
            activeParams.push(targetInstance);
            activeInstanceFilter = ` AND instance = $${activeParams.length}`;
        }

        const activeConvsRes = await pool.query(`
            SELECT COUNT(*) FROM whatsapp_conversations 
            WHERE ${getFilter('')} 
            ${activeInstanceFilter}
            AND status = 'OPEN'
            AND (is_group = false OR is_group IS NULL) 
            AND phone NOT LIKE '%@g.us'
        `, activeParams);

        // Messages Today Params
        // Base ($1) + Instance? + Date1 + Date2
        let msgsParams = [...baseParams];
        let msgsInstanceFilter = '';
        if (targetInstance) {
            msgsParams.push(targetInstance);
            msgsInstanceFilter = ` AND c.instance = $${msgsParams.length}`;
        }

        // Add dates
        let msgsDateCondition = "CURRENT_DATE";
        if (startDate && endDate) {
            msgsParams.push(String(startDate), String(endDate));
            msgsDateCondition = `$${msgsParams.length - 1}::date AND $${msgsParams.length}::date`;
        } else {
            msgsDateCondition = "CURRENT_DATE";
        }

        const msgsTodayRes = await pool.query(`
            SELECT COUNT(*) FROM whatsapp_messages m
            JOIN whatsapp_conversations c ON m.conversation_id = c.id
            WHERE ${getFilter('c')}
            ${msgsInstanceFilter}
            AND (c.is_group = false OR c.is_group IS NULL)
            AND c.phone NOT LIKE '%@g.us'
            AND m.direction = 'inbound' 
            AND m.sent_at::date BETWEEN ${startDate && endDate ? msgsDateCondition : 'CURRENT_DATE AND CURRENT_DATE'}
        `, msgsParams);

        // New Leads Params
        let leadsParams = [...baseParams];
        let leadsInstanceFilter = '';
        if (targetInstance) {
            leadsParams.push(targetInstance);
            leadsInstanceFilter = ` AND instance = $${leadsParams.length}`;
        }

        let leadsDateCondition = "CURRENT_DATE";
        if (startDate && endDate) {
            leadsParams.push(String(startDate), String(endDate));
            leadsDateCondition = `$${leadsParams.length - 1}::date AND $${leadsParams.length}::date`;
        }

        const newLeadsRes = await pool.query(`
            SELECT COUNT(*) FROM crm_leads 
            WHERE ${getFilter('')}
            ${leadsInstanceFilter}
            AND created_at::date BETWEEN ${startDate && endDate ? leadsDateCondition : 'CURRENT_DATE AND CURRENT_DATE'}
            AND phone NOT LIKE '%@g.us'
            AND origin != 'Simulação'
        `, leadsParams);

        // Attended Clients Params
        // Same structure as msgsParams
        let attendedParams = [...baseParams];
        let attendedInstanceFilter = '';
        if (targetInstance) {
            attendedParams.push(targetInstance);
            attendedInstanceFilter = ` AND c.instance = $${attendedParams.length}`;
        }

        let attendedDateCondition = "CURRENT_DATE";
        if (startDate && endDate) {
            attendedParams.push(String(startDate), String(endDate));
            attendedDateCondition = `$${attendedParams.length - 1}::date AND $${attendedParams.length}::date`;
        }

        const attendedClientsRes = await pool.query(`
             SELECT COUNT(DISTINCT m.conversation_id) 
             FROM whatsapp_messages m
             JOIN whatsapp_conversations c ON m.conversation_id = c.id
             WHERE ${getFilter('c')}
             ${attendedInstanceFilter}
             AND (c.is_group = false OR c.is_group IS NULL) 
             AND c.phone NOT LIKE '%@g.us'
             AND m.direction = 'outbound' 
             AND m.sent_at::date BETWEEN ${startDate && endDate ? attendedDateCondition : 'CURRENT_DATE AND CURRENT_DATE'}
        `, attendedParams);

        // Follow-ups summary
        const followUpsStatRes = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'pending' AND scheduled_at < NOW()) as overdue
            FROM crm_follow_ups
            WHERE ${getFilter('')}
        `, baseParams);

        const recentFollowUpsRes = await pool.query(`
            SELECT f.*, COALESCE(l.name, c.contact_name) as contact_name
            FROM crm_follow_ups f
            LEFT JOIN crm_leads l ON f.lead_id = l.id
            LEFT JOIN whatsapp_conversations c ON f.conversation_id = c.id
            WHERE ${getFilter('f')}
            AND f.status = 'pending'
            ORDER BY f.scheduled_at ASC
            LIMIT 5
        `, filterParams);

        // 3. Realtime Activities
        // 3. Realtime Activities
        // Params management for Recent Activities
        let recentParams = [...baseParams];
        let recentInstanceFilter = '';
        if (targetInstance) {
            recentParams.push(targetInstance);
            recentInstanceFilter = ` AND c.instance = $${recentParams.length}`;
        }

        const recentMsgsRes = await pool.query(`
             SELECT m.content as text, m.sent_at, m.direction, c.phone, c.contact_name
             FROM whatsapp_messages m
             JOIN whatsapp_conversations c ON m.conversation_id = c.id
             WHERE ${getFilter('c')}
             ${recentInstanceFilter}
             AND c.status = 'OPEN'
             AND (c.is_group = false OR c.is_group IS NULL)
             AND c.phone NOT LIKE '%@g.us'
             ORDER BY m.sent_at DESC
             LIMIT 5
        `, recentParams);

        const recentActivities = recentMsgsRes.rows.map(m => ({
            type: m.direction === 'inbound' ? 'msg_in' : 'msg_out',
            user: m.contact_name || m.phone,
            text: m.text,
            time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: m.direction === 'inbound' ? 'w_agent' : 'w_client'
        }));

        // 4. WhatsApp Status Update
        const whatsappStatus = await getEvolutionConnectionStateInternal(user, companyId);

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
        console.error('Error fetching dashboard stats, returning MOCK:', error);
        // MOCK DATA FALLBACK
        res.json({
            funnel: [
                { label: 'LEADS', count: 10, value: 'R$ 15000', color: 'border-blue-500', bg: 'bg-blue-50' },
                { label: 'Negociação', count: 5, value: 'R$ 7500', color: 'border-orange-500', bg: 'bg-orange-50' },
                { label: 'Fechado', count: 2, value: 'R$ 3000', color: 'border-green-500', bg: 'bg-green-50' }
            ],
            overview: {
                activeConversations: 12,
                receivedMessages: 45,
                attendedClients: 8,
                newLeads: 3,
                whatsappStatus: `Error: ${error.message || 'Unknown'}`,
                followUpPending: 2,
                followUpOverdue: 1
            },
            activities: [
                { type: 'msg_in', user: 'Cliente Exemplo', text: 'Olá, gostaria de saber mais.', time: '10:30', status: 'w_client' },
                { type: 'msg_out', user: 'Atendente', text: 'Claro, como posso ajudar?', time: '10:31', status: 'w_agent' }
            ],
            followups: []
        });
    }
};
