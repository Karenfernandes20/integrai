
import { pool } from '../db';
import { logEvent } from '../logger';

export type ResourceType = 'users' | 'ai_agents' | 'automations' | 'messages' | 'queues' | 'campaigns' | 'schedules' | 'internal_chat' | 'external_api' | 'kanban';

export const checkLimit = async (companyId: number, resource: ResourceType): Promise<boolean> => {
    console.log(`[LimitService] Checking limit for company ${companyId}, resource: ${resource}`);
    // User requested no limits for users - moved to top for absolute bypass
    if (resource === 'users') {
        console.log(`[LimitService] User limit BYPASS triggered for company ${companyId}`);
        return true;
    }

    if (!pool) return false;
    try {
        // Superadmin bypass (optional, but implemented at controller usually. Here we strictly check limits for the given companyId)
        // Retrieve Plan and Usage

        // 1. Get Plan Limits
        const companyPlan = await pool.query(`
            SELECT p.* 
            FROM companies c
            JOIN plans p ON c.plan_id = p.id
            WHERE c.id = $1
        `, [companyId]);

        if (companyPlan.rows.length === 0) {
            console.warn(`[LimitService] No plan found for company ${companyId}. Defaulting to restricted.`);
            return false; // No plan = no access
        }

        const plan = companyPlan.rows[0];

        // 2. Check Boolean Features
        if (resource === 'campaigns' && !plan.use_campaigns) return false;
        if (resource === 'schedules' && !plan.use_schedules) return false;
        if (resource === 'internal_chat' && !plan.use_internal_chat) return false;
        if (resource === 'external_api' && !plan.use_external_api) return false;
        if (resource === 'kanban' && !plan.use_kanban) return false;

        // 3. Check Count-Based Limits


        if (resource === 'ai_agents') {
            const currentAgents = await pool.query('SELECT COUNT(*) FROM ai_agents WHERE company_id = $1 AND status = \'active\'', [companyId]);
            const count = parseInt(currentAgents.rows[0].count);
            // Default max_ai_agents if not present (migration timing issue safeguard)
            if (plan.max_ai_agents === null) return true;
            const maxAgents = plan.max_ai_agents !== undefined ? plan.max_ai_agents : 1;
            return count < maxAgents;
        }

        if (resource === 'automations') {
            // Counting Active Workflows
            const currentWorkflows = await pool.query('SELECT COUNT(*) FROM system_workflows WHERE company_id = $1 AND status = \'active\'', [companyId]);
            const count = parseInt(currentWorkflows.rows[0].count);
            if (plan.max_automations === null) return true;
            const maxAutomations = plan.max_automations !== undefined ? plan.max_automations : 5;
            return count < maxAutomations;
        }

        if (resource === 'queues') {
            // Counting Stages as Queues/Pipes?
            // Let's assume unlimited for now or check 'crm_stages'?
            // Actually currently migration has max_queues.
            return true; // Not strictly enforcing yet as Stages are shared/default mostly.
        }

        if (resource === 'messages') {
            const now = new Date();
            const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const usageRes = await pool.query('SELECT messages_count FROM company_usage WHERE company_id = $1 AND month_year = $2', [companyId, monthYear]);
            const used = usageRes.rows.length > 0 ? usageRes.rows[0].messages_count : 0;
            const maxMessages = plan.max_messages_month || 1000;

            return used < maxMessages;
        }

        return true;
    } catch (error) {
        console.error(`[LimitService] Error checking limit for ${resource}:`, error);
        return false; // Fail safe
    }
};

export const incrementUsage = async (companyId: number, resource: ResourceType, amount: number = 1): Promise<void> => {
    if (!pool) return;
    try {
        if (resource === 'messages') {
            const now = new Date();
            const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            await pool.query(`
                INSERT INTO company_usage (company_id, month_year, messages_count)
                VALUES ($1, $2, $3)
                ON CONFLICT (company_id, month_year)
                DO UPDATE SET messages_count = company_usage.messages_count + $3, updated_at = NOW()
            `, [companyId, monthYear, amount]);
        }
    } catch (error) {
        console.error(`[LimitService] Error incrementing usage for ${resource}:`, error);
    }
};

export const getPlanStatus = async (companyId: number) => {
    if (!pool) throw new Error("Database not connected");

    const planRes = await pool.query(`
        SELECT p.*, c.name as company_name, c.due_date 
        FROM companies c
        LEFT JOIN plans p ON c.plan_id = p.id
        WHERE c.id = $1
    `, [companyId]);

    if (planRes.rows.length === 0) throw new Error("Company/Plan not found");
    const plan = planRes.rows[0];

    // Current Usage
    const usersRes = await pool.query('SELECT COUNT(*) FROM app_users WHERE company_id = $1 AND is_active = true', [companyId]);
    const agentsRes = await pool.query('SELECT COUNT(*) FROM ai_agents WHERE company_id = $1 AND status = \'active\'', [companyId]);
    const workflowsRes = await pool.query('SELECT COUNT(*) FROM system_workflows WHERE company_id = $1 AND status = \'active\'', [companyId]);

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const msgsRes = await pool.query('SELECT messages_count FROM company_usage WHERE company_id = $1 AND month_year = $2', [companyId, monthYear]);

    // Check overdue
    let isOverdue = false;
    if (plan.due_date) {
        const dueDate = new Date(plan.due_date);
        if (dueDate < new Date()) {
            // Check if it's strictly BEFORE today (ignoring time if due_date is just DATE)
            // If due_date is YYYY-MM-DD, comparison with new Date() (time included) works if we strip time or assume midnight.
            // Let's assume due_date is inclusive of the day, so strict inequality might be wrong if same day.
            // If due_date < now (and not today), it's overdue.
            // Ideally: dueDate set to 23:59:59 of that day.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dueDate < today) isOverdue = true;
        }
    }

    return {
        plan: {
            name: plan.name || 'Desconhecido',
            features: {
                campaigns: plan.use_campaigns,
                schedules: plan.use_schedules,
                internal_chat: plan.use_internal_chat,
                sub_accounts: true // Default true
            }
        },
        overdue: isOverdue,
        due_date: plan.due_date,
        usage: {
            users: {
                current: parseInt(usersRes.rows[0].count),
                max: null // Force unlimited in the UI/Status
            },
            ai_agents: {
                current: parseInt(agentsRes.rows[0].count),
                max: plan.max_ai_agents || 1
            },
            automations: {
                current: parseInt(workflowsRes.rows[0].count),
                max: plan.max_automations || 5
            },
            messages: {
                current: msgsRes.rows.length > 0 ? msgsRes.rows[0].messages_count : 0,
                max: plan.max_messages_month || 1000,
                period: monthYear
            }
        }
    };
};
