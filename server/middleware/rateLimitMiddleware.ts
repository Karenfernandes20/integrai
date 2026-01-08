
import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
        alerted: boolean;
    };
}

const store: RateLimitStore = {};

// Cleanup every minute
setInterval(() => {
    const now = Date.now();
    for (const key in store) {
        if (store[key].resetTime < now) {
            delete store[key];
        }
    }
}, 60000);

export const rateLimit = (options: { windowMs: number, max: number, message?: string }) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Identify by Company ID (if auth) or IP (if public)
        const user = (req as any).user;
        const key = user?.company_id ? `company:${user.company_id}` : `ip:${req.ip}`;

        const now = Date.now();

        if (!store[key]) {
            store[key] = {
                count: 1,
                resetTime: now + options.windowMs,
                alerted: false
            };
            return next();
        }

        const record = store[key];

        if (now > record.resetTime) {
            // Reset
            record.count = 1;
            record.resetTime = now + options.windowMs;
            record.alerted = false;
        } else {
            record.count++;
            if (record.count > options.max) {
                // Trigger Alert if abnormal usage (e.g., > 2x limit) AND not already alerted this window
                if (record.count > options.max * 2 && !record.alerted) {
                    console.warn(`[RateLimit] Abnormal usage detected for ${key}: ${record.count} reqs`);
                    record.alerted = true;

                    // Insert Alert asynchronously
                    if (pool && user?.company_id) {
                        pool.query(
                            `INSERT INTO admin_alerts (type, description, company_id, created_at)
                             VALUES ($1, $2, $3, NOW())`,
                            ['abnormal_usage', `Alto volume de requisições detectado para empresa ${user.company_id}: ${record.count} reqs/min`, user.company_id]
                        ).catch(e => console.error('Failed to log alert:', e));
                    }
                }

                return res.status(429).json({
                    error: options.message || 'Muitas requisições. Tente novamente mais tarde.'
                });
            }
        }

        next();
    };
};
