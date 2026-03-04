
import { Request, Response } from 'express';
import { pool } from '../database.js';

export const getFeatureFlags = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { companyId } = req.params;
        const user = (req as any).user;

        // Auth check
        if (user.role !== 'SUPERADMIN' && Number(user.company_id) !== Number(companyId)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const result = await pool.query(
            'SELECT feature_key, is_enabled FROM company_feature_flags WHERE company_id = $1',
            [companyId]
        );

        // Convert to object for easier frontend use: { feature_key: is_enabled }
        const flags = result.rows.reduce((acc: any, row: any) => {
            acc[row.feature_key] = row.is_enabled;
            return acc;
        }, {});

        res.json(flags);
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const toggleFeatureFlag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { companyId } = req.params;
        const { feature_key, is_enabled } = req.body;
        const user = (req as any).user;

        // Auth check - Only admins or superadmins can toggle
        if (user.role !== 'SUPERADMIN' && (Number(user.company_id) !== Number(companyId) || user.role !== 'ADMIN')) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!feature_key) {
            return res.status(400).json({ error: 'feature_key is required' });
        }

        const result = await pool.query(`
            INSERT INTO company_feature_flags (company_id, feature_key, is_enabled, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (company_id, feature_key) 
            DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
            RETURNING *
        `, [companyId, feature_key, is_enabled]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error toggling feature flag:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const checkFeatureEnabled = async (companyId: number, featureKey: string): Promise<boolean> => {
    if (!pool) return false;
    try {
        const result = await pool.query(
            'SELECT is_enabled FROM company_feature_flags WHERE company_id = $1 AND feature_key = $2',
            [companyId, featureKey]
        );
        return result.rows.length > 0 ? result.rows[0].is_enabled : false;
    } catch (error) {
        console.error(`Error checking feature ${featureKey}:`, error);
        return false;
    }
};
