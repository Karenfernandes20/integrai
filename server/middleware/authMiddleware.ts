import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { ROLES, ACTIONS } from '../config/roles';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

// Extend Express Request to include user info
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                email: string;
                role: string;
                company_id?: number;
                permissions?: Record<string, string[]>;
            };
        }
    }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string);

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const verified = jwt.verify(token, JWT_SECRET) as any;
        req.user = verified;

        if (req.user && req.user.company_id) {
            // 1. Fetch Company Profile
            try {
                const profileRes = await pool?.query("SELECT operational_profile FROM companies WHERE id = $1", [req.user.company_id]);
                const profile = profileRes?.rows[0]?.operational_profile || 'GENERIC';

                // 2. Validate Profile Access
                const path = req.path.toLowerCase();

                if (path.includes('/shop/') && profile !== 'LOJA') {
                    return res.status(403).json({ error: 'Forbidden', message: 'Acesso restrito a perfil LOJA.' });
                }
                if (path.includes('/lavajato/') && profile !== 'LAVAJATO') {
                    return res.status(403).json({ error: 'Forbidden', message: 'Acesso restrito a perfil LAVAJATO.' });
                }
                if (path.includes('/restaurant/') && profile !== 'RESTAURANTE') {
                    return res.status(403).json({ error: 'Forbidden', message: 'Acesso restrito a perfil RESTAURANTE.' });
                }
            } catch (e) { console.error("Profile check error", e); }

            // 3. Subscription Check (Block Writes if Overdue/Cancelled)
            if (req.method !== 'GET' && req.method !== 'OPTIONS') {
                try {
                    const result = await pool?.query("SELECT status FROM subscriptions WHERE company_id = $1", [req.user.company_id]);
                    if (result && result.rows.length > 0) {
                        const status = result.rows[0].status;
                        if (status === 'past_due' || status === 'cancelled') {
                            if (!req.path.includes('/billing')) {
                                return res.status(402).json({
                                    error: 'Subscription Suspended',
                                    message: 'Sua assinatura está pendente ou cancelada. Apenas modo leitura permitido.',
                                    code: 'SUBSCRIPTION_REQUIRED'
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.error("Auth Sub Check Error:", e);
                }
            }
        }

        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

export const authorizeRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        // Normalize Role Checks
        // If SUPERADMIN, always pass (unless explicitly excluded, which this middleware doesn't do)
        if (req.user.role === ROLES.SUPERADMIN) return next();

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

export const authorizePermission = (module: string, action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // 1. SUPERADMIN has all access
        if (user.role === ROLES.SUPERADMIN) return next();

        // 2. ADMIN has all access within Tenant
        if (user.role === ROLES.ADMIN) return next();

        // 3. Check Granular Permissions
        const userPerms = user.permissions || {};
        const modulePerms = userPerms[module];

        if (!modulePerms || !modulePerms.includes(action)) {
            return res.status(403).json({ error: `Forbidden: Missing access to ${module}.${action}` });
        }

        next();
    };
};
