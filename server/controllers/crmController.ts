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

        // 1. DETECÇÃO DA INSTÂNCIA ATIVA (ROBUSTA)
        let activeInstanceId: number | null = null;
        let activeInstanceKey: string | null = null;
        let activeInstancePhone: string | null = null;
        let activeInstanceStatus: string = 'disconnected';

        if (user.role === 'SUPERADMIN' && !req.query.companyId) {
            // SuperAdmin Global Mode
            const settingsRes = await pool.query("SELECT value->>'instance_id' as id FROM system_settings WHERE key = 'integrai_official_instance'");
            if (settingsRes.rows.length > 0 && settingsRes.rows[0].id) {
                activeInstanceId = parseInt(settingsRes.rows[0].id);
            } else {
                const adminCompRes = await pool.query("SELECT whatsapp_instance_id FROM companies WHERE id = 1");
                activeInstanceId = adminCompRes.rows[0]?.whatsapp_instance_id;
            }
        } else if (companyId) {
            // Busca TODAS as instâncias da empresa para decidir qual usar
            const allInstancesRes = await pool.query(
                "SELECT id, instance_key, phone, status FROM company_instances WHERE company_id = $1 ORDER BY updated_at DESC",
                [companyId]
            );

            if (allInstancesRes.rows.length > 0) {
                const instances = allInstancesRes.rows;

                // 1. Tenta achar uma CONECTADA (open/connected)
                const connectedInst = instances.find(i => i.status && ['open', 'connected'].includes(i.status.toLowerCase()));

                if (connectedInst) {
                    activeInstanceId = connectedInst.id;
                    console.log(`[Dashboard] Selected CONNECTED instance: ${connectedInst.instance_key} (ID: ${connectedInst.id})`);
                } else {
                    // 2. Se não, tenta achar uma CONECTANDO (connecting/qrcode)
                    const connectingInst = instances.find(i => i.status && ['connecting', 'qrcode'].includes(i.status.toLowerCase()));

                    if (connectingInst) {
                        activeInstanceId = connectingInst.id;
                        console.log(`[Dashboard] Selected CONNECTING instance: ${connectingInst.instance_key} (ID: ${connectingInst.id}) fallback`);
                    } else {
                        // 3. Fallback final: A mais recente (topo da lista ordenada por updated_at)
                        activeInstanceId = instances[0].id;
                        console.log(`[Dashboard] Selected RECENT instance: ${instances[0].instance_key} (ID: ${instances[0].id}) fallback (offline)`);
                    }
                }
            } else {
                console.warn(`[Dashboard] No instances found for Company ID ${companyId}`);
            }
        }

        // BLOQUEIO DE SEGURANÇA
        if (!activeInstanceId) {
            console.warn(`[SECURITY] Dashboard access blocked — instance not resolved for user ${user.id}`);
            return res.status(403).json({
                error: 'Instance not resolved',
                message: "Conecte um número de WhatsApp via QR Code para visualizar os dados do dashboard."
            });
        }

        // Carrega metadados da instância ativa para exibição e uso como filtro de chave
        const activeInstRes = await pool.query("SELECT * FROM company_instances WHERE id = $1", [activeInstanceId]);
        const instanceData = activeInstRes.rows[0];
        if (!instanceData) {
            return res.status(403).json({
                error: 'Instance Data Not Found',
                message: "A instância configurada não foi encontrada no banco de dados."
            });
        }
        activeInstanceKey = instanceData.instance_key;
        activeInstancePhone = instanceData.phone;
        activeInstanceStatus = instanceData.status;


        // Helper para filtros
        const getFilter = (alias: string = '') => {
            const prefix = alias ? `${alias}.` : '';
            return companyId ? `${prefix}company_id = $1` : '1=1';
        };

        const activeParams = companyId ? [companyId] : [];
        const dateStart = startDate ? String(startDate) : new Date().toISOString().split('T')[0];
        const dateEnd = endDate ? String(endDate) : new Date().toISOString().split('T')[0];

        // Params padronizados para queries
        // $1 = companyId (se existir) ou ignore
        // $2 = activeInstanceKey
        // $3 = activeInstanceId
        // $4 = startDate
        // $5 = endDate

        // Como o número de params varia se companyId existe ou não, vamos construir dinamicamente
        const buildParams = (contextParams: any[], useKey: boolean, useId: boolean, useDate: boolean) => {
            const params = [...contextParams];
            if (useKey) params.push(activeInstanceKey);
            if (useId) params.push(activeInstanceId);
            if (useDate) params.push(dateStart, dateEnd);
            return params;
        };

        // 2. MÉTRICAS (Overview)

        // Conversas Ativas (status open/active)
        // Filtro por instance string/key (pois conversations não tem instance_id garantido em migration antiga)
        const activeConvsQuery = `
            SELECT COUNT(*) FROM whatsapp_conversations 
            WHERE ${getFilter('')} 
            AND (instance = $${activeParams.length + 1} OR last_instance_key = $${activeParams.length + 1})
            AND LOWER(status) IN ('open', 'active')
            AND (is_group = false OR is_group IS NULL) 
            AND phone NOT LIKE '%@g.us'
        `; // Params: [comp, key]
        const activeConvsRes = await pool.query(activeConvsQuery, [...activeParams, activeInstanceKey]);


        // Clientes Atendidos (status closed/resolved)
        const attendedQuery = `
            SELECT COUNT(*) FROM whatsapp_conversations 
            WHERE ${getFilter('')} 
            AND (instance = $${activeParams.length + 1} OR last_instance_key = $${activeParams.length + 1})
            AND LOWER(status) IN ('closed', 'resolved')
            AND closed_at::date BETWEEN $${activeParams.length + 2} AND $${activeParams.length + 3}
        `; // Params: [comp, key, start, end]
        const attendedRes = await pool.query(attendedQuery, [...activeParams, activeInstanceKey, dateStart, dateEnd]);


        // Mensagens Recebidas (Inbound) - Usa instance_id
        const receivedMsgsQuery = `
            SELECT COUNT(*) FROM whatsapp_messages 
            WHERE ${getFilter('')} 
            AND instance_id = $${activeParams.length + 1}
            AND direction = 'inbound'
            AND sent_at::date BETWEEN $${activeParams.length + 2} AND $${activeParams.length + 3}
        `; // Params: [comp, id, start, end]
        const receivedMsgsRes = await pool.query(receivedMsgsQuery, [...activeParams, activeInstanceId, dateStart, dateEnd]);


        // Mensagens Enviadas (Outbound) - Usa instance_id
        const sentMsgsQuery = `
            SELECT COUNT(*) FROM whatsapp_messages 
            WHERE ${getFilter('')} 
            AND instance_id = $${activeParams.length + 1}
            AND direction = 'outbound'
            AND sent_at::date BETWEEN $${activeParams.length + 2} AND $${activeParams.length + 3}
        `; // Params: [comp, id, start, end]
        const sentMsgsRes = await pool.query(sentMsgsQuery, [...activeParams, activeInstanceId, dateStart, dateEnd]);


        // Novos Leads - Usa instance key (schema legacy)
        const newLeadsQuery = `
            SELECT COUNT(*) FROM crm_leads 
            WHERE ${getFilter('')} 
            AND LOWER(instance) = LOWER($${activeParams.length + 1})
            AND created_at::date BETWEEN $${activeParams.length + 2} AND $${activeParams.length + 3}
            AND origin != 'Simulação'
        `; // Params: [comp, key, start, end]
        const newLeadsRes = await pool.query(newLeadsQuery, [...activeParams, activeInstanceKey, dateStart, dateEnd]);


        // Follow-ups summary
        // Filtra follow-ups linked to conversations of this instance OR generic company ones pending
        // Para ser restrito: JOINS conversations on this instance
        const followUpsQuery = `
            SELECT 
                COUNT(*) FILTER (WHERE f.status = 'pending') as pending,
                COUNT(*) FILTER (WHERE f.status = 'pending' AND f.scheduled_at < NOW()) as overdue
            FROM crm_follow_ups f
            LEFT JOIN whatsapp_conversations c ON f.conversation_id = c.id
            WHERE ${getFilter('f')}
            AND (
                c.id IS NULL OR 
                c.instance = $${activeParams.length + 1} OR 
                c.last_instance_key = $${activeParams.length + 1}
            )
        `; // Params: [comp, key]
        const followUpsStatRes = await pool.query(followUpsQuery, [...activeParams, activeInstanceKey]);


        // 3. FUNIL DE VENDAS
        const funnelQuery = `
            SELECT s.name as label, COUNT(l.id) as count, s.position
            FROM crm_stages s
            LEFT JOIN crm_leads l ON s.id = l.stage_id 
                AND l.company_id = $1 
                AND LOWER(l.instance) = LOWER($2) 
                AND l.origin != 'Simulação'
            WHERE s.company_id = $1
            GROUP BY s.id, s.name, s.position
            ORDER BY s.position ASC
        `; // Params: [comp, key]
        const funnelRes = await pool.query(funnelQuery, [...activeParams, activeInstanceKey]);

        const funnelData = funnelRes.rows.map((row, idx) => {
            const colors = ["border-blue-500", "border-indigo-500", "border-purple-500", "border-orange-500", "border-green-500"];
            return {
                label: row.label,
                count: parseInt(row.count),
                value: "R$ 0",
                color: colors[idx % colors.length],
                bg: colors[idx % colors.length].replace('border-', 'bg-') + '/10'
            };
        });


        // 4. CONVERSAS ATIVAS (LISTA LATERAL)
        // Somente open/active desta instancia
        const recentConvsQuery = `
            SELECT id, phone, contact_name, last_message, last_message_at, unread_count, profile_pic_url 
            FROM whatsapp_conversations
            WHERE ${getFilter('')}
            AND (instance = $${activeParams.length + 1} OR last_instance_key = $${activeParams.length + 1})
            AND LOWER(status) IN ('open', 'active')
            ORDER BY last_message_at DESC
            LIMIT 20
        `; // Params: [comp, key]
        const recentConvsRes = await pool.query(recentConvsQuery, [...activeParams, activeInstanceKey]);


        // 5. ATIVIDADE EM TEMPO REAL (MENSAGENS)
        // Usa instance_id
        const recentMsgsQuery = `
            SELECT m.content as text, m.sent_at, m.direction, c.phone, c.contact_name
            FROM whatsapp_messages m
            JOIN whatsapp_conversations c ON m.conversation_id = c.id
            WHERE ${getFilter('c')}
            AND m.instance_id = $${activeParams.length + 1}
            AND LOWER(c.status) IN ('open', 'active')
            ORDER BY m.sent_at DESC
            LIMIT 10
        `; // Params: [comp, id]
        const recentMsgsRes = await pool.query(recentMsgsQuery, [...activeParams, activeInstanceId]);

        const activities = recentMsgsRes.rows.map(m => ({
            type: m.direction === 'inbound' ? 'msg_in' : 'msg_out',
            user: m.contact_name || m.phone,
            text: m.text,
            time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: m.direction === 'inbound' ? 'w_agent' : 'w_client'
        }));


        // 6. FOLLOW-UPS LIST
        const recentFollowUpsRes = await pool.query(`
            SELECT f.*, COALESCE(l.name, c.contact_name) as contact_name
            FROM crm_follow_ups f
            LEFT JOIN crm_leads l ON f.lead_id = l.id
            LEFT JOIN whatsapp_conversations c ON f.conversation_id = c.id
            WHERE ${getFilter('f')}
            AND f.status = 'pending'
            AND (
                c.id IS NULL OR 
                c.instance = $${activeParams.length + 1} OR 
                c.last_instance_key = $${activeParams.length + 1}
            )
            ORDER BY f.scheduled_at ASC
            LIMIT 5
        `, [...activeParams, activeInstanceKey]);


        // 7. WhatsApp Status (Live Check Optional, but relying on DB status is faster for dashboard load)
        // We have activeInstanceStatus from DB ("connected", etc.) which is good enough for Overview.
        // For strict "Realtime", frontend can poll /instance/connectionState if needed, but DB status is preferred for speed.

        res.json({
            funnel: funnelData,
            overview: {
                activeConversations: activeConvsRes.rows[0]?.count || 0,
                attendedClients: attendedRes.rows[0]?.count || 0,
                receivedMessages: receivedMsgsRes.rows[0]?.count || 0,
                sentMessages: sentMsgsRes.rows[0]?.count || 0,
                newLeads: newLeadsRes.rows[0]?.count || 0,
                followUpPending: followUpsStatRes.rows[0]?.pending || 0,
                followUpOverdue: followUpsStatRes.rows[0]?.overdue || 0,

                // Metadata for Frontend Badge
                whatsappStatus: activeInstanceStatus,
                activeInstancePhone: activeInstancePhone,
                activeInstanceName: activeInstanceKey,
                activeInstanceId: activeInstanceId
            },
            activities: activities,
            conversations: recentConvsRes.rows,
            followups: recentFollowUpsRes.rows
        });

    } catch (error: any) {
        console.error('[CRITICAL] Dashboard error:', error);
        res.status(500).json({ error: 'Erro ao carregar dados do dashboard', details: error.message });
    }
};
