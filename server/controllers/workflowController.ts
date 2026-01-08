import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

import { checkLimit } from '../services/limitService';

export const getWorkflows = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user.company_id;
        const isSuperAdmin = user.role === 'SUPERADMIN';

        let query = 'SELECT w.*, u.full_name as creator_name FROM system_workflows w LEFT JOIN app_users u ON w.created_by = u.id WHERE 1=1';
        const params: any[] = [];

        if (!isSuperAdmin) {
            params.push(companyId);
            query += ` AND (w.company_id = $${params.length} OR w.company_id IS NULL)`;
        }

        query += ' ORDER BY w.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
};

export const createWorkflow = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { name, event_type, conditions, actions, is_test_mode } = req.body;
        const companyId = user.company_id;

        // Superadmin could create global workflow (null company_id) if they want? 
        // For simplicity, let's bind to creator's company unless explicitly requested null by Superadmin.
        const targetCompanyId = (user.role === 'SUPERADMIN' && req.body.is_global) ? null : companyId;

        if (!targetCompanyId && user.role !== 'SUPERADMIN') {
            // Regular admins must create for their company
            return res.status(403).json({ error: 'Cannot create global workflows' });
        }

        // Limit Check
        if (targetCompanyId) {
            const allowed = await checkLimit(targetCompanyId, 'automations');
            if (!allowed) {
                return res.status(403).json({ error: 'Limite de Automações atingido para este plano.' });
            }
        }

        const result = await pool!.query(
            `INSERT INTO system_workflows (name, event_type, conditions, actions, is_test_mode, created_by, company_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, event_type, JSON.stringify(conditions || []), JSON.stringify(actions || []), is_test_mode || false, user.id, targetCompanyId]
        );

        const workflow = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId: targetCompanyId,
            action: 'create',
            resourceType: 'setting',
            resourceId: workflow.id,
            newValues: workflow,
            details: `Criou workflow automático: ${workflow.name}`
        });

        res.status(201).json(workflow);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create workflow' });
    }
};

export const updateWorkflow = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, status, conditions, actions, is_test_mode } = req.body;
        const user = (req as any).user;
        const isSuperAdmin = user.role === 'SUPERADMIN';

        // Check ownership
        const currentRes = await pool!.query('SELECT company_id FROM system_workflows WHERE id = $1', [id]);
        if (currentRes.rowCount === 0) return res.status(404).json({ error: 'Workflow not found' });

        if (!isSuperAdmin && currentRes.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool!.query(
            `UPDATE system_workflows 
             SET name = COALESCE($1, name),
                 status = COALESCE($2, status),
                 conditions = COALESCE($3, conditions),
                 actions = COALESCE($4, actions),
                 is_test_mode = COALESCE($5, is_test_mode),
                 updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [name, status, conditions ? JSON.stringify(conditions) : null, actions ? JSON.stringify(actions) : null, is_test_mode, id]
        );

        await logAudit({
            userId: user.id,
            companyId: result.rows[0].company_id,
            action: 'update',
            resourceType: 'setting',
            resourceId: id,
            newValues: result.rows[0],
            details: `Atualizou workflow: ${result.rows[0].name}`
        });

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update workflow' });
    }
};

