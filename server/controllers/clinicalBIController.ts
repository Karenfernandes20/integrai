
import { Request, Response } from 'express';
import { pool } from '../db';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export const getClinicalBIStats = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { start, end, professional_id, insurance_plan_id } = req.query;

        const dateStart = start ? new Date(start as string) : subDays(new Date(), 30);
        const dateEnd = end ? new Date(end as string) : new Date();

        const params: any[] = [companyId, dateStart, dateEnd];
        let professionalFilter = "";
        let insuranceFilter = "";

        if (professional_id) {
            professionalFilter = " AND a.responsible_id = $4";
            params.push(professional_id);
        }
        if (insurance_plan_id) {
            insuranceFilter = ` AND a.insurance_plan_id = $${params.length + 1}`;
            params.push(insurance_plan_id);
        }

        // 1. Overview KPIs
        const kpiQuery = `
            SELECT 
                COUNT(*) as total_appointments,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as attended,
                COUNT(CASE WHEN status = 'no-show' THEN 1 END) as no_shows,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                SUM(billing_amount) as total_billing,
                SUM(CASE WHEN billing_status = 'PENDING' THEN billing_amount ELSE 0 END) as pending_billing,
                SUM(glosa_value) as total_glosa
            FROM crm_appointments a
            WHERE a.company_id = $1 AND a.start_time BETWEEN $2 AND $3
            ${professionalFilter} ${insuranceFilter}
        `;
        const kpis = (await pool!.query(kpiQuery, params)).rows[0];

        // 2. Billing by Insurance
        const insuranceQuery = `
            SELECT 
                ip.name as insurance_name,
                COUNT(a.id) as count,
                SUM(a.billing_amount) as total
            FROM crm_appointments a
            JOIN crm_insurance_plans ip ON a.insurance_plan_id = ip.id
            WHERE a.company_id = $1 AND a.start_time BETWEEN $2 AND $3
            ${professionalFilter}
            GROUP BY ip.name
            ORDER BY total DESC
        `;
        const billingByInsurance = (await pool!.query(insuranceQuery, [companyId, dateStart, dateEnd])).rows;

        // 3. Billing by Professional
        const professionalQuery = `
            SELECT 
                p.name as professional_name,
                COUNT(a.id) as count,
                SUM(a.billing_amount) as total
            FROM crm_appointments a
            JOIN crm_professionals p ON a.responsible_id = p.id
            WHERE a.company_id = $1 AND a.start_time BETWEEN $2 AND $3
            ${insuranceFilter}
            GROUP BY p.name
            ORDER BY total DESC
        `;
        const billingByProfessional = (await pool!.query(professionalQuery, [companyId, dateStart, dateEnd])).rows;

        // 4. Daily Volume
        const dailyQuery = `
            SELECT 
                DATE_TRUNC('day', start_time) as date,
                COUNT(*) as count,
                SUM(billing_amount) as revenue
            FROM crm_appointments a
            WHERE a.company_id = $1 AND a.start_time BETWEEN $2 AND $3
            ${professionalFilter} ${insuranceFilter}
            GROUP BY date
            ORDER BY date ASC
        `;
        const dailyStats = (await pool!.query(dailyQuery, params)).rows;

        res.json({
            kpis,
            billingByInsurance,
            billingByProfessional,
            dailyStats
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
