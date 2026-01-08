
import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

export const getOnboardingStatus = async (req: Request, res: Response) => {
    // Current user context
    const user = (req as any).user;
    if (!user || !user.company_id) return res.status(403).json({ error: 'User not associated with a company' });

    try {
        const result = await pool?.query('SELECT onboarding_step FROM companies WHERE id = $1', [user.company_id]);
        if (!result || result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });

        const status = result.rows[0];

        // Dynamic Checks
        const checks = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM whatsapp_conversations WHERE company_id = $1) as chats_count,
                (SELECT COUNT(*) FROM crm_leads WHERE company_id = $1) as leads_count,
                (SELECT COUNT(*) FROM whatsapp_contacts WHERE company_id = $1) as contacts_count,
                (SELECT status FROM whatsapp_instances WHERE company_id = $1 LIMIT 1) as wa_status
        `, [user.company_id]);

        const data = checks.rows[0] || {};

        res.json({
            step: status.onboarding_step,
            checklist: {
                whatsapp_connected: data.wa_status === 'connected' || data.chats_count > 0, // Fallback if instance tracking is sparse
                has_contacts: parseInt(data.contacts_count) > 0,
                has_leads: parseInt(data.leads_count) > 0,
                first_message_sent: parseInt(data.chats_count) > 0
            }
        });
    } catch (error) {
        console.error("Onboarding Status Error:", error);
        res.status(500).json({ error: 'Internal Error' });
    }
};

export const updateOnboardingStep = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { step } = req.body;
    if (!user || !user.company_id) return res.status(403).json({ error: 'Unauthorized' });

    // Restrict stepping forward arbitrarily? For now, trust the frontend/flow but we could validate previous steps.
    // e.g. User cannot skip to 4 if 2 is not done. 
    // Implementing a simple >= check to prevent regression if desired, or just overwrite.

    try {
        await pool?.query('UPDATE companies SET onboarding_step = $1 WHERE id = $2', [step, user.company_id]);

        await logAudit({
            userId: user.id,
            companyId: user.company_id,
            action: 'update',
            resourceType: 'system',
            details: `Onboarding avanzado para etapa ${step}`
        });

        res.json({ success: true, step });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
};

export const completeOnboarding = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.company_id) return res.status(403).json({ error: 'Unauthorized' });

    try {
        // Set step to 5 (or logic max) and ensure company status? 
        // Assuming step 5 is 'Complete'.
        await pool?.query(`
            UPDATE companies 
            SET onboarding_step = 5 
            WHERE id = $1
        `, [user.company_id]);

        res.json({ success: true, message: 'Onboarding completed' });
    } catch (error) {
        res.status(500).json({ error });
    }
};
