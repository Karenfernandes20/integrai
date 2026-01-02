import { Request, Response } from 'express';
import { pool } from '../db';

export const getCompanies = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const result = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
        res.json(result.rows);
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
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;
        const user = (req as any).user;

        console.log('DEBUG: getCompany auth check', {
            requestingUser: user?.email,
            role: user?.role,
            userCompanyId: user?.company_id,
            targetCompanyId: id
        });

        // Security check: Only SuperAdmin or the company's own users can view details
        if (user.role !== 'SUPERADMIN') {
            // Check if user belongs to this company
            // user.company_id might be null or undefined if they are not bound yet
            if (!user.company_id || Number(user.company_id) !== Number(id)) {
                return res.status(403).json({ error: 'You are not authorized to view this company.' });
            }
        }

        const result = await pool.query(`
            SELECT 
                id, name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, created_at,
                COALESCE(operation_type, 'clientes') as operation_type 
            FROM companies WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({ error: 'Failed to fetch company' });
    }
};

export const createCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { name, cnpj, city, state, phone, evolution_instance, evolution_apikey, operation_type } = req.body;

        let logo_url = req.body.logo_url;
        if (req.file) {
            // Construct local URL
            const protocol = req.protocol;
            const host = req.get('host');
            logo_url = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        const result = await pool.query(
            `INSERT INTO companies (name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, operation_type) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             RETURNING *`,
            [name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, operation_type || 'clientes']
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ error: 'Failed to create company' });
    }
};

export const updateCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;
        const { name, cnpj, city, state, phone, evolution_instance, evolution_apikey, operation_type } = req.body;

        let logo_url = req.body.logo_url;
        if (req.file) {
            const protocol = req.protocol;
            const host = req.get('host');
            logo_url = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        // We need to fetch current data if some fields are missing (though frontend should send all)
        // ideally we use COALESCE in SQL but here we are explicit

        const result = await pool.query(
            `UPDATE companies 
             SET name = $1, cnpj = $2, city = $3, state = $4, phone = $5, 
                 logo_url = COALESCE($6, logo_url),
                 evolution_instance = COALESCE($7, evolution_instance),
                 evolution_apikey = COALESCE($8, evolution_apikey),
                 operation_type = COALESCE($9, operation_type)
             WHERE id = $10 
             RETURNING *`,
            [name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, operation_type, id]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({ error: 'Failed to update company' });
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
            // First by company_id
            await client.query('DELETE FROM financial_transactions WHERE company_id = $1', [id]);
            // Also delete transactions linked to rides of these users (if any missed)
            if (userIds.length > 0) {
                await client.query(`
                    DELETE FROM financial_transactions 
                    WHERE ride_id IN (SELECT id FROM rides WHERE passenger_id = ANY($1::int[]) OR driver_id = ANY($1::int[]))
                `, [userIds]);
            }

            // 10. Delete Rides (linked to users)
            if (userIds.length > 0) {
                await client.query(`
                    DELETE FROM rides 
                    WHERE passenger_id = ANY($1::int[]) OR driver_id = ANY($1::int[])
                `, [userIds]);
            }

            // 11. Delete associated users
            await client.query('DELETE FROM app_users WHERE company_id = $1', [id]);

            // 12. Delete the company
            const result = await client.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);

            await client.query('COMMIT');
            console.log(`[Delete Company ${id}] Completed successfully.`);

            if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found' });
            res.json({ message: 'Company and associated data deleted' });
        } catch (e: any) {
            await client.query('ROLLBACK');
            console.error(`[Delete Company ${id}] Failed:`, e);
            res.status(500).json({
                error: 'Failed to delete company',
                details: e.message,
                code: e.code,
                constraint: e.constraint
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
        console.error('Error fetching company users:', error);
        res.status(500).json({ error: 'Failed to fetch company users' });
    }
};
