
import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';

/**
 * Lavajato Dashboard Stats
 */
export const getLavajatoStats = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, staffId, boxId } = req.query;
        const user = (req as any).user;
        const companyId = user.company_id;

        if (!companyId) return res.status(400).json({ error: 'Company ID restricted' });

        // Resolve instance_id if provided or default to active one
        let instanceId = req.query.instanceId;
        if (!instanceId) {
            const instRes = await pool!.query(
                "SELECT id FROM company_instances WHERE company_id = $1 AND status = 'connected' LIMIT 1",
                [companyId]
            );
            instanceId = instRes.rows[0]?.id;
        }

        const dateFilter = startDate && endDate ? `AND created_at BETWEEN '${startDate}' AND '${endDate}'` : '';
        const apptDateFilter = startDate && endDate ? `AND appointment_date BETWEEN '${startDate}' AND '${endDate}'` : '';

        // 1. Conversas Ativas (Status = OPEN)
        const activeConvs = await pool!.query(
            "SELECT COUNT(*) FROM whatsapp_conversations WHERE company_id = $1 AND status = 'OPEN'",
            [companyId]
        );

        // 2. Mensagens Recebidas
        const msgReceived = await pool!.query(
            `SELECT COUNT(*) FROM whatsapp_messages WHERE company_id = $1 AND direction = 'inbound' ${dateFilter.replace('created_at', 'sent_at')}`,
            [companyId]
        );

        // 3. Clientes Atendidos (Finalizados)
        const clientsServed = await pool!.query(
            `SELECT COUNT(*) FROM lavajato_appointments WHERE company_id = $1 AND status = 'finalizado' ${apptDateFilter}`,
            [companyId]
        );

        // 4. Novos Clientes
        const newLeads = await pool!.query(
            `SELECT COUNT(*) FROM crm_leads WHERE company_id = $1 ${dateFilter}`,
            [companyId]
        );

        // 5. WhatsApp Status
        const waStatus = await pool!.query(
            "SELECT status FROM company_instances WHERE company_id = $1 AND id = $2",
            [companyId, instanceId]
        );

        // 6. Agendamentos Hoje
        const apptsToday = await pool!.query(
            "SELECT COUNT(*) FROM lavajato_appointments WHERE company_id = $1 AND appointment_date = CURRENT_DATE",
            [companyId]
        );

        // 7. Faturamento
        const revenue = await pool!.query(
            `SELECT SUM(total_value) as total FROM lavajato_service_orders WHERE company_id = $1 AND status = 'paga' ${dateFilter}`,
            [companyId]
        );

        const totalRevenue = parseFloat(revenue.rows[0]?.total || 0);
        const totalServed = parseInt(clientsServed.rows[0]?.count || 0);
        const ticketMedio = totalServed > 0 ? (totalRevenue / totalServed) : 0;

        res.json({
            activeConversations: parseInt(activeConvs.rows[0].count),
            messagesReceived: parseInt(msgReceived.rows[0].count),
            clientsServed: totalServed,
            newClients: parseInt(newLeads.rows[0].count),
            whatsappStatus: waStatus.rows[0]?.status || 'disconnected',
            appointmentsToday: parseInt(apptsToday.rows[0].count),
            revenue: totalRevenue,
            ticketMedio: ticketMedio
        });

    } catch (error: any) {
        console.error('[Lavajato Stats Error]:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Funnel Stats (Pipeline)
 */
export const getLavajatoFunnel = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;

        // Simplified funnel logic mapping CRM stages or specifically for Lavajato
        // For now, let's use the status of lavajato_appointments as the funnel base
        const funnel = await pool!.query(`
            SELECT 
                status, 
                COUNT(*) as count, 
                SUM(estimated_value) as value
            FROM lavajato_appointments
            WHERE company_id = $1
            GROUP BY status
        `, [companyId]);

        res.json(funnel.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Vehicles Management
 */
export const getVehicles = async (req: Request, res: Response) => {
    try {
        const { q } = req.query;
        const companyId = (req as any).user.company_id;

        let query = "SELECT v.*, l.name as client_name FROM lavajato_vehicles v LEFT JOIN crm_leads l ON v.client_id = l.id WHERE v.company_id = $1";
        const params: any[] = [companyId];

        if (q) {
            query += " AND (v.plate ILIKE $2 OR v.model ILIKE $2 OR l.name ILIKE $2)";
            params.push(`%${q}%`);
        }

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createVehicle = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { plate, brand, model, color, vehicle_type, client_id, observations } = req.body;

        const result = await pool!.query(
            `INSERT INTO lavajato_vehicles (company_id, plate, brand, model, color, vehicle_type, client_id, observations)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [companyId, plate, brand, model, color, vehicle_type, client_id, observations]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Appointments Management
 */
export const getAppointments = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { date, start, end } = req.query;

        let query = `
            SELECT a.*, v.plate, v.model, l.name as client_name, s.name as service_name, b.name as box_name, u.full_name as staff_name
            FROM lavajato_appointments a
            LEFT JOIN lavajato_vehicles v ON a.vehicle_id = v.id
            LEFT JOIN crm_leads l ON a.client_id = l.id
            LEFT JOIN lavajato_services s ON a.service_id = s.id
            LEFT JOIN lavajato_boxes b ON a.box_id = b.id
            LEFT JOIN app_users u ON a.staff_id = u.id
            WHERE a.company_id = $1
        `;
        const params: any[] = [companyId];

        if (date) {
            query += " AND a.appointment_date = $2";
            params.push(date);
        }

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createAppointment = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { vehicle_id, client_id, service_id, box_id, staff_id, date, start_time, end_time, estimated_value, observations, instance_id } = req.body;

        // Conflict check (Simplified)
        const conflict = await pool!.query(
            "SELECT id FROM lavajato_appointments WHERE box_id = $1 AND appointment_date = $2 AND ((start_time, end_time) OVERLAPS ($3, $4))",
            [box_id, date, start_time, end_time]
        );

        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'Conflito de horário no box selecionado.' });
        }

        const result = await pool!.query(
            `INSERT INTO lavajato_appointments (company_id, vehicle_id, client_id, service_id, box_id, staff_id, appointment_date, start_time, end_time, estimated_value, observations, instance_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [companyId, vehicle_id, client_id, service_id, box_id, staff_id, date, start_time, end_time, estimated_value, observations, instance_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Service Orders (OS)
 */
export const getServiceOrders = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const result = await pool!.query(
            "SELECT os.*, v.plate, l.name as client_name FROM lavajato_service_orders os JOIN lavajato_vehicles v ON os.vehicle_id = v.id JOIN crm_leads l ON os.client_id = l.id WHERE os.company_id = $1",
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const createServiceOrder = async (req: Request, res: Response) => {
    try {
        const companyId = (req as any).user.company_id;
        const { vehicle_id, client_id, appointment_id, items, total_value, staff_id } = req.body;

        const result = await pool!.query(
            `INSERT INTO lavajato_service_orders (company_id, vehicle_id, client_id, appointment_id, items, total_value, staff_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'aberta') RETURNING *`,
            [companyId, vehicle_id, client_id, appointment_id, JSON.stringify(items), total_value, staff_id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Boxes and Services definition
 */
export const getBoxes = async (req: Request, res: Response) => {
    try {
        const result = await pool!.query("SELECT * FROM lavajato_boxes WHERE company_id = $1", [(req as any).user.company_id]);
        res.json(result.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};

export const getServices = async (req: Request, res: Response) => {
    try {
        const result = await pool!.query("SELECT * FROM lavajato_services WHERE company_id = $1", [(req as any).user.company_id]);
        res.json(result.rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
};
