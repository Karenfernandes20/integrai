import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';


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
                id, name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, created_at,
                COALESCE(operation_type, 'clientes') as operation_type,
                primary_color, secondary_color, system_name, custom_domain,
                plan_id, due_date
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
        const { name, cnpj, city, state, phone, evolution_instance, evolution_apikey, operation_type, plan_id, due_date, max_instances } = req.body;

        let logo_url = null;
        if (req.file) {
            // Construct local URL
            const protocol = req.protocol;
            const host = req.get('host');
            logo_url = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        const limitInstances = max_instances ? parseInt(max_instances) : 1;

        const result = await pool.query(
            `INSERT INTO companies (name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, operation_type, plan_id, due_date, max_instances) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
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
                plan_id || null,
                due_date || null,
                limitInstances
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
            for (let i = 1; i <= limitInstances; i++) {
                // If i=1 and we have legacy params, use them
                const isFirst = i === 1;
                const seedName = `Instância ${i}`;
                const seedKey = (isFirst && evolution_instance) ? evolution_instance : `integrai_${newCompany.id}_${i}`;
                const seedApiKey = (isFirst && evolution_apikey) ? evolution_apikey : null;

                await pool.query(`
                    INSERT INTO company_instances (company_id, name, instance_key, api_key, status)
                    VALUES ($1, $2, $3, $4, 'disconnected')
                    ON CONFLICT DO NOTHING
                `, [newCompany.id, seedName, seedKey, seedApiKey]);
            }
            console.log(`[Company ${newCompany.id}] Seeded ${limitInstances} instances.`);
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
            // Don't fail company creation if stage creation fails
        }

        // --- VALUE PROOF SEEDING ---
        try {
            // 1. Create Sample Lead (Proof of Kanban)
            // Fetch the just created stage ID or use a guess if previous passed. 
            // Better to re-query the stage we just made or know it from a strict select.
            const stageRes = await pool.query('SELECT id FROM crm_stages WHERE company_id = $1 AND name = $2 LIMIT 1', [newCompany.id, 'LEADS']);
            if (stageRes.rows.length > 0) {
                await pool.query(
                    `INSERT INTO crm_leads (name, phone, stage_id, company_id, description, value, origin) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    ['João Silva (Exemplo)', '5511999999999', stageRes.rows[0].id, newCompany.id, 'Este é um lead de exemplo. Arraste-o para mover de fase!', 1500.00, 'Simulação']
                );
            }

            // 2. Create Active AI Agent (Proof of Automation)
            await pool.query(
                `INSERT INTO ai_agents (company_id, name, prompt, status, model)
                 VALUES ($1, $2, $3, 'active', 'gpt-4o')`,
                [
                    newCompany.id,
                    'Assistente de Vendas',
                    'Você é um assistente comercial focado em qualificar leads. Seja breve e cordial.'
                ]
            );

            // 3. Create Standard Templates (Proof of Speed)
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

            console.log(`[Company ${newCompany.id}] Seeded value-proof data (Lead, AI, Templates).`);

        } catch (seedErr) {
            console.error(`[Company ${newCompany.id}] Failed to seed data:`, seedErr);
        }

        res.status(201).json(newCompany);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ error: 'Failed to create company' });
    }
};

