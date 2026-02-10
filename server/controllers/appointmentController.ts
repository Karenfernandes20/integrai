
import { Request, Response } from 'express';
import { pool } from '../db';

export const getCrmAppointments = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { start, end, responsible_id, lead_id } = req.query;

        const params: any[] = [];
        // DEBUG: REMOVED ALL JOINS TO ISOLATE THE ISSUE
        let query = `
            SELECT a.id, a.title, a.client_name, a.phone, a.status, a.type, a.description, a.location, 
                   a.start_time, a.end_time,
                   a.lead_id, a.responsible_id, a.insurance_plan_id, a.billing_amount
            FROM crm_appointments a
            WHERE 1=1 AND a.deleted_at IS NULL
        `;

        if (companyId) {
            params.push(companyId);
            query += ` AND a.company_id = $${params.length}`;
        }

        console.log("DEBUG: RAW QUERY WITHOUT JOINS");

        // COMPLETELY BYPASS ALL OTHER FILTERS FOR NOW
        // console.log("DEBUG: BYPASSING ALL FILTERS EXCEPT COMPANY_ID");

        // if (start && end) {
        //     params.push(start, end);
        if (start && end) {
            params.push(start, end);
            // Use timestamptz casting to ensure correct timezone comparison
            // Buffer of 24 hours (1 day) to handle any UTC/Local offset issues gracefully without manual math
            query += ` AND a.start_time >= ($${params.length - 1}::timestamptz - INTERVAL '24 hours') AND a.start_time <= ($${params.length}::timestamptz + INTERVAL '24 hours')`;
        }

        if (responsible_id && responsible_id !== 'all') {
            params.push(responsible_id);
            query += ` AND a.responsible_id = $${params.length}`;
        }

        if (lead_id) {
            params.push(lead_id);
            query += ` AND a.lead_id = $${params.length}`;
        }

        query += " ORDER BY a.start_time ASC";

        const result = await pool!.query(query, params);

        const events = result.rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            client: row.client_name || row.lead_name || 'Cliente',
            clientAvatar: row.lead_avatar,
            whatsapp: row.phone,
            // Ensure dates are valid ISO strings
            start: row.start_time instanceof Date ? row.start_time.toISOString() : row.start_time,
            end: row.end_time instanceof Date ? row.end_time.toISOString() : row.end_time,
            status: row.status,
            type: row.type,
            responsible: row.responsible_name || 'Sem Responsável',
            professionalColor: row.professional_color,
            responsibleId: row.responsible_id,
            description: row.description,
            location: row.location,
            leadId: row.lead_id,
            insurance_plan_id: row.insurance_plan_id,
            billing_amount: row.billing_amount
        }));

        res.json(events);
    } catch (error: any) {
        console.error('Error fetching CRM appointments:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createCrmAppointment = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const {
            title, lead_id, client_name, phone, start_time, end_time,
            status, type, responsible_id, description, location,
            insurance_plan_id, billing_amount
        } = req.body;

        const result = await pool!.query(
            `INSERT INTO crm_appointments (
                company_id, title, lead_id, client_name, phone,
                start_time, end_time, status, type, responsible_id,
                description, location, insurance_plan_id, billing_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *`,
            [
                companyId, title, lead_id || null, client_name, phone,
                start_time, end_time, status || 'scheduled', type || 'meeting',
                responsible_id || null, description, location,
                insurance_plan_id || null, billing_amount || 0
            ]
        );

        console.log("--- CREATE APPOINTMENT DEBUG ---");
        console.log("Payload:", req.body);
        console.log("Created Row:", result.rows[0]);

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error("Error creating appointment:", error);
        res.status(500).json({ error: error.message });
    }
};

export const updateCrmAppointment = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;
        const {
            title, lead_id, client_name, phone, start_time, end_time,
            status, type, responsible_id, description, location,
            insurance_plan_id, billing_amount
        } = req.body;

        const result = await pool!.query(
            `UPDATE crm_appointments SET
                title = COALESCE($1, title),
                lead_id = COALESCE($2, lead_id),
                client_name = COALESCE($3, client_name),
                phone = COALESCE($4, phone),
                start_time = COALESCE($5, start_time),
                end_time = COALESCE($6, end_time),
                status = COALESCE($7, status),
                type = COALESCE($8, type),
                responsible_id = COALESCE($9, responsible_id),
                description = COALESCE($10, description),
                location = COALESCE($11, location),
                insurance_plan_id = COALESCE($12, insurance_plan_id),
                billing_amount = COALESCE($13, billing_amount),
                updated_at = NOW()
            WHERE id = $14 AND company_id = $15
            RETURNING *`,
            [
                title, lead_id, client_name, phone, start_time, end_time,
                status, type, responsible_id, description, location,
                insurance_plan_id, billing_amount, id, companyId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error("Error updating appointment:", error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteCrmAppointment = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { id } = req.params;

        const userId = (req as any).user.id;

        const result = await pool!.query(
            "UPDATE crm_appointments SET deleted_at = NOW(), deleted_by = $3 WHERE id = $1 AND company_id = $2 RETURNING id",
            [id, companyId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({ message: 'Appointment deleted successfully' });
    } catch (error: any) {
        console.error("Error deleting appointment:", error);
        res.status(500).json({ error: error.message });
    }
};
