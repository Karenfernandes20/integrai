
import { pool } from "../db";

// Helper to prevent duplicate tasks
const ensureTaskExists = async (
    title: string,
    description: string,
    companyId: number,
    priority: 'low' | 'medium' | 'high' = 'medium'
) => {
    if (!pool) return;

    // Check if a similar pending task exists
    const existing = await pool.query(`
        SELECT id FROM admin_tasks 
        WHERE title = $1 AND company_id = $2 AND status != 'completed'
    `, [title, companyId]);

    if (existing.rows.length > 0) return; // Already exists

    // Create Task
    await pool.query(`
        INSERT INTO admin_tasks (title, description, status, priority, company_id, due_date)
        VALUES ($1, $2, 'pending', $3, $4, NOW() + INTERVAL '3 days')
    `, [title, description, priority, companyId]);

    // Create Alert
    await pool.query(`
        INSERT INTO admin_alerts (type, description, is_read, created_at)
        VALUES ('engagement', $1, false, NOW())
    `, [`${title} - ${description}`]);

    console.log(`[Engagement] Created task & alert '${title}' for company ${companyId}`);
};

// 1. Check for Accounts Created but Not Activated (e.g., No Login after 3 days)
export const checkAccountActivation = async () => {
    if (!pool) return;

    try {
        const result = await pool.query(`
            SELECT id, full_name, email, company_id, created_at
            FROM app_users
            WHERE created_at < NOW() - INTERVAL '3 days'
            AND last_login IS NULL
            AND is_active = true
        `);

        for (const user of result.rows) {
            await ensureTaskExists(
                `Reativar Lead: ${user.full_name}`,
                `O usuário ${user.email} criou conta há 3 dias e nunca fez login. Entrar em contato para ajudar no setup.`,
                user.company_id,
                'high'
            );
        }
    } catch (e) {
        console.error("Error checking account activation:", e);
    }
};

// 2. Check for Inactive Users (No login for 30 days)
export const checkUserInactivity = async () => {
    if (!pool) return;

    try {
        const result = await pool.query(`
            SELECT id, full_name, email, company_id, last_login
            FROM app_users
            WHERE last_login < NOW() - INTERVAL '30 days'
            AND is_active = true
        `);

        for (const user of result.rows) {
            await ensureTaskExists(
                `Churn Risk: ${user.full_name}`,
                `O usuário ${user.email} não acessa o sistema há mais de 30 dias. Verificar motivo e oferecer ajuda.`,
                user.company_id,
                'medium'
            );
        }
    } catch (e) {
        console.error("Error checking user inactivity:", e);
    }
};

// 3. Check for Limit Proximity (Upsell Opportunity)
export const checkResourceLimitsLead = async () => {
    if (!pool) return;

    try {
        // Check Messages Usage > 80%
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const usageRes = await pool.query(`
            SELECT u.company_id, u.messages_count, p.max_messages_month, c.name as company_name
            FROM company_usage u
            JOIN companies c ON u.company_id = c.id
            JOIN plans p ON c.plan_id = p.id
            WHERE u.month_year = $1
        `, [monthYear]);

        for (const usage of usageRes.rows) {
            const limit = usage.max_messages_month || 1000;
            const percent = (usage.messages_count / limit) * 100;

            if (percent >= 80) {
                await ensureTaskExists(
                    `Oportunidade de Upsell: ${usage.company_name}`,
                    `A empresa atingiu ${percent.toFixed(1)}% do limite de mensagens (${usage.messages_count}/${limit}). Oferecer plano superior.`,
                    usage.company_id,
                    'high'
                );
            }
        }
    } catch (e) {
        console.error("Error checking resource limits:", e);
    }
};

export const runEngagementChecks = async () => {
    console.log("[Engagement] Running periodic checks...");
    await checkAccountActivation();
    await checkUserInactivity();
    await checkResourceLimitsLead();
};
