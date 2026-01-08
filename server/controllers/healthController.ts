import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';
import { getEvolutionConfig } from './evolutionController';

export const getSystemHealth = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(200).json({ database: 'down' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') return res.status(403).json({ error: 'Access denied' });

        // 1. Check DB
        const dbStart = Date.now();
        await pool.query('SELECT 1');
        const dbLatency = Date.now() - dbStart;

        // 2. Check Recent Logs for Service Status
        const recentErrors = await pool.query(`
            SELECT origin, event_type, COUNT(*) as error_count
            FROM system_logs
            WHERE status = 'error' AND created_at >= NOW() - INTERVAL '1 hour'
            GROUP BY origin, event_type
        `);

        // 3. Simple Heuristic for Status
        const getServiceStatus = (origin: string) => {
            const errors = recentErrors.rows.filter(r => r.origin === origin);
            const totalErrors = errors.reduce((acc, r) => acc + parseInt(r.error_count), 0);
            if (totalErrors > 10) return 'down';
            if (totalErrors > 0) return 'unstable';
            return 'operational';
        };

        // 4. Incident History (Last 5)
        const incidents = await pool.query(`
            SELECT * FROM system_logs 
            WHERE status = 'error' 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        res.json({
            services: {
                database: { status: 'operational', latency: `${dbLatency}ms` },
                webhook: { status: getServiceStatus('webhook') },
                evolution: { status: getServiceStatus('evolution') },
                ia: { status: getServiceStatus('ia') }
            },
            incidents: incidents.rows
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch health status' });
    }
};

export const testService = async (req: Request, res: Response) => {
    const { service } = req.body;
    const user = (req as any).user;

    try {
        if (service === 'database') {
            await pool!.query('SELECT 1');
            return res.json({ success: true, message: 'Database connection is healthy' });
        }

        if (service === 'evolution') {
            const config = await getEvolutionConfig(user, 'health_test');
            const response = await fetch(`${config.url}/instance/fetchInstances`, {
                headers: { 'apikey': config.apikey }
            });
            if (response.ok) return res.json({ success: true, message: 'Evolution API responded correctly' });
            throw new Error(`Evolution API returned ${response.status}`);
        }

        if (service === 'ia') {
            // Placeholder for IA test logic - usually a dummy prompt
            // For now, check if we have any IA logs recently
            return res.json({ success: true, message: 'IA Service check passed (Simulated)' });
        }

        res.status(400).json({ error: 'Invalid service' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
