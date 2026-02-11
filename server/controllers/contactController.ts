import { Request, Response } from 'express';
import { pool } from '../db';
import { normalizePhone } from '../utils/phoneUtils';

// Get all contacts for a company
export const getContacts = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;
        const { instance_id } = req.query;

        let query = `
            SELECT 
                id, 
                jid, 
                name, 
                push_name,
                phone,
                email,
                profile_pic_url,
                instance,
                company_id,
                created_at,
                updated_at
            FROM whatsapp_contacts 
            WHERE company_id = $1
        `;
        const params: any[] = [companyId];

        if (instance_id) {
            query += ` AND instance = $2`;
            params.push(instance_id);
        }

        query += ` ORDER BY name ASC NULLS LAST, created_at DESC`;

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
};

// Get single contact
export const getContact = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM whatsapp_contacts WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({ error: 'Failed to fetch contact' });
    }
};

// Create new contact
export const createContact = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;
        const { name, phone, email, instance, profile_pic_url, push_name } = req.body;

        // Validation
        if (!phone || phone.trim().length === 0) {
            return res.status(400).json({ error: 'Telefone é obrigatório' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        // Normalize phone
        const normalizedPhone = normalizePhone(phone);

        // Validate phone format (basic check)
        if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
            return res.status(400).json({ error: 'Telefone inválido' });
        }

        // Create JID from phone
        const jid = `${normalizedPhone}@s.whatsapp.net`;

        // Check if contact already exists with same phone/jid
        const existing = await pool.query(
            `SELECT id, name, phone FROM whatsapp_contacts 
             WHERE company_id = $1 AND (jid = $2 OR phone = $3)`,
            [companyId, jid, normalizedPhone]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Contato já existe com este telefone',
                existing: existing.rows[0]
            });
        }

        // Insert new contact
        const result = await pool.query(
            `INSERT INTO whatsapp_contacts 
                (jid, name, push_name, phone, email, profile_pic_url, instance, company_id, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             RETURNING *`,
            [jid, name.trim(), push_name || name.trim(), normalizedPhone, email || null, profile_pic_url || null, instance || 'default', companyId]
        );

        console.log(`[Contacts] Created new contact: ${name} (${normalizedPhone}) for company ${companyId}`);

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Error creating contact:', error);

        // Handle unique constraint violations
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Contato já existe com estas informações' });
        }

        res.status(500).json({ error: 'Falha ao criar contato' });
    }
};

// Update contact
export const updateContact = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;
        const { id } = req.params;
        const { name, phone, email, profile_pic_url } = req.body;

        // Check if contact exists and belongs to company
        const existing = await pool.query(
            `SELECT * FROM whatsapp_contacts WHERE id = $1 AND company_id = $2`,
            [id, companyId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Contato não encontrado' });
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name.trim());
        }

        if (phone !== undefined) {
            const normalizedPhone = normalizePhone(phone);
            updates.push(`phone = $${paramCount++}`);
            values.push(normalizedPhone);

            // Also update JID
            updates.push(`jid = $${paramCount++}`);
            values.push(`${normalizedPhone}@s.whatsapp.net`);
        }

        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            values.push(email || null);
        }

        if (profile_pic_url !== undefined) {
            updates.push(`profile_pic_url = $${paramCount++}`);
            values.push(profile_pic_url || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push(`updated_at = NOW()`);

        // Add id and company_id for WHERE clause
        values.push(id, companyId);

        const query = `
            UPDATE whatsapp_contacts 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount++} AND company_id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        console.log(`[Contacts] Updated contact ${id} for company ${companyId}`);

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Error updating contact:', error);

        if (error.code === '23505') {
            return res.status(409).json({ error: 'Outro contato já usa este telefone' });
        }

        res.status(500).json({ error: 'Falha ao atualizar contato' });
    }
};

// Delete contact
export const deleteContact = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM whatsapp_contacts 
             WHERE id = $1 AND company_id = $2
             RETURNING id`,
            [id, companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contato não encontrado' });
        }

        console.log(`[Contacts] Deleted contact ${id} for company ${companyId}`);

        res.json({ message: 'Contato removido com sucesso' });
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ error: 'Falha ao deletar contato' });
    }
};

// Search contacts
export const searchContacts = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            return res.status(400).json({ error: 'Query de busca é obrigatória' });
        }

        const searchTerm = `%${q.trim().toLowerCase()}%`;

        const result = await pool.query(
            `SELECT * FROM whatsapp_contacts 
             WHERE company_id = $1 
             AND (
                 LOWER(name) LIKE $2 
                 OR LOWER(push_name) LIKE $2 
                 OR phone LIKE $2
                 OR LOWER(email) LIKE $2
             )
             ORDER BY name ASC
             LIMIT 50`,
            [companyId, searchTerm]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error searching contacts:', error);
        res.status(500).json({ error: 'Falha na busca de contatos' });
    }
};
