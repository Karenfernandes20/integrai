
import { Request, Response } from 'express';
import { pool } from '../db';

// 1. DRE Simplificado
export const getDRE = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { startDate, endDate, cityId, service } = req.query;
        const user = (req as any).user;
        const companyIdFilter = user?.company_id;

        let whereClause = "WHERE status = 'paid'";
        const params: any[] = [];

        if (startDate) {
            params.push(startDate);
            whereClause += ` AND paid_at >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            whereClause += ` AND paid_at <= $${params.length}`;
        }
        if (cityId) {
            params.push(cityId);
            whereClause += ` AND city_id = $${params.length}`;
        }
        if (service) {
            params.push(service);
            whereClause += ` AND category = $${params.length}`;
        }
        if (user.role !== 'SUPERADMIN' || companyIdFilter) {
            params.push(companyIdFilter);
            whereClause += ` AND (company_id = $${params.length} OR company_id IS NULL)`;
        }

        // Calculate Totals
        const summaryQuery = `
            SELECT 
                SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as gross_revenue,
                SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END) as expenses
            FROM financial_transactions
            ${whereClause}
        `;

        const result = await pool.query(summaryQuery, params);
        const { gross_revenue, expenses } = result.rows[0] || { gross_revenue: 0, expenses: 0 };

        const grossRevenue = Number(gross_revenue || 0);
        const totalExpenses = Number(expenses || 0);
        const grossProfit = grossRevenue - totalExpenses; // Simplified: Revenue - Expenses (assuming all payables are Op Costs/Expenses mixed)
        const netProfit = grossProfit; // In simplified DRE without taxes, it's roughly the same here

        // Comparison (Previous Period) - Simplified: Just dummy calculation or actual implementation
        // For actual implementation, we'd need to shift dates. Doing simplified for now.

        res.json({
            grossRevenue,
            operationalCosts: totalExpenses * 0.7, // Mock breakdown
            expenses: totalExpenses * 0.3, // Mock breakdown
            grossProfit,
            netProfit
        });
    } catch (error) {
        console.error('Error fetching DRE:', error);
        res.status(500).json({ error: 'Failed to fetch DRE' });
    }
};

// 2. Receita e Custo por Cidade / Serviço
export const getBreakdown = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { startDate, endDate, cityId, service } = req.query;
        const user = (req as any).user;
        const companyIdFilter = user?.company_id;
        const params: any[] = [];
        let whereClause = "WHERE status = 'paid'";

        if (startDate) {
            params.push(startDate);
            whereClause += ` AND paid_at >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            whereClause += ` AND paid_at <= $${params.length}`;
        }
        if (user.role !== 'SUPERADMIN' || companyIdFilter) {
            params.push(companyIdFilter);
            whereClause += ` AND (ft.company_id = $${params.length} OR ft.company_id IS NULL)`;
        }

        // By City
        const byCityQuery = `
            SELECT 
                c.name as city_name,
                SUM(CASE WHEN ft.type = 'receivable' THEN ft.amount ELSE 0 END) as revenue,
                SUM(CASE WHEN ft.type = 'payable' THEN ft.amount ELSE 0 END) as cost
            FROM financial_transactions ft
            LEFT JOIN cities c ON ft.city_id = c.id
            ${whereClause}
            GROUP BY c.name
            ORDER BY revenue DESC
        `;

        // By Service (Category)
        const byServiceQuery = `
            SELECT 
                category as service_name,
                SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as revenue,
                SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END) as cost
            FROM financial_transactions
            ${whereClause}
            GROUP BY category
            ORDER BY revenue DESC
        `;

        const [cityRes, serviceRes] = await Promise.all([
            pool.query(byCityQuery, params),
            pool.query(byServiceQuery, params)
        ]);

        res.json({
            byCity: cityRes.rows,
            byService: serviceRes.rows
        });

    } catch (error) {
        console.error('Error fetching breakdown:', error);
        res.status(500).json({ error: 'Failed to fetch breakdown' });
    }
};