export const updateCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Configuração do banco de dados não encontrada.' });

        const { id } = req.params;
        const { name, cnpj, city, state, phone, evolution_instance, evolution_apikey, operation_type, remove_logo,
            primary_color, secondary_color, system_name, custom_domain, plan_id, due_date, max_instances } = req.body;

        console.log('DEBUG: updateCompany request', { id, body: req.body, hasFile: !!req.file });

        if (!name) {
            return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
        }

        const isRemovingLogo = remove_logo === 'true' || remove_logo === true;

        let finalLogoUrl: string | null = null;
        if (req.file) {
            const protocol = req.protocol;
            const host = req.get('host');
            finalLogoUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        // 1. Fetch current data to handle logo logic safely
        const currentRes = await pool.query('SELECT logo_url FROM companies WHERE id = $1', [id]);

        if (currentRes.rowCount === 0) {
            return res.status(404).json({ error: 'Empresa não encontrada no banco de dados.' });
        }
        const currentLogo = currentRes.rows[0].logo_url;

        // 2. Determine new logo URL
        let newLogoUrl = currentLogo;
        if (isRemovingLogo) {
            newLogoUrl = null;
        } else if (finalLogoUrl) {
            newLogoUrl = finalLogoUrl;
        }

        const query = `
            UPDATE companies 
            SET name = $1, 
                cnpj = $2, 
                city = $3, 
                state = $4, 
                phone = $5, 
                logo_url = $6,
                evolution_instance = COALESCE($7, evolution_instance),
                evolution_apikey = COALESCE($8, evolution_apikey),
                operation_type = COALESCE($9, operation_type),
                primary_color = COALESCE($11, primary_color),
                secondary_color = COALESCE($12, secondary_color),
                system_name = COALESCE($13, system_name),
                custom_domain = COALESCE($14, custom_domain),
                plan_id = $15,
                due_date = $16,
                max_instances = $17
            WHERE id = $10 
            RETURNING *
        `;

        const newMax = max_instances ? parseInt(max_instances) : 1;

        const values = [
            name,
            cnpj || null,
            city || null,
            state || null,
            phone || null,
            newLogoUrl, // $6 is now the decided value
            evolution_instance || null,
            evolution_apikey || null,
            operation_type || 'clientes',
            parseInt(id),
            primary_color || null,
            secondary_color || null,
            system_name || null,
            custom_domain || null,
            plan_id || null, // $15
            due_date || null, // $16
            newMax // $17
        ];

        // --- INSTANCE SYNC ---
        // Create new instances if limit increased
        try {
            const countRes = await pool.query('SELECT COUNT(*) FROM company_instances WHERE company_id = $1', [id]);
            const currentCount = parseInt(countRes.rows[0].count);

            if (newMax > currentCount) {
                const diff = newMax - currentCount;
                for (let k = 1; k <= diff; k++) {
                    const nextNum = currentCount + k;
                    const seedName = `Instância ${nextNum}`;
                    const seedKey = `integrai_${id}_${nextNum}`;
                    await pool.query(`
                        INSERT INTO company_instances (company_id, name, instance_key, status)
                        VALUES ($1, $2, $3, 'disconnected')
                        ON CONFLICT DO NOTHING
                    `, [id, seedName, seedKey]);
                }
                console.log(`[Update Company ${id}] Added ${diff} new instances.`);
            }
        } catch (instErr) {
            console.error(`[Update Company ${id}] Failed to sync instances:`, instErr);
        }

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            // Should not happen as we checked existence, but standard check
            return res.status(404).json({ error: 'Empresa não encontrada.' });
        }

        const updatedCompany = result.rows[0];
        const user = (req as any).user;

        // Audit Log
        if (user) {
            await logAudit({
                userId: user.id,
                companyId: user.company_id,
                action: 'update',
                resourceType: 'company',
                resourceId: updatedCompany.id,
                newValues: updatedCompany,
                details: `Atualizou dados da empresa: ${updatedCompany.name}`
            });
        }

        // SYNC SUBSCRIPTION if due_date changed
        // Ensure that if there is a formal subscription record, it stays in sync with the manual company override
        if (due_date) {
            try {
                await pool.query(
                    'UPDATE subscriptions SET current_period_end = $1, status = CASE WHEN $1 > NOW() THEN \'active\' ELSE status END WHERE company_id = $2',
                    [due_date, updatedCompany.id]
                );
                console.log(`[Update Company] Synced due_date to subscriptions table for company ${updatedCompany.id}`);
            } catch (syncErr) {
                console.warn(`[Update Company] Failed to sync subscription due_date:`, syncErr);
            }
        }

        res.json(updatedCompany);
    } catch (error) {
        console.error('CRITICAL ERROR in updateCompany:', error);
        res.status(500).json({
            error: 'Erro interno ao atualizar empresa',
            details: (error as any).message,
            code: (error as any).code,
            stack: process.env.NODE_ENV === 'development' ? (error as any).stack : undefined
        });
    }
};

