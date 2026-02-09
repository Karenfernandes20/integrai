
import { Request, Response } from 'express';
import { pool } from '../db';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

// --- DASHBOARD ---

export const getClinicalDashboard = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { startDate, endDate } = req.query;

        // Default to current month if not provided
        const start = startDate ? String(startDate) : format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const end = endDate ? String(endDate) : format(endOfMonth(new Date()), 'yyyy-MM-dd');

        // Parallel queries for performance
        const [
            totals,
            byInsurance,
            byProfessional,
            cashflow
        ] = await Promise.all([
            // 1. Totals (Revenue, Expenses, Receivables, Payables)
            pool!.query(`
                SELECT 
                    SUM(CASE WHEN type = 'receivable' AND status = 'paid' THEN amount ELSE 0 END) as revenue,
                    SUM(CASE WHEN type = 'payable' AND status = 'paid' THEN amount ELSE 0 END) as expenses,
                    SUM(CASE WHEN type = 'receivable' AND status = 'pending' THEN amount ELSE 0 END) as receivables,
                    SUM(CASE WHEN type = 'payable' AND status = 'pending' THEN amount ELSE 0 END) as payables,
                    COUNT(CASE WHEN type = 'receivable' AND status = 'paid' THEN 1 END) as total_attendances
                FROM financial_transactions
                WHERE company_id = $1 
                AND (
                    (status = 'paid' AND issue_date BETWEEN $2 AND $3) OR
                    (status = 'pending' AND due_date BETWEEN $2 AND $3)
                )
                AND status != 'excluded'
            `, [companyId, start, end]),

            // 2. By Insurance Plan (Top 5)
            pool!.query(`
                SELECT ip.name, SUM(ft.amount) as total
                FROM financial_transactions ft
                JOIN insurance_plans ip ON ft.insurance_plan_id = ip.id
                WHERE ft.company_id = $1 
                AND ft.type = 'receivable'
                AND ft.issue_date BETWEEN $2 AND $3
                AND ft.status != 'excluded'
                GROUP BY ip.name
                ORDER BY total DESC
                LIMIT 5
            `, [companyId, start, end]),

            // 3. By Professional (Top 5)
            pool!.query(`
                SELECT p.name, SUM(ft.amount) as total
                FROM financial_transactions ft
                JOIN professionals p ON ft.professional_id = p.id
                WHERE ft.company_id = $1 
                AND ft.type = 'receivable'
                AND ft.issue_date BETWEEN $2 AND $3
                AND ft.status != 'excluded'
                GROUP BY p.name
                ORDER BY total DESC
                LIMIT 5
            `, [companyId, start, end]),

            // 4. Daily Cashflow
            pool!.query(`
                SELECT 
                    TO_CHAR(issue_date, 'YYYY-MM-DD') as date,
                    SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as income,
                    SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END) as outcome
                FROM financial_transactions
                WHERE company_id = $1 
                AND status = 'paid'
                AND issue_date BETWEEN $2 AND $3
                GROUP BY date
                ORDER BY date
            `, [companyId, start, end])
        ]);

        const stats = totals.rows[0];
        const ticket_average = stats.total_attendances > 0 ? stats.revenue / stats.total_attendances : 0;

        res.json({
            summary: { ...stats, ticket_average },
            byInsurance: byInsurance.rows,
            byProfessional: byProfessional.rows,
            cashflow: cashflow.rows
        });

    } catch (error: any) {
        console.error("Error getting clinical dashboard:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- TRANSACTIONS ---

export const getClinicalTransactions = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { startDate, endDate, status, patientId, professionalId, insuranceId, type } = req.query;

        let query = `
            SELECT ft.*, 
                p.name as professional_name, 
                c.name as patient_name,
                ip.name as insurance_name
            FROM financial_transactions ft
            LEFT JOIN professionals p ON ft.professional_id = p.id
            LEFT JOIN leads c ON ft.patient_id = c.id -- Assuming 'leads' table holds patients/contacts
            LEFT JOIN insurance_plans ip ON ft.insurance_plan_id = ip.id
            WHERE ft.company_id = $1
            AND ft.status != 'excluded'
        `;

        const params: any[] = [companyId];
        let paramIndex = 2;

        if (startDate && endDate) {
            query += ` AND (ft.issue_date BETWEEN $${paramIndex} AND $${paramIndex + 1} OR ft.due_date BETWEEN $${paramIndex} AND $${paramIndex + 1})`;
            params.push(startDate, endDate);
            paramIndex += 2;
        }

        if (status && status !== 'all') {
            query += ` AND ft.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (type && type !== 'all') {
            query += ` AND ft.type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }

        if (patientId) {
            query += ` AND ft.patient_id = $${paramIndex}`;
            params.push(patientId);
            paramIndex++;
        }

        if (professionalId) {
            query += ` AND ft.professional_id = $${paramIndex}`;
            params.push(professionalId);
            paramIndex++;
        }

        if (insuranceId) {
            query += ` AND ft.insurance_plan_id = $${paramIndex}`;
            params.push(insuranceId);
            paramIndex++;
        }

        query += ` ORDER BY ft.due_date DESC, ft.created_at DESC LIMIT 500`;

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        console.error("Error getting clinical transactions:", error);
        res.status(500).json({ error: error.message });
    }
};

export const createClinicalTransaction = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const {
            description, amount, type, category,
            due_date, issue_date, status, notes,
            patient_id, professional_id, insurance_plan_id,
            procedure_type, payment_method, cost_center_id, attachment_url
        } = req.body;

        const result = await pool!.query(
            `INSERT INTO financial_transactions (
                company_id, description, amount, type, category,
                due_date, issue_date, status, notes,
                patient_id, professional_id, insurance_plan_id,
                procedure_type, payment_method, cost_center_id, attachment_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                companyId, description, amount, type, category,
                due_date, issue_date, status || 'pending', notes,
                patient_id, professional_id, insurance_plan_id,
                procedure_type, payment_method, cost_center_id, attachment_url
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error("Error creating clinical transaction:", error);
        res.status(500).json({ error: error.message });
    }
};

export const updateClinicalTransaction = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const {
            description, amount, status, category,
            due_date, issue_date, notes,
            patient_id, professional_id, insurance_plan_id,
            procedure_type, payment_method, cost_center_id
        } = req.body;

        const result = await pool!.query(
            `UPDATE financial_transactions SET
                description = COALESCE($1, description),
                amount = COALESCE($2, amount),
                status = COALESCE($3, status),
                category = COALESCE($4, category),
                due_date = COALESCE($5, due_date),
                issue_date = COALESCE($6, issue_date),
                notes = COALESCE($7, notes),
                patient_id = COALESCE($8, patient_id),
                professional_id = COALESCE($9, professional_id),
                insurance_plan_id = COALESCE($10, insurance_plan_id),
                procedure_type = COALESCE($11, procedure_type),
                payment_method = COALESCE($12, payment_method),
                cost_center_id = COALESCE($13, cost_center_id),
                updated_at = NOW()
            WHERE id = $14 AND company_id = $15
            RETURNING *`,
            [
                description, amount, status, category,
                due_date, issue_date, notes,
                patient_id, professional_id, insurance_plan_id,
                procedure_type, payment_method, cost_center_id,
                id, companyId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found or denied' });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error("Error updating clinical transaction:", error);
        res.status(500).json({ error: error.message });
    }
};