// 3. Indicadores Financeiros (Margem, Lucro, Crescimento)
export const getFinancialIndicators = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const params: any[] = [];
        let companyFilter = "";

        if (user.role !== 'SUPERADMIN' || companyId) {
            params.push(companyId);
            companyFilter = `AND (company_id = $${params.length} OR company_id IS NULL)`;
        }

        // This month vs Last month
        const currentMonthQuery = `
            SELECT 
                SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as revenue,
                SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END) as cost
            FROM financial_transactions
            WHERE status = 'paid' 
            AND paid_at >= date_trunc('month', CURRENT_DATE)
            ${companyFilter}
        `;

        const lastMonthQuery = `
            SELECT 
                SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as revenue
            FROM financial_transactions
            WHERE status = 'paid' 
            AND paid_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND paid_at < date_trunc('month', CURRENT_DATE)
            ${companyFilter}
        `;

        // Evolution (Last 6 months)
        const evolutionQuery = `
             SELECT 
                to_char(paid_at, 'YYYY-MM') as month,
                SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as revenue,
                SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END) as cost
            FROM financial_transactions
            WHERE status = 'paid'
            AND paid_at >= CURRENT_DATE - INTERVAL '6 months'
            ${companyFilter}
            GROUP BY month
            ORDER BY month ASC
        `;

        const [currRes, lastRes, evolRes] = await Promise.all([
            pool.query(currentMonthQuery, params),
            pool.query(lastMonthQuery, params),
            pool.query(evolutionQuery, params)
        ]);

        const currRevenue = Number(currRes.rows[0]?.revenue || 0);
        const currCost = Number(currRes.rows[0]?.cost || 0);
        const currProfit = currRevenue - currCost;
        const margin = currRevenue > 0 ? (currProfit / currRevenue) * 100 : 0;

        const lastRevenue = Number(lastRes.rows[0]?.revenue || 0);
        const growth = lastRevenue > 0 ? ((currRevenue - lastRevenue) / lastRevenue) * 100 : 0;

        res.json({
            margin: margin.toFixed(2),
            totalProfit: currProfit.toFixed(2),
            growth: growth.toFixed(2),
            evolution: evolRes.rows
        });

    } catch (error) {
        console.error('Error fetching indicators:', error);
        res.status(500).json({ error: 'Failed to fetch indicators' });
    }
};
// 4. Relatórios Operacionais (Mensagens, Falhas, IA, Tarefas)
export const getOperationalReports = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { startDate, endDate, cityId } = req.query;
        const user = (req as any).user;
        const companyIdFilter = user?.company_id;
        const params: any[] = [];

        let dateFilter = "";
        if (startDate) {
            params.push(startDate);
            dateFilter += ` AND created_at >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            dateFilter += ` AND created_at <= $${params.length}`;
        }

        let companyFilter = "";
        if (user.role !== 'SUPERADMIN' || companyIdFilter) {
            const idx = params.push(companyIdFilter);
            companyFilter = ` AND (company_id = $${idx} OR company_id IS NULL)`;
        }

        // 1. Message Volume (Last 30 days or selected period)
        const msgParams = [...params]; // Copy params for distinct queries if needed, but here simple reuse is tricky due to different column names
        // Let's rebuild params for each query to be safe and simple

        const buildParams = (dateCol: string) => {
            const p = [];
            let w = "WHERE 1=1";
            if (startDate) {
                p.push(startDate);
                w += ` AND ${dateCol} >= $${p.length}`;
            }
            if (endDate) {
                p.push(endDate);
                w += ` AND ${dateCol} <= $${p.length}`;
            }
            if (user.role !== 'SUPERADMIN' || companyIdFilter) {
                p.push(companyIdFilter);
                w += ` AND (company_id = $${p.length} OR company_id IS NULL)`;
            }
            return { w, p };
        };

        // Messages
        const msgQ = buildParams('sent_at');
        const messagesQuery = `
            SELECT 
                to_char(sent_at, 'YYYY-MM-DD') as date,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound
            FROM whatsapp_messages
            ${msgQ.w.replace('created_at', 'sent_at')} 
            GROUP BY date
            ORDER BY date ASC
        `;

        // Tasks
        const taskQ = buildParams('updated_at');
        const tasksQuery = `
            SELECT COUNT(*) as completed_count
            FROM admin_tasks
            ${taskQ.w} AND status = 'completed'
        `;

        // Campaigns
        const campQ = buildParams('created_at');
        const campaignsQuery = `
            SELECT 
                SUM(sent_count) as total_sent,
                SUM(failed_count) as total_failed
            FROM whatsapp_campaigns
            ${campQ.w}
        `;

        // AI Usage (Mock or Audit)
        // Assuming AI usage is logged in audit_logs with resource_type='ai_agent'
        const auditQ = buildParams('created_at');
        const aiQuery = `
            SELECT COUNT(*) as count
            FROM audit_logs
            ${auditQ.w} AND resource_type = 'ai_agent'
        `;

        const [msgRes, taskRes, campRes, aiRes] = await Promise.all([
            pool.query(messagesQuery, msgQ.p),
            pool.query(tasksQuery, taskQ.p),
            pool.query(campaignsQuery, campQ.p),
            pool.query(aiQuery, auditQ.p)
        ]);

        // Process Message Data
        const messageVolume = msgRes.rows;
        const totalMessages = messageVolume.reduce((acc, curr) => acc + parseInt(curr.count), 0);
        const totalFailedMessages = messageVolume.reduce((acc, curr) => acc + parseInt(curr.failed), 0);
        const failureRateMsg = totalMessages > 0 ? (totalFailedMessages / totalMessages) * 100 : 0;

        // Campaigns
        const campSent = parseInt(campRes.rows[0]?.total_sent || 0);
        const campFailed = parseInt(campRes.rows[0]?.total_failed || 0);
        const campTotal = campSent + campFailed; // Approximation
        const failureRateCamp = campTotal > 0 ? (campFailed / campTotal) * 100 : 0;

        res.json({
            messageVolume,
            summary: {
                totalMessages,
                avgResponseTime: "2m 30s", // Mock for now
                tasksCompleted: parseInt(taskRes.rows[0]?.completed_count || 0),
                aiInteractions: parseInt(aiRes.rows[0]?.count || 0),
                failureRateMsg: failureRateMsg.toFixed(2),
                failureRateCamp: failureRateCamp.toFixed(2)
            }
        });

    } catch (error) {
        console.error('Error fetching operational reports:', error);
        res.status(500).json({ error: 'Failed to report' });
    }
};
