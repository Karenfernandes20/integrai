import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';
import { setSystemModeInMem } from '../systemState';

export const getSystemMode = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not connected' });

        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'operational_mode'");
        if (result.rows.length === 0) {
            return res.json({ mode: 'normal' });
        }

        res.json({ mode: result.rows[0].value });
    } catch (error: any) {
        console.error('Error fetching system mode:', error);
        res.status(500).json({ error: error.message });
    }
};

export const setSystemMode = async (req: Request, res: Response) => {
    const { mode } = req.body;
    const allowedModes = ['normal', 'maintenance', 'emergency', 'readonly'];

    if (!allowedModes.includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode' });
    }

    const user = (req as any).user;
    if (!user || user.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        if (!pool) return res.status(500).json({ error: 'Database not connected' });

        // Get current mode for audit
        const currentModeRes = await pool.query("SELECT value FROM system_settings WHERE key = 'operational_mode'");
        const oldMode = currentModeRes.rows.length > 0 ? currentModeRes.rows[0].value : 'normal';

        await pool.query(
            "UPDATE system_settings SET value = $1, updated_at = NOW(), updated_by = $2 WHERE key = 'operational_mode'",
            [JSON.stringify(mode), user.id]
        );

        setSystemModeInMem(mode);

        // Audit log
        await logAudit({
            userId: user.id,
            action: 'update',
            resourceType: 'setting',
            resourceId: 'operational_mode',
            oldValues: { mode: oldMode },
            newValues: { mode },
            details: `System operational mode changed from ${oldMode} to ${mode}`,
            ipAddress: req.ip
        });

        res.json({ success: true, mode });
    } catch (error: any) {
        console.error('Error setting system mode:', error);
        res.status(500).json({ error: error.message });
    }
};
