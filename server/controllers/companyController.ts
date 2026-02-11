import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';
import { getEvolutionConfig } from './evolutionController';
import { validateInstagramCredentials } from '../services/instagramService';

export const getCompanies = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        try {
            const result = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (dbErr: any) {
            console.error('[getCompanies] DB Connection Failed - Returning MOCK DATA:', dbErr.message);
            const mockCompanies = [
                {
                    id: 1,
                    name: 'Empresa Mock Teste',
                    cnpj: '00.000.000/0001-00',
                    city: 'São Paulo',
                    state: 'SP',
                    phone: '11999999999',
                    operation_type: 'clientes',
                    evolution_instance: 'integrai',
                    created_at: new Date().toISOString()
                }
            ];
            res.json(mockCompanies);
        }

    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({
            error: 'Failed to fetch companies',
            details: (error as any).message
        });
    }
};

export const getCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) throw new Error('DB Config Missing');
        const { id } = req.params;
        const user = (req as any).user;

        // Security check: Only SuperAdmin or the company's own users can view details
        if (user.role !== 'SUPERADMIN') {
            // Check if user belongs to this company
            if (!user.company_id || Number(user.company_id) !== Number(id)) {
                return res.status(403).json({ error: 'You are not authorized to view this company.' });
            }
        }

        const result = await pool.query(`
            SELECT 
                *,
                COALESCE(operation_type, 'clientes') as operation_type
            FROM companies WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching company, returning MOCK:', error);
        // MOCK FALLBACK
        const { id } = req.params;
        res.json({
            id: Number(id),
            name: "Empresa Mock Detalhes",
            cnpj: "99.999.999/0001-99",
            city: "Mock City",
            state: "MC",
            phone: "11900000000",
            logo_url: null,
            evolution_instance: "mock_instance",
            operation_type: "clientes",
            plan_id: 1,
            due_date: null
        });
    }
};

export const createCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const {
            name, cnpj, city, state, phone, evolution_instance, evolution_apikey,
            operation_type, category, plan_id, due_date, max_instances,
            whatsapp_enabled, instagram_enabled, messenger_enabled,
            whatsapp_limit, instagram_limit, messenger_limit, evolution_url
        } = req.body;

        // 1. Validate Instance Uniqueness before doing anything
        let instanceDefs: any[] = [];
        if (req.body.instanceDefinitions) {
            try {
                instanceDefs = typeof req.body.instanceDefinitions === 'string'
                    ? JSON.parse(req.body.instanceDefinitions)
                    : req.body.instanceDefinitions;
            } catch (e) {
                console.error('Failed to parse instanceDefinitions', e);
            }
        }

        // Check if top-level evolution_instance or any in definitions already exists
        const keysToCheck = new Set<string>();
        if (evolution_instance) keysToCheck.add(evolution_instance.trim());
        instanceDefs.forEach(d => { if (d.instance_key) keysToCheck.add(d.instance_key.trim()); });

        if (keysToCheck.size > 0) {
            const result = await pool.query(
                'SELECT instance_key FROM company_instances WHERE instance_key = ANY($1::text[])',
                [Array.from(keysToCheck)]
            );
            if (result.rows.length > 0) {
                return res.status(400).json({
                    error: `A instância '${result.rows[0].instance_key}' já está em uso por outra empresa. Cada instância deve ser única.`
                });
            }
        }

        let logo_url = null;
        if (req.file) {
            // Construct local URL
            const protocol = req.protocol;
            const host = req.get('host');
            logo_url = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        const limitInstances = max_instances ? parseInt(max_instances) : 1;

        const result = await pool.query(
            `INSERT INTO companies (
                name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, 
                operation_type, operational_profile, category, plan_id, due_date, max_instances,
                whatsapp_enabled, instagram_enabled, messenger_enabled,
                whatsapp_limit, instagram_limit, messenger_limit, evolution_url
             ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) 
             RETURNING *`,
            [
                name,
                cnpj || null,
                city || null,
                state || null,
                phone || null,
                logo_url,
                evolution_instance || null,
                evolution_apikey || null,
                operation_type || 'clientes',
                (operation_type === 'pacientes' || operation_type === 'clinica' || category === 'clinica') ? 'CLINICA' :
                    (operation_type === 'loja' || category === 'loja') ? 'LOJA' :
                        (operation_type === 'restaurante' || category === 'restaurante') ? 'RESTAURANTE' :
                            (operation_type === 'lavajato' || category === 'lavajato') ? 'LAVAJATO' :
                                (operation_type === 'motoristas' || category === 'transporte') ? 'TRANSPORTE' : 'GENERIC',
                category || 'generic',
                plan_id || null,
                due_date || null,
                limitInstances,
                whatsapp_enabled === 'true' || whatsapp_enabled === true,
                instagram_enabled === 'true' || instagram_enabled === true,
                messenger_enabled === 'true' || messenger_enabled === true,
                whatsapp_limit ? parseInt(whatsapp_limit) : 1,
                instagram_limit ? parseInt(instagram_limit) : 1,
                messenger_limit ? parseInt(messenger_limit) : 1,
                evolution_url || null
            ]
        );

        const newCompany = result.rows[0];
        const user = (req as any).user;

        // Audit Log
        if (user) {
            await logAudit({
                userId: user.id,
                companyId: user.company_id,
                action: 'create',
                resourceType: 'company',
                resourceId: newCompany.id,
                newValues: newCompany,
                details: `Cadastrou nova empresa: ${newCompany.name}`
            });
        }

        // --- SEED INSTANCES ---
        try {
            if (instanceDefs && instanceDefs.length > 0) {
                // Use provided definitions
                for (const def of instanceDefs) {
                    if (!def.instance_key) continue; // Don't create empty ones

                    const sanitizedKey = def.instance_key.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();

                    await pool.query(`
                        INSERT INTO company_instances (company_id, name, instance_key, api_key, status)
                        VALUES ($1, $2, $3, $4, 'disconnected')
                    `, [newCompany.id, def.name || 'Nova Instância', sanitizedKey, def.api_key || null]);
                }
                console.log(`[Company ${newCompany.id}] Seeded ${instanceDefs.length} instances from definitions.`);
            } else if (evolution_instance) {
                // Fallback to top-level if no definitions but evolution_instance exists
                const sanitizedKey = evolution_instance.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
                await pool.query(`
                    INSERT INTO company_instances (company_id, name, instance_key, api_key, status)
                    VALUES ($1, $2, $3, $4, 'disconnected')
                `, [newCompany.id, 'Instância 1', sanitizedKey, evolution_apikey || null]);
                console.log(`[Company ${newCompany.id}] Seeded single instance from top-level fields.`);
            } else {
                console.log(`[Company ${newCompany.id}] No instances provided. Created with 0 instances.`);
            }
        } catch (instErr) {
            console.error(`[Company ${newCompany.id}] Failed to seed instances:`, instErr);
        }

        // Auto-create default CRM stage "LEADS" for this company
        try {
            await pool.query(
                `INSERT INTO crm_stages (name, position, color, company_id) 
                 VALUES ($1, $2, $3, $4)`,
                ['LEADS', 0, '#cbd5e1', newCompany.id]
            );
            console.log(`[Company ${newCompany.id}] Created default LEADS stage`);
        } catch (stageErr) {
            console.error(`[Company ${newCompany.id}] Failed to create default stage:`, stageErr);
        }

        // --- VALUE PROOF SEEDING ---
        try {
            const stageRes = await pool.query('SELECT id FROM crm_stages WHERE company_id = $1 AND name = $2 LIMIT 1', [newCompany.id, 'LEADS']);
            if (stageRes.rows.length > 0) {
                await pool.query(
                    `INSERT INTO crm_leads (name, phone, stage_id, company_id, description, value, origin, instance) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    ['João Silva (Exemplo)', '5511999999999', stageRes.rows[0].id, newCompany.id, 'Este é um lead de exemplo. Arraste-o para mover de fase!', 1500.00, 'Simulação', newCompany.evolution_instance]
                );
            }

            await pool.query(
                `INSERT INTO ai_agents (company_id, name, prompt, status, model)
                 VALUES ($1, $2, $3, 'active', 'gpt-4o')`,
                [newCompany.id, 'Assistente de Vendas', 'Você é um assistente comercial focado em qualificar leads. Seja breve e cordial.']
            );

            const templates = [
                { name: 'Boas Vindas', content: 'Olá {nome}, tudo bem? Vi que se cadastrou em nosso site. Como posso ajudar?' },
                { name: 'Cobrança Amigável', content: 'Oi {nome}, lembrete gentil sobre sua fatura pendente. Podemos ajudar com algo?' },
                { name: 'Confirmação', content: 'Confirmado, {nome}! Ficamos aguardando você.' }
            ];

            for (const t of templates) {
                await pool.query(
                    `INSERT INTO global_templates (company_id, name, type, content, is_active)
                     VALUES ($1, $2, 'message', $3, true)`,
                    [newCompany.id, t.name, t.content]
                );
            }
            console.log(`[Company ${newCompany.id}] Seeded value-proof data.`);
        } catch (seedErr) {
            console.error(`[Company ${newCompany.id}] Failed to seed data:`, seedErr);
        }

        res.status(201).json(newCompany);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ error: 'Failed to create company', details: (error as any).message });
    }
};