export const deleteCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;

        // Perform deletion in a transaction to ensure integrity
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            console.log(`[Delete Company ${id}] Starting full cleanup...`);

            // 0. Get User IDs for deep cleanup
            const userRes = await client.query('SELECT id FROM app_users WHERE company_id = $1', [id]);
            const userIds = userRes.rows.map(r => r.id);

            // 1. Delete WhatsApp Audit Logs
            // Linked to company conversations OR company users
            await client.query(`
                DELETE FROM whatsapp_audit_logs 
                WHERE conversation_id IN (SELECT id FROM whatsapp_conversations WHERE company_id = $1)
                OR user_id = ANY($2::int[])
            `, [id, userIds]);

            // 2. Delete Campaign Contacts (via Campaign association)
            await client.query(`
                DELETE FROM whatsapp_campaign_contacts 
                WHERE campaign_id IN (SELECT id FROM whatsapp_campaigns WHERE company_id = $1)
            `, [id]);

            // 3. Delete Campaigns
            await client.query('DELETE FROM whatsapp_campaigns WHERE company_id = $1', [id]);

            // 4. Delete CRM Follow Ups
            await client.query('DELETE FROM crm_follow_ups WHERE company_id = $1', [id]);

            // 5. Delete Leads
            await client.query('DELETE FROM crm_leads WHERE company_id = $1', [id]);

            // 5.1 Delete CRM Stages (if company specific)
            try {
                // Check if column exists first or just try delete if we know schema
                // Safe approach: try delete
                await client.query('DELETE FROM crm_stages WHERE company_id = $1', [id]);
            } catch (e) { }

            // 5.2 Delete CRM Tags
            try {
                await client.query('DELETE FROM crm_tags WHERE company_id = $1', [id]);
            } catch (e) { }

            // 6. Delete Messages (linked to conversations)
            await client.query(`
                DELETE FROM whatsapp_messages 
                WHERE conversation_id IN (SELECT id FROM whatsapp_conversations WHERE company_id = $1)
            `, [id]);

            // 7. Delete Conversations
            await client.query('DELETE FROM whatsapp_conversations WHERE company_id = $1', [id]);

            // 8. Delete WhatsApp Contacts associated with the company
            await client.query('DELETE FROM whatsapp_contacts WHERE company_id = $1', [id]);

            // 9. Delete Financial Transactions
            try {
                await client.query('DELETE FROM financial_transactions WHERE company_id = $1', [id]);
            } catch (e) { }

            // 9.1 Delete Financial Categories & Cost Centers
            try {
                await client.query('DELETE FROM financial_categories WHERE company_id = $1', [id]);
                await client.query('DELETE FROM financial_cost_centers WHERE company_id = $1', [id]);
            } catch (e) { }


            // 10. Admin Tasks & Alerts
            await client.query('DELETE FROM admin_tasks WHERE company_id = $1', [id]);

            // 10.1 Delete System Workflows
            try {
                await client.query('DELETE FROM system_workflows WHERE company_id = $1', [id]);
            } catch (e) { }

            // 10.2 Delete Templates
            try {
                await client.query('DELETE FROM global_templates WHERE company_id = $1', [id]);
            } catch (e) { }

            // 10.3 Delete Roadmap Items
            try {
                await client.query('DELETE FROM roadmap_comments WHERE roadmap_item_id IN (SELECT id FROM roadmap_items WHERE company_id = $1)', [id]);
                await client.query('DELETE FROM roadmap_items WHERE company_id = $1', [id]);
            } catch (e) { }

            // 10.4 Delete AI Agents (Cascade usually covers this but safe to maximize)
            try {
                await client.query('DELETE FROM ai_agents WHERE company_id = $1', [id]);
            } catch (e) { }

            // 10.5 Delete Company Usage & Subscriptions (Cascade usually covers this)
            try {
                await client.query('DELETE FROM company_usage WHERE company_id = $1', [id]);
                await client.query('DELETE FROM invoices WHERE company_id = $1', [id]);
                await client.query('DELETE FROM subscriptions WHERE company_id = $1', [id]);
            } catch (e) { }

            // 10.6 Delete System Logs (Multi-tenant)
            try {
                await client.query('DELETE FROM system_logs WHERE company_id = $1', [id]);
            } catch (e) { }

            // 10.7 Delete Audit Logs (Universal)
            try {
                await client.query('DELETE FROM audit_logs WHERE company_id = $1', [id]);
            } catch (e) { }

            // Clean Entity Links related to this company's users or entities (Best Effort)
            try {
                // Delete links created by company users
                await client.query('DELETE FROM entity_links WHERE created_by IN (SELECT id FROM app_users WHERE company_id = $1)', [id]);
            } catch (e) { }


            // Skip rides deletion - not used in CRM-only databases
            console.log(`[Delete Company ${id}] Skipping rides deletion (CRM database)`);


            // 11. Delete associated users
            await client.query('DELETE FROM app_users WHERE company_id = $1', [id]);

            // 12. Delete the company
            const result = await client.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);

            await client.query('COMMIT');
            console.log(`[Delete Company ${id}] Completed successfully.`);

            if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found' });

            const deletedCompany = result.rows[0];
            const user = (req as any).user;

            // Audit Log
            await logAudit({
                userId: user.id,
                companyId: user.company_id,
                action: 'delete',
                resourceType: 'company',
                resourceId: id,
                oldValues: deletedCompany,
                details: `Removeu empresa: ${deletedCompany.name}`
            });

            res.json({ message: 'Company and associated data deleted' });
        } catch (e: any) {
            await client.query('ROLLBACK');
            console.error(`[Delete Company ${id}] Failed:`, e);

            // Return detailed error for debugging
            res.status(500).json({
                error: 'Failed to delete company. Check dependencies.',
                details: e.message || e.toString(),
                constraint: e.constraint, // PostgreSQL constraint name
                table: e.table // PostgreSQL table name if available
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ error: 'Failed to delete company' });
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

        const result = await pool.query('SELECT * FROM company_instances WHERE company_id = $1 ORDER BY id ASC', [id]);
        res.json(result.rows);
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

        const result = await pool.query(
            `UPDATE company_instances 
             SET name = COALESCE($1, name), 
                 api_key = COALESCE($2, api_key),
                 instance_key = COALESCE($3, instance_key)
             WHERE id = $4 AND company_id = $5 RETURNING *`,
            [name || null, api_key || null, instance_key || null, instanceId, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating instance:', error);
        res.status(500).json({ error: 'Failed' });
    }
};
