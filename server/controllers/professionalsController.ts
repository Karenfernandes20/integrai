
import { Request, Response } from 'express';
import { pool } from '../db';

export const getProfessionals = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const result = await pool!.query(
            "SELECT * FROM crm_professionals WHERE company_id = $1 ORDER BY active DESC, name ASC",
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error("Error fetching professionals:", error);
        res.status(500).json({ error: error.message });
    }
};

export const createProfessional = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { name, specialty, phone, email, active, color } = req.body;

        const result = await pool!.query(
            `INSERT INTO crm_professionals (company_id, name, specialty, phone, email, active, color)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [companyId, name, specialty, phone, email, active !== false, color || '#3b82f6']
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error("Error creating professional:", error);
        res.status(500).json({ error: error.message });
    }
};

export const updateProfessional = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const { name, specialty, phone, email, active, color } = req.body;

        const result = await pool!.query(
            `UPDATE crm_professionals
             SET name = COALESCE($1, name),
                 specialty = COALESCE($2, specialty),
                 phone = COALESCE($3, phone),
                 email = COALESCE($4, email),
                 active = COALESCE($5, active),
                 color = COALESCE($6, color),
                 updated_at = NOW()
             WHERE id = $7 AND company_id = $8
             RETURNING *`,
            [name, specialty, phone, email, active, color, id, companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Professional not found" });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error("Error updating professional:", error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteProfessional = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        // Soft delete usually better, but let's do hard delete or inactive?
        // Let's toggle active = false for safety, or hard delete if requested.
        // User probably expects delete. 
        // If hard delete, we might orphan appointments unless we ON DELETE SET NULL or CASCADE.
        // I'll do soft delete (active = false) if delete is requested?
        // Or just hard delete and let user deal with missing responsible?

        // Let's hard delete for now as per minimal viable.
        const result = await pool!.query(
            "DELETE FROM crm_professionals WHERE id = $1 AND company_id = $2 RETURNING id",
            [id, companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Professional not found" });
        }

        res.json({ message: "Professional deleted" });
    } catch (error: any) {
        console.error("Error deleting professional:", error);
        res.status(500).json({ error: error.message });
    }
};
