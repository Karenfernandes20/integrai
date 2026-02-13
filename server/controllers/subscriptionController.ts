
import { Request, Response } from "express";
import { pool } from "../db/index.js";
import { Server } from "socket.io";
import { logEvent } from "../logger.js";

// Helper to calculate next billing date
const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

export const getSubscription = async (req: Request, res: Response) => {
    // @ts-ignore
    const companyId = req.user?.companyId;

    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    try {
        // If no active subscription is found in 'subscriptions' table, check 'companies' table for plan_id fallback
        // This is common for legacy or manually set plans that didn't go through the billing flow
        const result = await pool?.query(`
            SELECT s.*, p.name as plan_name, p.price as plan_price, p.max_users
            FROM subscriptions s
            LEFT JOIN plans p ON s.plan_id = p.id
            WHERE s.company_id = $1
        `, [companyId]);

        let subscriptionData = result?.rows[0];

        if (!subscriptionData) {
            // Fallback: Check company directly
            const companyRes = await pool?.query(`
                SELECT c.plan_id, p.name as plan_name, c.due_date 
                FROM companies c
                LEFT JOIN plans p ON c.plan_id = p.id
                WHERE c.id = $1
            `, [companyId]);

            if (companyRes && companyRes.rows && companyRes.rows.length > 0 && companyRes.rows[0].plan_id) {
                // Construct a mock subscription object based on company plan
                const companyData = companyRes.rows[0];
                subscriptionData = {
                    status: 'active', // Assume active if assigned in company
                    plan_name: companyData.plan_name,
                    plan_id: companyData.plan_id,
                    current_period_end: companyData.due_date,
                    trial_end: null
                };
            }
        }

        if (!subscriptionData) {
            return res.json({ status: 'none', message: "No active subscription" });
        }

        // Calculate overdue status
        if (subscriptionData.current_period_end) {
            subscriptionData.overdue = new Date(subscriptionData.current_period_end) < new Date();
            // Ensure due_date is present for frontend compatibility
            if (!subscriptionData.due_date) {
                subscriptionData.due_date = subscriptionData.current_period_end;
            }
        } else {
            subscriptionData.overdue = false;
        }

        res.json(subscriptionData);
    } catch (error) {
        console.error("Error fetching subscription:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createSubscription = async (req: Request, res: Response) => {
    // @ts-ignore
    const companyId = req.user?.companyId;
    const { planId } = req.body;

    if (!companyId || !planId) return res.status(400).json({ error: "Missing fields" });

    try {
        const planRes = await pool?.query("SELECT * FROM plans WHERE id = $1", [planId]);
        if (!planRes || planRes.rows.length === 0) return res.status(404).json({ error: "Plan not found" });
        const plan = planRes.rows[0];

        const startDate = new Date();
        const endDate = addMonths(startDate, 1);

        // Upsert subscription
        // If conflict on company_id, update it
        await pool?.query(`
            INSERT INTO subscriptions (company_id, plan_id, status, current_period_start, current_period_end)
            VALUES ($1, $2, 'active', $3, $4)
            ON CONFLICT (company_id) 
            DO UPDATE SET plan_id = $2, status = 'active', current_period_start = $3, current_period_end = $4, updated_at = NOW()
        `, [companyId, planId, startDate, endDate]);

        // Update company table plan_id link
        await pool?.query("UPDATE companies SET plan_id = $1, due_date = $2 WHERE id = $3", [planId, endDate, companyId]);

        // Log the event
        logEvent({
            eventType: 'subscription_created',
            origin: 'billing',
            status: 'success',
            companyId,
            message: `Plano ${plan.name} ativado`,
            details: { plan_id: planId, price: plan.price }
        });

        res.json({ success: true, message: "Subscription activated" });
    } catch (error) {
        console.error("Error creating subscription:", error);
        res.status(500).json({ error: "Internal error" });
    }
};

export const cancelSubscription = async (req: Request, res: Response) => {
    // @ts-ignore
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    try {
        await pool?.query(`
            UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = true WHERE company_id = $1
        `, [companyId]);

        res.json({ success: true, message: "Subscription cancelled (will end at period end)" });
    } catch (error) {
        res.status(500).json({ error });
    }
};

export const getInvoices = async (req: Request, res: Response) => {
    // @ts-ignore
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(400).json({ error: "Company ID required" });

    try {
        const result = await pool?.query(`
            SELECT * FROM invoices WHERE company_id = $1 ORDER BY created_at DESC
        `, [companyId]);
        res.json(result?.rows || []);
    } catch (error) {
        res.status(500).json({ error: "Internal error" });
    }
};

// Scheduler Function to be called from index.ts
export const checkSubscriptions = async (io: Server) => {
    if (!pool) return;

    // console.log("Checking subscriptions for renewals..."); 

    try {
        // Find subscriptions expiring soon (today or past) that are ACTIVE
        // We look for anything where current_period_end < NOW
        const result = await pool.query(`
            SELECT s.*, c.name as company_name, p.price 
            FROM subscriptions s
            JOIN companies c ON s.company_id = c.id
            LEFT JOIN plans p ON s.plan_id = p.id
            WHERE s.status = 'active' AND s.current_period_end < NOW()
        `);

        for (const sub of result.rows) {
            // Check if cancelled
            if (sub.cancel_at_period_end) {
                await pool.query(`UPDATE subscriptions SET status = 'cancelled' WHERE id = $1`, [sub.id]);
                console.log(`Subscription for company ${sub.company_id} EXPIRED and CANCELLED.`);
                continue;
            }

            // Attempt Auto-Renew (Mock)
            // In real world, we would charge the card here.
            // If success:
            const newEnd = addMonths(new Date(sub.current_period_end), 1);

            await pool.query(`
                UPDATE subscriptions 
                SET current_period_start = current_period_end, 
                    current_period_end = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [newEnd, sub.id]);

            // Also update companies due_date
            await pool.query(`UPDATE companies SET due_date = $1 WHERE id = $2`, [newEnd, sub.company_id]);

            // Generate Invoice
            const amount = sub.price || 0;
            await pool.query(`
                INSERT INTO invoices (subscription_id, company_id, amount, status, due_date, paid_at, created_at)
                VALUES ($1, $2, $3, 'paid', NOW(), NOW(), NOW())
            `, [sub.id, sub.company_id, amount]);

            // Notify
            if (io) {
                io.to(`company_${sub.company_id}`).emit("notification", {
                    title: "Renovação de Assinatura",
                    message: "Sua assinatura foi renovada com sucesso para o próximo mês.",
                    type: "success"
                });
            }

            console.log(`Renewed subscription for company ${sub.company_id} until ${newEnd.toISOString()}`);

            logEvent({
                eventType: 'subscription_renewed',
                origin: 'system',
                status: 'success',
                companyId: sub.company_id,
                message: "Renovação Automática",
                details: { amount, newEnd }
            });
        }
    } catch (e) {
        console.error("Error checking subscriptions:", e);
    }
};
