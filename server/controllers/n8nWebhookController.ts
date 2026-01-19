
import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

export const handleN8nWebhook = async (req: Request, res: Response) => {
    try {
        const secret = req.headers['x-webhook-secret'] as string;

        if (!secret) {
            return res.status(401).json({ error: 'Missing Secret' });
        }

        if (!pool) return res.status(500).json({ error: 'DB Error' });

        // Find Company by Secret
        // Note: Ideally this receives also an identifier if secrets are not unique, but let's assume unique enough or checked.
        const companyRes = await pool.query('SELECT id, n8n_base_url FROM companies WHERE n8n_webhook_secret = $1', [secret]);

        if (companyRes.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid Secret' });
        }

        const companyId = companyRes.rows[0].id;
        const event = req.body;
        // Event structure depends on how N8N sends it. 
        // Assuming typical N8N event structure: { event: 'workflow.created', data: { workflow: { ... } } }

        const eventName = event.event;
        const workflowData = event.data?.workflow || event.workflow; // Adjust based on actual payload

        if (!workflowData || !workflowData.id) {
            return res.status(400).json({ error: 'Invalid Payload' });
        }

        const n8nId = workflowData.id;
        const name = workflowData.name;
        const active = workflowData.active;
        const nodes = workflowData.nodes;
        const connections = workflowData.connections;

        console.log(`[N8N Webhook] Received ${eventName} for ${n8nId} (Company ${companyId})`);

        // Check if we already have this workflow
        const existingRes = await pool.query('SELECT id FROM system_workflows WHERE n8n_workflow_id = $1 AND company_id = $2', [n8nId, companyId]);

        if (existingRes.rows.length > 0) {
            const localId = existingRes.rows[0].id;

            // UPDATE
            if (eventName === 'workflow.updated' || eventName === 'workflow.created') { // .created might happen if we missed it or it's a re-sync
                // We only update if `n8n_last_synced_at` is older than this event? 
                // Or we trust N8N is source of truth here.
                // To avoid loops, we might check if the update originated from us.
                // But for now, let's update.

                // We need to map N8N nodes back to our "conditions" and "actions" if we want visual compatibility.
                // That's complex. For now, we update the status and maybe `name`.
                // And we can store the raw N8N json if we had a column, but we don't.
                // We will just update status and name.
                await pool.query(
                    `UPDATE system_workflows SET 
                        name = $1, 
                        status = $2, 
                        n8n_active = $3,
                        n8n_last_synced_at = NOW()
                     WHERE id = $4`,
                    [name, active ? 'active' : 'inactive', active, localId]
                );
            } else if (eventName === 'workflow.activated') {
                await pool.query("UPDATE system_workflows SET status = 'active', n8n_active = true WHERE id = $1", [localId]);
            } else if (eventName === 'workflow.deactivated') {
                await pool.query("UPDATE system_workflows SET status = 'inactive', n8n_active = false WHERE id = $1", [localId]);
            }

        } else {
            // CREATE (Only if created on N8N side)
            if (eventName === 'workflow.created') {
                // We create a "N8N Remote" workflow in our system
                await pool.query(
                    `INSERT INTO system_workflows (company_id, name, event_type, status, n8n_workflow_id, n8n_active, n8n_last_synced_at, conditions, actions)
                     VALUES ($1, $2, 'n8n_remote', $3, $4, $5, NOW(), '[]', '[]')`,
                    [companyId, name, active ? 'active' : 'inactive', n8nId, active]
                );

                // Log
                await logAudit({
                    userId: 0, // System
                    companyId: companyId,
                    action: 'create',
                    resourceType: 'setting',
                    resourceId: n8nId,
                    details: `Workflow sincronizado do N8N: ${name}`
                });
            }
        }

        res.json({ success: true });

    } catch (error: any) {
        console.error('[N8N Webhook Error]', error);
        res.status(500).json({ error: error.message });
    }
};