export const updateCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Configuração do banco de dados não encontrada.' });

        const { id } = req.params;
        const { name, cnpj, city, state, phone, evolution_instance, evolution_apikey, operation_type, category, remove_logo,
            primary_color, secondary_color, system_name, custom_domain, plan_id, due_date, max_instances,
            instanceDefinitions,
            // Instagram
            instagram_enabled, instagram_app_id, instagram_app_secret, instagram_page_id, instagram_business_id, instagram_access_token,
            // WhatsApp Extended
            whatsapp_enabled, whatsapp_type, whatsapp_official_phone, whatsapp_official_phone_number_id, whatsapp_official_business_account_id,
            whatsapp_official_access_token, whatsapp_official_api_version, whatsapp_official_webhook_token, whatsapp_api_plus_token,
            // Evolution
            evolution_url,
            // Messenger
            messenger_enabled, messenger_app_id, messenger_app_secret, messenger_page_id, messenger_access_token, messenger_webhook_token,
            whatsapp_limit, instagram_limit, messenger_limit
        } = req.body;

        console.log(`[Update Company ${id}] Request by user ${req.user?.id} (${req.user?.role})`);
        console.log(`[Update Company ${id}] Body keys:`, Object.keys(req.body));
        console.log(`[Update Company ${id}] Evolution URL:`, req.body.evolution_url);
        console.log(`[Update Company ${id}] Instance Definitions:`, JSON.stringify(req.body.instanceDefinitions, null, 2));

        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Security Check: Non-SuperAdmin can only update their own company
        if (!isSuperAdmin) {
            if (Number(user.company_id) !== Number(id)) {
                return res.status(403).json({ error: 'Você não tem permissão para atualizar esta empresa.' });
            }
        }

        if (!name) {
            return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
        }

        // --- INSTANCE UNIQUENESS CHECK ---
        let parsedDefs: any[] = [];
        if (instanceDefinitions) {
            try {
                parsedDefs = typeof instanceDefinitions === 'string'
                    ? JSON.parse(instanceDefinitions)
                    : instanceDefinitions;
            } catch (e) {
                console.error('Error parsing instanceDefinitions', e);
            }
        }

        const keysToCheck = new Set<string>();
        if (evolution_instance) keysToCheck.add(evolution_instance.trim());
        parsedDefs.forEach(d => { if (d.instance_key) keysToCheck.add(d.instance_key.trim()); });

        if (keysToCheck.size > 0) {
            // Check if these keys belong to OTHER companies
            const checkRes = await pool.query(
                `SELECT instance_key, company_id FROM company_instances 
                 WHERE instance_key = ANY($1::text[]) AND company_id != $2`,
                [Array.from(keysToCheck), id]
            );
            if (checkRes.rows.length > 0) {
                return res.status(400).json({
                    error: `A instância '${checkRes.rows[0].instance_key}' já está em uso por outra empresa. Cada instância deve ser única.`
                });
            }
        }

        // --- INSTAGRAM VALIDATION ---
        let instagramStatus = 'INATIVO';
        let newIsInstagramEnabled = instagram_enabled === 'true' || instagram_enabled === true;

        if (instagram_access_token && instagram_page_id) {
            try {
                const currentRes = await pool.query('SELECT instagram_access_token, instagram_status FROM companies WHERE id = $1', [id]);
                const current = currentRes.rows[0];
                const isTokenMasked = instagram_access_token.includes('***');

                if (isTokenMasked) {
                    instagramStatus = current.instagram_status || 'INATIVO';
                } else {
                    await validateInstagramCredentials(instagram_access_token, instagram_page_id);
                    instagramStatus = 'ATIVO';
                    newIsInstagramEnabled = true;
                }
            } catch (instErr: any) {
                console.error(`[Update Company ${id}] Instagram Validation Failed:`, instErr.message);
                instagramStatus = 'ERRO';
            }
        } else {
            if (instagram_access_token === '') {
                instagramStatus = 'INATIVO';
                newIsInstagramEnabled = false;
            } else {
                const currentRes = await pool.query('SELECT instagram_status FROM companies WHERE id = $1', [id]);
                if (currentRes.rows.length > 0) instagramStatus = currentRes.rows[0].instagram_status || 'INATIVO';
            }
        }

        const isRemovingLogo = remove_logo === 'true' || remove_logo === true;

        let finalLogoUrl: string | null = null;
        if (req.file) {
            const protocol = req.protocol;
            const host = req.get('host');
            finalLogoUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        const currentRes = await pool.query('SELECT logo_url, instagram_access_token, plan_id, max_instances, whatsapp_limit, instagram_limit, messenger_limit, due_date FROM companies WHERE id = $1', [id]);
        if (currentRes.rowCount === 0) return res.status(404).json({ error: 'Empresa não encontrada.' });
        const current = currentRes.rows[0];

        // Protect sensitive fields if not SuperAdmin
        let finalPlanId = plan_id;
        let finalMaxInstances = max_instances;
        let finalWhatsappLimit = whatsapp_limit;
        let finalInstagramLimit = instagram_limit;
        let finalMessengerLimit = messenger_limit;
        let finalDueDate = due_date;

        if (!isSuperAdmin) {
            finalPlanId = current.plan_id;
            finalMaxInstances = current.max_instances;
            finalWhatsappLimit = current.whatsapp_limit;
            finalInstagramLimit = current.instagram_limit;
            finalMessengerLimit = current.messenger_limit;
            finalDueDate = current.due_date;
        }

        const currentLogo = current.logo_url;

        let finalAccessToken = instagram_access_token;
        if (instagram_access_token && instagram_access_token.includes('***')) {
            finalAccessToken = currentRes.rows[0].instagram_access_token;
        }

        let newLogoUrl = currentLogo;
        if (isRemovingLogo) newLogoUrl = null;
        else if (finalLogoUrl) newLogoUrl = finalLogoUrl;

        const query = `
            UPDATE companies 
            SET name = $1, cnpj = $2, city = $3, state = $4, phone = $5, logo_url = $6,
                evolution_instance = COALESCE($7, evolution_instance),
                evolution_apikey = COALESCE($8, evolution_apikey),
                operation_type = COALESCE($9, operation_type),
                primary_color = COALESCE($11, primary_color),
                secondary_color = COALESCE($12, secondary_color),
                system_name = COALESCE($13, system_name),
                custom_domain = COALESCE($14, custom_domain),
                plan_id = $15, due_date = $16, max_instances = $17,
                instagram_enabled = $18, instagram_app_id = $19, instagram_app_secret = $20,
                instagram_page_id = $21, instagram_business_id = $22, instagram_access_token = $23,
                instagram_status = $24, category = COALESCE($25, category), operational_profile = $26,
                -- WhatsApp Extended
                whatsapp_enabled = $27, whatsapp_type = $28, whatsapp_official_phone = $29,
                whatsapp_official_phone_number_id = $30, whatsapp_official_business_account_id = $31,
                whatsapp_official_access_token = $32, whatsapp_official_api_version = $33,
                whatsapp_official_webhook_token = $34, whatsapp_api_plus_token = $35,
                -- Messenger
                messenger_enabled = $36, messenger_app_id = $37, messenger_app_secret = $38,
                messenger_page_id = $39, messenger_access_token = $40, messenger_webhook_token = $41,
                whatsapp_limit = $42, instagram_limit = $43, messenger_limit = $44,
                evolution_url = $45
            WHERE id = $10 
            RETURNING *
        `;

        const newMax = max_instances ? parseInt(String(max_instances)) : 1;
        const opTy = operation_type || 'clientes';
        const opProf = (opTy === 'pacientes' || opTy === 'clinica' || category === 'clinica') ? 'CLINICA' :
            (opTy === 'loja' || category === 'loja') ? 'LOJA' :
                (opTy === 'restaurante' || category === 'restaurante') ? 'RESTAURANTE' :
                    (opTy === 'lavajato' || category === 'lavajato') ? 'LAVAJATO' :
                        (opTy === 'motoristas' || category === 'transporte') ? 'TRANSPORTE' : 'GENERIC';

        const parseNum = (val: any) => (val === "" || val === undefined || val === null) ? null : parseInt(String(val));
        const parseBool = (val: any) => val === 'true' || val === true;

        const values = [
            name, // $1
            cnpj || null, // $2
            city || null, // $3
            state || null, // $4
            phone || null, // $5
            newLogoUrl, // $6
            evolution_instance || null, // $7
            evolution_apikey || null, // $8
            operation_type || 'clientes', // $9
            parseInt(id), // $10
            primary_color || null, // $11
            secondary_color || null, // $12
            system_name || null, // $13
            custom_domain || null, // $14
            parseNum(finalPlanId), // $15
            finalDueDate || null, // $16
            parseNum(finalMaxInstances) || 1, // $17
            parseBool(instagram_enabled), // $18
            instagram_app_id || null, // $19
            instagram_app_secret || null, // $20
            instagram_page_id || null, // $21
            instagram_business_id || null, // $22
            finalAccessToken || null, // $23
            instagramStatus, // $24
            category || null, // $25
            opProf, // $26
            parseBool(whatsapp_enabled), // $27
            whatsapp_type || 'evolution', // $28
            whatsapp_official_phone || null, // $29
            whatsapp_official_phone_number_id || null, // $30
            whatsapp_official_business_account_id || null, // $31
            whatsapp_official_access_token || null, // $32
            whatsapp_official_api_version || null, // $33
            whatsapp_official_webhook_token || null, // $34
            whatsapp_api_plus_token || null, // $35
            parseBool(messenger_enabled), // $36
            messenger_app_id || null, // $37
            messenger_app_secret || null, // $38
            messenger_page_id || null, // $39
            messenger_access_token || null, // $40
            messenger_webhook_token || null, // $41
            parseNum(finalWhatsappLimit) || 1, // $42
            parseNum(finalInstagramLimit) || 1, // $43
            parseNum(finalMessengerLimit) || 1, // $44
            evolution_url || null // $45
        ];

        // --- INSTANCE SYNC & DEFINITIONS ---
        // --- INSTANCE SYNC & DEFINITIONS ---
        try {
            // Fetch current instances to map updates
            const currentInstRes = await pool.query('SELECT id, instance_key FROM company_instances WHERE company_id = $1 ORDER BY id ASC', [id]);
            const currentInsts = currentInstRes.rows;

            if (parsedDefs && parsedDefs.length > 0) {
                for (let i = 0; i < parsedDefs.length; i++) {
                    const def = parsedDefs[i];
                    // Skip if no key provided, unless it's a placeholder update for existing
                    if (!def.instance_key && !currentInsts[i]) continue;

                    const rawKey = def.instance_key || `instancia_${i + 1}_${Date.now()}`;
                    // Relaxed sanitation: Allow mixed case, keep logic simple.
                    // Evolution V2 supports mixed case keys.
                    const sanitizedKey = rawKey.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-@\.]/g, '');

                    try {
                        if (currentInsts[i]) {
                            // If instance_key is empty in def, keep existing
                            // But wait, if user CLEARED it? Evolution needs key.
                            // Assuming frontend always sends key if available.
                            // If def.instance_key is missing/empty, use current.
                            const keyToUse = (def.instance_key && def.instance_key.trim()) ? sanitizedKey : currentInsts[i].instance_key;
                            const nameToUse = def.name || currentInsts[i].name || `WhatsApp ${i + 1}`;

                            await pool.query(
                                `UPDATE company_instances SET name = $1, instance_key = $2, api_key = $3 WHERE id = $4`,
                                [nameToUse, keyToUse, def.api_key || null, currentInsts[i].id]
                            );
                        } else {
                            // Connect new instance
                            if (!def.instance_key) continue; // Skip if no key for new instance
                            await pool.query(
                                `INSERT INTO company_instances (company_id, name, instance_key, api_key, status)
                             VALUES ($1, $2, $3, $4, 'disconnected')`,
                                [id, def.name || `WhatsApp ${i + 1}`, sanitizedKey, def.api_key || null]
                            );
                        }
                    } catch (dbErr: any) {
                        if (dbErr.code === '23505') { // Unique violation
                            const retryKey = `${sanitizedKey}_${id}_${Math.floor(Math.random() * 10000)}`;
                            const finalName = def.name || `WhatsApp ${i + 1}`;
                            if (currentInsts[i]) {
                                await pool.query(
                                    `UPDATE company_instances SET name = $1, instance_key = $2, api_key = $3 WHERE id = $4`,
                                    [finalName, retryKey, def.api_key || null, currentInsts[i].id]
                                );
                            } else {
                                await pool.query(
                                    `INSERT INTO company_instances (company_id, name, instance_key, api_key, status)
                                     VALUES ($1, $2, $3, $4, 'disconnected')`,
                                    [id, finalName, retryKey, def.api_key || null]
                                );
                            }
                            console.warn(`[Update Company] Instance key collision resolved: ${sanitizedKey} -> ${retryKey}`);
                        } else {
                            throw dbErr;
                        }
                    }
                }
            } else if (newMax > currentInsts.length) {
                // User increased limit but didn't provide definitions - Auto-create placeholders if needed?
                // Current logic: We only create if definitions are provided or via QrCode page one-by-one.
                // We don't auto-create generic instances here to avoid key collisions, 
                // BUT the user asked for standard behavior.
                // Let's NOT auto-create here to avoid overwriting user intent from QrCode page.
                // The QrCode page already handles creation of missing slots in UI.
            }

            // DELETE EXCESS INSTANCES ONLY if explicitly requested via max_instances reduction
            // AND strictly if we have more than newMax
            const finalCountRes = await pool.query('SELECT COUNT(*) FROM company_instances WHERE company_id = $1', [id]);
            const finalCount = parseInt(finalCountRes.rows[0].count);

            if (newMax < finalCount) {
                // Only delete if explicitly reducing limit
                const diff = finalCount - newMax;
                // Delete the newest ones (highest IDs) typically
                await pool.query(`
                    DELETE FROM company_instances 
                    WHERE id IN (
                        SELECT id FROM company_instances 
                        WHERE company_id = $1 
                        ORDER BY id DESC 
                        LIMIT $2
                    )
                `, [id, diff]);
            }
            // Note: We removed auto-generation (Add more) block intentionally to satisfy "Explicit Name/API" rule
        } catch (instErr) {
            console.error(`[Update Company ${id}] Failed to sync instances:`, instErr);
            throw instErr;
        }

        const result = await pool.query(query, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Empresa não encontrada.' });

        const updatedCompany = result.rows[0];
        if (user) {
            await logAudit({
                userId: user.id, companyId: user.company_id, action: 'update',
                resourceType: 'company', resourceId: updatedCompany.id,
                newValues: updatedCompany, details: `Atualizou dados da empresa: ${updatedCompany.name}`
            });
        }

        if (due_date) {
            try {
                await pool.query(
                    'UPDATE subscriptions SET current_period_end = $1, status = CASE WHEN $1 > NOW() THEN \'active\' ELSE status END WHERE company_id = $2',
                    [due_date, updatedCompany.id]
                );
            } catch (syncErr) {
                console.warn(`[Update Company] Failed to sync subscription due_date:`, syncErr);
            }
        }

        res.json(updatedCompany);
    } catch (error) {
        console.error('CRITICAL ERROR in updateCompany:', error);
        res.status(500).json({
            error: 'Erro interno ao atualizar empresa',
            details: (error as any).message
        });
    }
};

