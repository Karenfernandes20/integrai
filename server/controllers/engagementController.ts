
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
            AND role != 'SUPERADMIN'
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

// 4. Cleanup Invalid Tasks (Self-healing)
// Fixes: "User logged in but task remains pending"
const cleanupInvalidTasks = async () => {
    if (!pool) return;
    try {
        // Fetch pending engagement tasks
        const tasks = await pool.query(`
            SELECT id, title, description, company_id 
            FROM admin_tasks 
            WHERE status = 'pending' 
            AND (title LIKE 'Reativar Lead%' OR title LIKE 'Churn Risk%')
        `);

        for (const task of tasks.rows) {
            // Extract email from description
            // Description formats:
            // "O usuário [email] criou conta há 3 dias..."
            // "O usuário [email] não acessa o sistema..."
            const emailMatch = task.description.match(/O usuário ([^ ]+) /);
            if (!emailMatch || !emailMatch[1]) continue;

            const email = emailMatch[1];

            // Check current user status
            const userRes = await pool.query(`
                SELECT last_login FROM app_users WHERE email = $1
            `, [email]);

            if (userRes.rows.length === 0) continue; // User deleted? Keep task or investigate manually.

            const user = userRes.rows[0];

            let shouldClose = false;

            if (task.title.startsWith('Reativar Lead')) {
                // Invalid if: User HAS logged in
                if (user.last_login !== null) {
                    shouldClose = true;
                }
            } else if (task.title.startsWith('Churn Risk')) {
                // Invalid if: User logged in recently (within last 30 days)
                // If last_login > NOW - 30 days
                if (user.last_login && new Date(user.last_login) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
                    shouldClose = true;
                }
            }

            if (shouldClose) {
                await pool.query(`
                    UPDATE admin_tasks 
                    SET status = 'completed', 
                        completed_at = NOW()
                    WHERE id = $1
                `, [task.id]);

                // Also auto-read pending alerts for this user to avoid confusion
                await pool.query(`
                    UPDATE admin_alerts 
                    SET is_read = true 
                    WHERE description LIKE $1 AND is_read = false
                `, [`%${email}%`]);

                console.log(`[Engagement] Auto-resolved task ${task.id} (${task.title}) because condition is no longer met.`);
            }
        }

    } catch (e) {
        console.error("Error cleaning up invalid tasks:", e);
    }
};

export const runEngagementChecks = async () => {
    console.log("[Engagement] Running periodic checks...");
    await cleanupInvalidTasks(); // Cleanup first
    await checkAccountActivation();
    await checkUserInactivity();
    await checkResourceLimitsLead();
};
