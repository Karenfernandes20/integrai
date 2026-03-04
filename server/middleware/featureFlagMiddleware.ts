
import { Request, Response, NextFunction } from 'express';
import { checkFeatureEnabled } from '../controllers/featureFlagController.js';

export const requireFeature = (featureKey: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || !user.company_id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Superadmins can bypass feature flags for management purposes? 
        // Maybe, but usually they should see it too. Let's allow bypass for SUPERADMIN.
        if (user.role === 'SUPERADMIN') {
            return next();
        }

        const isEnabled = await checkFeatureEnabled(Number(user.company_id), featureKey);

        if (!isEnabled) {
            return res.status(403).json({
                error: 'Feature Disabled',
                message: `The feature '${featureKey}' is not enabled for this company.`
            });
        }

        next();
    };
};