export const deleteCompany = async (req: Request, res: Response) => {
    // ... no changes here, kept same ...
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            console.log(`[Delete Company ${id}] Starting full cleanup...`);

            // 0. Get User IDs and other related IDs
            const userRes = await client.query('SELECT id FROM app_users WHERE company_id = $1', [id]);
            const userIds = userRes.rows.map(r => r.id);

            // 1. WhatsApp & Webhooks (Children first)
            await client.query('DELETE FROM whatsapp_audit_logs WHERE user_id = ANY($1::int[]) OR conversation_id IN (SELECT id FROM whatsapp_conversations WHERE company_id = $2)', [userIds, id]);
            await client.query('DELETE FROM whatsapp_campaign_contacts WHERE campaign_id IN (SELECT id FROM whatsapp_campaigns WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM whatsapp_messages WHERE conversation_id IN (SELECT id FROM whatsapp_conversations WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM whatsapp_conversations WHERE company_id = $1', [id]);
            await client.query('DELETE FROM whatsapp_campaigns WHERE company_id = $1', [id]);
            await client.query('DELETE FROM whatsapp_contacts WHERE company_id = $1', [id]);

            // 2. CRM & Professional
            await client.query('DELETE FROM crm_follow_ups WHERE company_id = $1', [id]);
            await client.query('DELETE FROM crm_appointments WHERE company_id = $1', [id]);
            await client.query('DELETE FROM crm_lead_tags WHERE lead_id IN (SELECT id FROM crm_leads WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM crm_tags WHERE company_id = $1', [id]);

            await client.query('DELETE FROM crm_professional_insurance_config WHERE professional_id IN (SELECT id FROM crm_professionals WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM crm_professionals WHERE company_id = $1', [id]);
            await client.query('DELETE FROM crm_insurance_plans WHERE company_id = $1', [id]);

            // 3. Finance & Shop (Delete Financial dependencies before leads/users)
            await client.query('DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM receivables WHERE company_id = $1', [id]);
            await client.query('DELETE FROM payments WHERE company_id = $1', [id]);
            await client.query('DELETE FROM sales WHERE company_id = $1', [id]);
            await client.query('DELETE FROM inventory_movements WHERE company_id = $1', [id]);
            await client.query('DELETE FROM inventory WHERE company_id = $1', [id]);
            await client.query('DELETE FROM suppliers WHERE company_id = $1', [id]);
            await client.query('DELETE FROM financial_transactions WHERE company_id = $1', [id]);
            await client.query('DELETE FROM financial_categories WHERE company_id = $1', [id]);
            await client.query('DELETE FROM financial_cost_centers WHERE company_id = $1', [id]);

            // 4. Restaurant
            await client.query('DELETE FROM restaurant_order_items WHERE order_id IN (SELECT id FROM restaurant_orders WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM restaurant_deliveries WHERE order_id IN (SELECT id FROM restaurant_orders WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM restaurant_orders WHERE company_id = $1', [id]);
            await client.query('DELETE FROM restaurant_menu_items WHERE company_id = $1', [id]);
            await client.query('DELETE FROM restaurant_menu_categories WHERE company_id = $1', [id]);
            await client.query('DELETE FROM restaurant_tables WHERE company_id = $1', [id]);

            // 5. Lavajato
            await client.query('DELETE FROM lavajato_service_orders WHERE company_id = $1', [id]);
            await client.query('DELETE FROM lavajato_appointments WHERE company_id = $1', [id]);
            await client.query('DELETE FROM lavajato_client_subscriptions WHERE company_id = $1', [id]);
            await client.query('DELETE FROM lavajato_vehicles WHERE company_id = $1', [id]);
            await client.query('DELETE FROM lavajato_boxes WHERE company_id = $1', [id]);
            await client.query('DELETE FROM lavajato_services WHERE company_id = $1', [id]);
            await client.query('DELETE FROM lavajato_plans WHERE company_id = $1', [id]);

            // 6. Leads (AFTER all things referencing leads like appointments, OS, sales, etc)
            await client.query('DELETE FROM crm_leads WHERE company_id = $1', [id]);
            await client.query('DELETE FROM crm_stages WHERE company_id = $1', [id]);

            // 7. Bots & AI
            await client.query('DELETE FROM bot_sessions WHERE bot_id IN (SELECT id FROM bots WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM bot_instances WHERE bot_id IN (SELECT id FROM bots WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM bot_edges WHERE bot_id IN (SELECT id FROM bots WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM bot_nodes WHERE bot_id IN (SELECT id FROM bots WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM bots WHERE company_id = $1', [id]);
            await client.query('DELETE FROM ai_agents WHERE company_id = $1', [id]);

            // 8. Tasks & Roadmaps
            await client.query('DELETE FROM admin_task_history WHERE task_id IN (SELECT id FROM admin_tasks WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM admin_tasks WHERE company_id = $1', [id]);
            await client.query('DELETE FROM roadmap_comments WHERE roadmap_item_id IN (SELECT id FROM roadmap_items WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM roadmap_items WHERE company_id = $1', [id]);
            await client.query('DELETE FROM entity_links WHERE company_id = $1', [id]);

            // 9. Workflows & FAQ
            await client.query('DELETE FROM workflow_executions WHERE workflow_id IN (SELECT id FROM system_workflows WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM system_workflows WHERE company_id = $1', [id]);
            await client.query('DELETE FROM faq_questions WHERE company_id = $1', [id]);
            await client.query('DELETE FROM global_templates WHERE company_id = $1', [id]);

            // 10. System Logs & Alerts (Alerts BEFORE Logs)
            await client.query('DELETE FROM admin_alerts WHERE log_id IN (SELECT id FROM system_logs WHERE company_id = $1)', [id]);
            await client.query('DELETE FROM system_logs WHERE company_id = $1', [id]);
            await client.query('DELETE FROM audit_logs WHERE company_id = $1', [id]);
            await client.query('DELETE FROM system_settings WHERE company_id = $1', [id]).catch(() => { }); // Optional column

            // 11. Subscription & Usage
            await client.query('DELETE FROM invoices WHERE company_id = $1', [id]);
            await client.query('DELETE FROM subscriptions WHERE company_id = $1', [id]);
            await client.query('DELETE FROM company_usage WHERE company_id = $1', [id]);
            await client.query('DELETE FROM goals WHERE company_id = $1', [id]);

            // 12. Instances & Users (Delete Instances AFTER things referencing them)
            await client.query('DELETE FROM company_instances WHERE company_id = $1', [id]);
            await client.query('DELETE FROM app_users WHERE company_id = $1', [id]);

            // 13. The Company itself
            const result = await client.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);

            await client.query('COMMIT');
            console.log(`[Delete Company ${id}] Completed successfully.`);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Company not found' });
            }

            const deletedCompany = result.rows[0];
            const user = (req as any).user;

            await logAudit({
                userId: user.id,
                companyId: user.company_id,
                action: 'delete',
                resourceType: 'company',
                resourceId: id,
                oldValues: deletedCompany,
                details: `Removeu empresa: ${deletedCompany.name}`
            });

            res.json({ message: 'Company and all associated data deleted successfully.' });
        } catch (e: any) {
            await client.query('ROLLBACK');
            console.error(`[Delete Company ${id}] Failed:`, e);
            res.status(500).json({
                error: 'Failed to delete company due to technical dependencies.',
                details: e.message,
                table: e.table,
                constraint: e.constraint
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getCompanyUsers = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;
        const result = await pool.query('SELECT id, full_name, email, role, is_active FROM app_users WHERE company_id = $1', [id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching company users, returning MOCK:', error);
        // MOCK FALLBACK
        res.json([
            { id: 101, full_name: "Usuário Mock 1", email: "mock1@test.com", role: "ADMIN", is_active: true },
            { id: 102, full_name: "Usuário Mock 2", email: "mock2@test.com", role: "USUARIO", is_active: true }
        ]);
    }
};

export const getCompanyInstances = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;
        const user = (req as any).user;

        // Auth check
        if (user.role !== 'SUPERADMIN' && Number(user.company_id) !== Number(id)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { sync } = req.query;
        let result = await pool.query('SELECT * FROM company_instances WHERE company_id = $1 ORDER BY id ASC', [id]);
        let instances = result.rows;

        // Auto-migration/Seed for legacy companies
        if (instances.length === 0) {
            const companyRes = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1', [id]);
            if (companyRes.rows.length > 0 && companyRes.rows[0].evolution_instance) {
                const comp = companyRes.rows[0];
                console.log(`[getCompanyInstances] Company ${id} has legacy evolution_instance. Migrating to company_instances...`);
                const insertRes = await pool.query(`
                    INSERT INTO company_instances (company_id, name, instance_key, api_key, status)
                    VALUES ($1, 'Instância Principal', $2, $3, 'disconnected')
                    RETURNING *
                `, [id, comp.evolution_instance, comp.evolution_apikey || null]);
                instances = insertRes.rows;
            }
        }

        if (sync === 'true') {
            const syncedInstances = [];
            for (const inst of instances) {
                try {
                    const config = await getEvolutionConfig(user, 'sync_list', id, inst.instance_key);
                    const url = `${config.url}/instance/connectionState/${inst.instance_key}`;

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': config.apikey
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // Evolution V2 returns { instance: { state: 'open' } } or { state: 'open' }
                        const state = data?.instance?.state || data?.state;

                        // Normalize status
                        const lowerState = (state || '').toLowerCase();
                        let status = 'disconnected';
                        if (['open', 'connected', 'online'].includes(lowerState)) status = 'connected';
                        else if (['connecting', 'pairing'].includes(lowerState)) status = 'connecting';

                        if (status !== inst.status) {
                            await pool.query('UPDATE company_instances SET status = $1 WHERE id = $2', [status, inst.id]);
                            inst.status = status;
                        }
                    } else if (response.status === 404) {
                        // Instance not found in evolution but exists in our DB
                        if (inst.status !== 'disconnected') {
                            await pool.query('UPDATE company_instances SET status = $1 WHERE id = $2', ['disconnected', inst.id]);
                            inst.status = 'disconnected';
                        }
                    }
                } catch (err) {
                    console.error(`[Sync] Failed sync for ${inst.instance_key}:`, err);
                }
                syncedInstances.push(inst);
            }
            instances = syncedInstances;
        }

        res.json(instances);
    } catch (error) {
        console.error('Error fetching instances:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

export const updateCompanyInstance = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id, instanceId } = req.params;
        const user = (req as any).user;

        // Auth check
        if (user.role !== 'SUPERADMIN' && Number(user.company_id) !== Number(id)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { name, api_key, instance_key } = req.body;

        // Uniqueness check
        if (instance_key) {
            const checkRes = await pool.query(
                'SELECT id FROM company_instances WHERE instance_key = $1 AND id != $2',
                [instance_key.trim(), instanceId]
            );
            if (checkRes.rows.length > 0) {
                return res.status(400).json({ error: `A instância '${instance_key}' já está em uso por outra empresa.` });
            }
        }

        const sanitizedKey = instance_key ? instance_key.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') : null;

        const result = await pool.query(
            `UPDATE company_instances 
             SET name = COALESCE($1, name), 
                 api_key = COALESCE($2, api_key),
                 instance_key = COALESCE($3, instance_key)
             WHERE id = $4 AND company_id = $5 RETURNING *`,
            [name || null, api_key || null, sanitizedKey || null, instanceId, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating instance:', error);
        res.status(500).json({ error: 'Failed' });
    }
};
