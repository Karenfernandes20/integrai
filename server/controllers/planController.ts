
import { Request, Response } from 'express';
import { getPlanStatus as getStatus } from '../services/limitService';
import { pool } from '../db';

export const getPlanStatus = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user?.company_id;

        if (!companyId && user.role !== 'SUPERADMIN') {
            return res.status(400).json({ error: 'Company ID not found' });
        }

        // If superadmin and no company, maybe return system stats? 
        // For now, if SuperAdmin wants to check a specific company, they should impersonate or pass query param?
        // Assuming strict tenant context for now.
        if (!companyId) return res.json({ message: 'Superadmin context' });

        const status = await getStatus(companyId);
        res.json(status);

    } catch (error) {
        console.error('Error fetching plan status:', error);
        res.status(500).json({ error: 'Failed to fetch plan status' });
    }
};

export const getPlans = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const result = await pool.query('SELECT * FROM plans ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
};
