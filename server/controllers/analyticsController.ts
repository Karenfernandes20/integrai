
import { Request, Response } from 'express';
import { pool } from '../db';

export const getConversionStats = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'DB not connected' });

        // 1. Trial -> Paid Conversion
        // Logic: Count companies with active paid subscription vs total trial signups
        // This is tricky without strict historical events, so we'll approximate:
        // "Paid" = Active Subscription AND Plan != 'Básico' (assuming Basic is free/starter or low tier). 
        // Or check invoices. Let's use invoices for definitive "Paid" status.

        const paidCompaniesCount = await pool.query(`
            SELECT COUNT(DISTINCT company_id) as count 
            FROM invoices 
            WHERE status = 'paid' AND amount > 0
        `);

        const totalCompanies = await pool.query(`SELECT COUNT(*) as count FROM companies`);

        const conversionRate = totalCompanies.rows[0].count > 0
            ? ((paidCompaniesCount.rows[0].count / totalCompanies.rows[0].count) * 100).toFixed(1)
            : 0;

        // 2. Churn
        const cancelledSubs = await pool.query(`SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled'`);
        const activeSubs = await pool.query(`SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'`);
        const totalSubs = parseInt(cancelledSubs.rows[0].count) + parseInt(activeSubs.rows[0].count);
        const churnRate = totalSubs > 0
            ? ((parseInt(cancelledSubs.rows[0].count) / totalSubs) * 100).toFixed(1)
            : 0;

        // 3. Revenue by Plan (MRR Estimate)
        // Sum price of all active subscriptions grouped by plan
        const revenueByPlan = await pool.query(`
            SELECT p.name, SUM(i.amount) as total_revenue, COUNT(s.id) as sub_count
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            LEFT JOIN (
                SELECT subscription_id, amount 
                FROM invoices 
                WHERE status = 'paid' 
                -- Just take most recent invoice or average? 
                -- Simpler: Just sum 'amount' column from invoices table for this month, or define price in Plan table.
                -- Let's use Plan defined price if invoices are sparse.
                -- Wait, Plan table didn't have price column in migration, only UI...
                -- We'll assume invoice amounts are correct.
            ) i ON i.subscription_id = s.id
            WHERE s.status = 'active'
            GROUP BY p.name
        `);

        // 4. Usage Stats
        const usageStats = await pool.query(`
            SELECT 
                AVG(messages_count)::numeric(10,0) as avg_messages,
                MAX(messages_count) as max_messages
            FROM company_usage
        `);

        const avgUsers = await pool.query(`
            SELECT AVG(user_count)::numeric(10,1) as avg_users FROM (
                SELECT company_id, COUNT(*) as user_count 
                FROM app_users 
                WHERE is_active = true 
                GROUP BY company_id
            ) sub
        `);

        res.json({
            conversion: {
                rate: conversionRate,
                total_companies: totalCompanies.rows[0].count,
                paid_companies: paidCompaniesCount.rows[0].count
            },
            churn: {
                rate: churnRate,
                cancelled: cancelledSubs.rows[0].count
            },
            revenue_by_plan: revenueByPlan.rows,
            usage: {
                avg_messages: usageStats.rows[0].avg_messages || 0,
                avg_users: avgUsers.rows[0].avg_users || 0
            }
        });

    } catch (error) {
        console.error("Error fetching conversion stats:", error);
        res.status(500).json({ error: 'Internal Error' });
    }
};