export const deleteWorkflow = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const isSuperAdmin = user.role === 'SUPERADMIN';

        // Check ownership
        const currentRes = await pool!.query('SELECT company_id FROM system_workflows WHERE id = $1', [id]);
        if (currentRes.rowCount === 0) return res.status(404).json({ error: 'Workflow not found' });

        if (!isSuperAdmin && currentRes.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool!.query('DELETE FROM system_workflows WHERE id = $1 RETURNING *', [id]);

        await logAudit({
            userId: user.id,
            companyId: result.rows[0].company_id,
            action: 'delete',
            resourceType: 'setting',
            resourceId: id,
            oldValues: result.rows[0],
            details: `Removeu workflow: ${result.rows[0].name}`
        });

        res.json({ message: 'Workflow deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
};

export const getWorkflowHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const isSuperAdmin = user.role === 'SUPERADMIN';

        // Check ownership
        const currentRes = await pool!.query('SELECT company_id FROM system_workflows WHERE id = $1', [id]);
        if (currentRes.rowCount === 0) return res.status(404).json({ error: 'Workflow not found' });

        if (!isSuperAdmin && currentRes.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool!.query(
            'SELECT * FROM workflow_executions WHERE workflow_id = $1 ORDER BY executed_at DESC LIMIT 50',
            [id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch execution history' });
    }
};

// Workflow Execution Engine (called internally by triggers)
export const triggerWorkflow = async (eventType: string, eventData: any) => {
    if (!pool) return;
    try {
        const companyId = eventData.company_id;

        // 1. Find active workflows for this event (Scoped to Company OR Global)
        const workflows = await pool.query(
            `SELECT * FROM system_workflows 
             WHERE event_type = $1 AND status = 'active' 
             AND (company_id = $2 OR company_id IS NULL)`,
            [eventType, companyId]
        );

        for (const wf of workflows.rows) {
            try {
                // AUTO-PROTECTION: Loop Detection
                // Check executions in last 60 seconds
                const history = await pool.query(
                    `SELECT COUNT(*) FROM workflow_executions 
                     WHERE workflow_id = $1 
                     AND executed_at > NOW() - INTERVAL '1 minute'`,
                    [wf.id]
                );

                const execCount = parseInt(history.rows[0].count);
                if (execCount >= 10) {
                    console.warn(`[Workflow] Loop detected for Workflow ${wf.id}. Blocking execution.`);
                    // Optionally Log Alert
                    continue; // Skip execution
                }

                // 2. Evaluate conditions (simplified logic)
                const conditions = wf.conditions || [];
                let match = true;

                // For now, if no conditions, it always matches. 
                // In real scenarios, we'd check eventData against conditions.
                // TODO: Implement actual JSON Logic or specific condition matching here.

                if (match) {
                    const actions = wf.actions || [];
                    const results = [];

                    for (const action of actions) {
                        // Execute action
                        if (action.type === 'create_task') {
                            await pool.query(
                                `INSERT INTO admin_tasks (title, description, priority, company_id, created_by)
                                 VALUES ($1, $2, $3, $4, $5)`,
                                [action.params.title || 'Tarefa Automática', action.params.description, 'medium', companyId, wf.created_by]
                            );
                            results.push({ action: 'create_task', status: 'success' });
                        }

                        if (action.type === 'send_alert') {
                            // Link alert to company logs if possible, but admin_alerts is currently global/superadmin focused?
                            // We updated system_logs to have company_id. 
                            // But admin_alerts is linked to system_logs.

                            // Let's create a system log first
                            const logRes = await pool.query(
                                `INSERT INTO system_logs (event_type, origin, status, message, details, company_id)
                                 VALUES ($1, 'workflow', 'info', $2, $3, $4) RETURNING id`,
                                ['workflow_alert', action.params.message, JSON.stringify({ workflow_id: wf.id }), companyId]
                            );

                            await pool.query(
                                `INSERT INTO admin_alerts (type, description, log_id) VALUES ($1, $2, $3)`,
                                ['workflow_alert', action.params.message || `Alerta de Workflow: ${wf.name}`, logRes.rows[0].id]
                            );
                            results.push({ action: 'send_alert', status: 'success' });
                        }

                        if (action.type === 'pause_ia') {
                            await pool.query(
                                `UPDATE ai_agents SET status = 'paused' WHERE company_id = $1`,
                                [companyId]
                            );
                            results.push({ action: 'pause_ia', status: 'success' });
                        }
                    }

                    // 3. Log execution
                    await pool.query(
                        `INSERT INTO workflow_executions (workflow_id, event_data, actions_taken, status)
                         VALUES ($1, $2, $3, $4)`,
                        [wf.id, JSON.stringify(eventData), JSON.stringify(results), 'success']
                    );
                }
            } catch (wfErr: any) {
                console.error(`[Workflow Engine] Error executing workflow ${wf.id}:`, wfErr);
                await pool.query(
                    `INSERT INTO workflow_executions (workflow_id, event_data, status, error_message)
                     VALUES ($1, $2, $3, $4)`,
                    [wf.id, JSON.stringify(eventData), 'failed', wfErr.message]
                );
            }
        }
    } catch (err) {
        console.error('[Workflow Engine] Critical failure:', err);
    }
};
