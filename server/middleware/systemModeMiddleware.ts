import { Request, Response, NextFunction } from 'express';
import { systemMode } from '../systemState';

export const systemModeMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // PUBLIC ROUTES - Always allowed
    const publicPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/health',
        '/api/admin/system/mode' // To allow checking mode
    ];

    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    const user = (req as any).user;
    const isSuperAdmin = user?.role === 'SUPERADMIN';
    const isAdmin = user?.role === 'ADMIN' || isSuperAdmin;

    // MODE LOGIC
    switch (systemMode) {
        case 'maintenance':
            // Only admins can use the system in maintenance mode
            if (!isAdmin) {
                return res.status(503).json({
                    error: 'System under maintenance',
                    message: 'O sistema está em manutenção. Por favor, tente novamente mais tarde.'
                });
            }
            break;

        case 'emergency':
            // Only Superadmins can use the system in emergency mode
            if (!isSuperAdmin) {
                return res.status(503).json({
                    error: 'Emergency mode active',
                    message: 'O sistema está em modo de emergência. Acesso restrito.'
                });
            }
            break;

        case 'readonly':
            // Block all data modification requests if not Superadmin
            if (!isSuperAdmin && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
                return res.status(403).json({
                    error: 'Read-only mode active',
                    message: 'O sistema está em modo somente leitura. Alterações não são permitidas.'
                });
            }
            break;

        default:
            // Normal mode, no restrictions
            break;
    }

    next();
};
