
import { Request, Response } from 'express';
import { pool } from '../db';

export const getCrmAppointments = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { start, end, responsible_id, lead_id } = req.query;

        let query = `
            SELECT a.id, a.title, a.client_name, a.phone, a.status, a.type, a.description, a.location, 
                   to_char(a.start_time, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as start_time,
                   to_char(a.end_time, 'YYYY-MM-DD"T"HH24:MI:SS.MS') as end_time,
                   a.lead_id, a.responsible_id, a.insurance_plan_id, a.billing_amount,
                   l.name as lead_name, 
                   COALESCE(p.name, u.full_name) as responsible_name, 
                   l.profile_pic as lead_avatar,
                   p.color as professional_color
            FROM crm_appointments a
            LEFT JOIN crm_leads l ON a.lead_id = l.id
            LEFT JOIN crm_professionals p ON a.responsible_id = p.id
            LEFT JOIN app_users u ON a.responsible_id = u.id
            WHERE a.company_id = $1
        `;
        const params: any[] = [companyId];
        let paramIndex = 2;

        if (start && end) {
            // Force params to be interpreted as UTC instants, then converted to naive timestamps (UTC face value)
            query += ` AND a.start_time BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(start, end);
            paramIndex += 2;
        }

        if (responsible_id) {
            query += ` AND a.responsible_id = $${paramIndex}`;
            params.push(responsible_id);
            paramIndex++;
        }

        if (lead_id) {
            query += ` AND a.lead_id = $${paramIndex}`;
            params.push(lead_id);
            paramIndex++;
        }

        query += " ORDER BY a.start_time ASC";

        // DEBUG LOGGING
        console.log("--- GET APPOINTMENTS DEBUG ---");
        console.log("Query Params:", req.query);
        console.log("SQL Query:", query);
        console.log("SQL Params:", params);

        const result = await pool!.query(query, params);
        console.log("Found rows:", result.rowCount);

        // Map to frontend friendly format if needed, but the frontend expects:
        // id, title, client, whatsapp, start, end, status, type, responsible, description, location
        const events = result.rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            client: row.client_name || row.lead_name || 'Cliente',
            clientAvatar: row.lead_avatar,
            whatsapp: row.phone,
            start: row.start_time,
            end: row.end_time,
            status: row.status,
            type: row.type,
            responsible: row.responsible_name,
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
        console.error("Error getting appointments:", error);
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

        const result = await pool!.query(
            "DELETE FROM crm_appointments WHERE id = $1 AND company_id = $2 RETURNING id",
            [id, companyId]
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
