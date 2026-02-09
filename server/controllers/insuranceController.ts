
import { Request, Response } from 'express';
import { pool } from '../db';

export const getInsurancePlans = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const result = await pool!.query(
            "SELECT * FROM crm_insurance_plans WHERE company_id = $1 ORDER BY name ASC",
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error("Error fetching insurance plans:", error);
        res.status(500).json({ error: error.message });
    }
};

export const createInsurancePlan = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const {
            name, code, type, contact_phone, email, region,
            status, repayment_days_avg, rules, color, procedures_table
        } = req.body;

        const result = await pool!.query(
            `INSERT INTO crm_insurance_plans (
                company_id, name, code, type, contact_phone, email, region, 
                status, repayment_days_avg, rules, color, procedures_table
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                companyId, name, code, type, contact_phone, email, region,
                status || 'ACTIVE', repayment_days_avg || 30, rules, color || '#3b82f6',
                procedures_table ? JSON.stringify(procedures_table) : '[]'
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error("Error creating insurance plan:", error);
        res.status(500).json({ error: error.message });
    }
};

export const updateInsurancePlan = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const {
            name, code, type, contact_phone, email, region,
            status, repayment_days_avg, rules, color, procedures_table
        } = req.body;

        const result = await pool!.query(
            `UPDATE crm_insurance_plans
             SET name = COALESCE($1, name),
                 code = COALESCE($2, code),
                 type = COALESCE($3, type),
                 contact_phone = COALESCE($4, contact_phone),
                 email = COALESCE($5, email),
                 region = COALESCE($6, region),
                 status = COALESCE($7, status),
                 repayment_days_avg = COALESCE($8, repayment_days_avg),
                 rules = COALESCE($9, rules),
                 color = COALESCE($10, color),
                 procedures_table = COALESCE($11, procedures_table::jsonb),
                 updated_at = NOW()
             WHERE id = $12 AND company_id = $13
             RETURNING *`,
            [
                name, code, type, contact_phone, email, region,
                status, repayment_days_avg, rules, color,
                procedures_table ? JSON.stringify(procedures_table) : null,
                id, companyId
            ]
        );

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error("Error updating insurance plan:", error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteInsurancePlan = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        await pool!.query(
            "DELETE FROM crm_insurance_plans WHERE id = $1 AND company_id = $2",
            [id, companyId]
        );
        res.json({ message: "Insurance plan deleted" });
    } catch (error: any) {
        console.error("Error deleting insurance plan:", error);
        res.status(500).json({ error: error.message });
    }
};

// Professional Configurations
export const getProfessionalInsuranceConfigs = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { professional_id } = req.query;

        let query = "SELECT * FROM crm_professional_insurance_config WHERE company_id = $1";
        const params = [companyId];

        if (professional_id) {
            query += " AND professional_id = $2";
            params.push(professional_id as any);
        }

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const upsertProfessionalInsuranceConfig = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { professional_id, insurance_plan_id, consultation_value, commission_value, commission_type, monthly_limit, priority, active } = req.body;

        const result = await pool!.query(
            `INSERT INTO crm_professional_insurance_config (
                company_id, professional_id, insurance_plan_id, consultation_value, 
                commission_value, commission_type, monthly_limit, priority, active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (professional_id, insurance_plan_id) DO UPDATE SET
                consultation_value = EXCLUDED.consultation_value,
                commission_value = EXCLUDED.commission_value,
                commission_type = EXCLUDED.commission_type,
                monthly_limit = EXCLUDED.monthly_limit,
                priority = EXCLUDED.priority,
                active = EXCLUDED.active
            RETURNING *`,
            [companyId, professional_id, insurance_plan_id, consultation_value, commission_value, commission_type || 'FIXED', monthly_limit, priority || 0, active !== false]
        );

        res.json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
