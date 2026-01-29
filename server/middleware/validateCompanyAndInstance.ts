
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

export interface RequestWithInstance extends Request {
    user?: any;
    instanceId?: number;
}

export const validateCompanyAndInstance = async (req: RequestWithInstance, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        if (!user || !user.company_id) {
            return res.status(401).json({ error: 'User not authenticated or company not found' });
        }

        // Extract Instance ID
        let instanceId = req.headers['x-instance-id'] || req.query.instance_id || req.body.instance_id;

        if (!instanceId) {
            return res.status(400).json({ error: 'Instance ID is required for Shop operations' });
        }

        // Normalize
        instanceId = Number(instanceId);
        if (isNaN(instanceId)) {
            return res.status(400).json({ error: 'Invalid Instance ID format' });
        }

        // Verify if instance belongs to company
        const instanceCheck = await pool!.query(
            'SELECT id FROM company_instances WHERE id = $1 AND company_id = $2',
            [instanceId, user.company_id]
        );

        if (instanceCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied: Instance does not belong to your company' });
        }

        // Attach verified instanceId to request
        req.instanceId = instanceId;
        next();

    } catch (error) {
        console.error('Middleware validaton error:', error);
        res.status(500).json({ error: 'Internal server error during instance validation' });
    }
};
