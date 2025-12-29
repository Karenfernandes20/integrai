import { Request, Response } from 'express';
import { pool } from '../db';

export const getCompanies = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const result = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
};

export const getCompany = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { id } = req.params;
        const user = (req as any).user;

        // Security check: Only SuperAdmin or the company's own users can view details
        if (user.role !== 'SUPERADMIN') {
            // Check if user belongs to this company
            // user.company_id might be null or undefined if they are not bound yet
            if (!user.company_id || Number(user.company_id) !== Number(id)) {
                return res.status(403).json({ error: 'You are not authorized to view this company.' });
            }
        }

        const result = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);

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
        const { name, cnpj, city, state, phone, evolution_instance, evolution_apikey } = req.body;

        let logo_url = req.body.logo_url;
        if (req.file) {
            // Construct local URL
            const protocol = req.protocol;
            const host = req.get('host');
            logo_url = `${protocol}://${host}/uploads/${req.file.filename}`;
        }

        const result = await pool.query(
            `INSERT INTO companies (name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey]
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
        const { name, cnpj, city, state, phone, evolution_instance, evolution_apikey } = req.body;

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
                 evolution_apikey = COALESCE($8, evolution_apikey)
             WHERE id = $9 
             RETURNING *`,
            [name, cnpj, city, state, phone, logo_url, evolution_instance, evolution_apikey, id]
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

            // Delete associated users first
            await client.query('DELETE FROM app_users WHERE company_id = $1', [id]);

            // Delete the company
            const result = await client.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);

            await client.query('COMMIT');

            if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found' });
            res.json({ message: 'Company and associated data deleted' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
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
