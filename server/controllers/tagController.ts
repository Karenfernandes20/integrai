
import { Request, Response } from 'express';
import { pool } from '../db';
import { logAudit } from '../auditLogger';

export const getTags = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;

        const result = await pool.query(`
            SELECT * FROM crm_tags 
            WHERE company_id = $1 
            ORDER BY name ASC
        `, [companyId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
};

export const createTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;
        const { name, color } = req.body;

        if (!name) return res.status(400).json({ error: 'Name is required' });

        const result = await pool.query(`
            INSERT INTO crm_tags (name, color, company_id) 
            VALUES ($1, $2, $3) 
            RETURNING *
        `, [name, color || '#cbd5e1', companyId]);

        const newTag = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId,
            action: 'create',
            resourceType: 'tag',
            resourceId: newTag.id,
            newValues: newTag,
            details: `Created tag: ${newTag.name}`
        });

        res.status(201).json(newTag);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({ error: 'Failed to create tag' });
    }
};

export const updateTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;
        const { id } = req.params;
        const { name, color } = req.body;

        const result = await pool.query(`
            UPDATE crm_tags 
            SET name = COALESCE($1, name), 
                color = COALESCE($2, color),
                updated_at = NOW()
            WHERE id = $3 AND company_id = $4
            RETURNING *
        `, [name, color, id, companyId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const updatedTag = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId,
            action: 'update',
            resourceType: 'tag',
            resourceId: updatedTag.id,
            newValues: updatedTag,
            details: `Updated tag: ${updatedTag.name}`
        });

        res.json(updatedTag);
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(500).json({ error: 'Failed to update tag' });
    }
};

export const deleteTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;
        const { id } = req.params;

        // Force delete from relation table first just in case cascade doesn't kick in instantly or for sanity
        // Actually defined CASCADE but executed queries explicitly is safer? CASCADE is fine.

        const result = await pool.query(`
            DELETE FROM crm_tags 
            WHERE id = $1 AND company_id = $2
            RETURNING *
        `, [id, companyId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        const deletedTag = result.rows[0];

        await logAudit({
            userId: user.id,
            companyId,
            action: 'delete',
            resourceType: 'tag',
            resourceId: deletedTag.id,
            oldValues: deletedTag,
            details: `Deleted tag: ${deletedTag.name}`
        });

        res.json({ message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ error: 'Failed to delete tag' });
    }
};
const normalizePhone = (phone: string | null | undefined) => {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
};

// --- LEADS TAGS ---

export const getLeadTags = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { leadId } = req.params;

        const result = await pool.query(`
            SELECT t.* 
            FROM crm_tags t
            JOIN leads_tags lt ON lt.tag_id = t.id
            WHERE lt.lead_id = $1
        `, [leadId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching lead tags:', error);
        res.status(500).json({ error: 'Failed to fetch lead tags' });
    }
};

export const addLeadTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { leadId } = req.params;
        const { tagId } = req.body;

        // 1. Add to Lead
        await pool.query(`
            INSERT INTO leads_tags (lead_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [leadId, tagId]);

        // 2. Sync to Conversation (if exists)
        const leadRes = await pool.query('SELECT phone, company_id FROM crm_leads WHERE id = $1', [leadId]);
        if (leadRes.rows.length > 0) {
            const { phone, company_id } = leadRes.rows[0];
            const cleanPhone = normalizePhone(phone);
            if (cleanPhone) {
                // Find conversation with this phone (loose match)
                const convRes = await pool.query(`
                    SELECT id FROM whatsapp_conversations 
                    WHERE company_id = $1 AND (phone LIKE '%' || $2 || '%' OR external_id LIKE '%' || $2 || '%')
                    LIMIT 1
                `, [company_id, cleanPhone]);

                if (convRes.rows.length > 0) {
                    const convId = convRes.rows[0].id;
                    await pool.query(`
                        INSERT INTO conversations_tags (conversation_id, tag_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [convId, tagId]);
                }
            }
        }

        res.json({ message: 'Tag added to lead' });
    } catch (error) {
        console.error('Error adding tag to lead:', error);
        res.status(500).json({ error: 'Failed to add tag to lead' });
    }
};

export const removeLeadTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { leadId, tagId } = req.params;

        // 1. Remove from Lead
        await pool.query(`DELETE FROM leads_tags WHERE lead_id = $1 AND tag_id = $2`, [leadId, tagId]);

        // 2. Sync to Conversation
        const leadRes = await pool.query('SELECT phone, company_id FROM crm_leads WHERE id = $1', [leadId]);
        if (leadRes.rows.length > 0) {
            const { phone, company_id } = leadRes.rows[0];
            const cleanPhone = normalizePhone(phone);
            if (cleanPhone) {
                const convRes = await pool.query(`
                    SELECT id FROM whatsapp_conversations 
                    WHERE company_id = $1 AND (phone LIKE '%' || $2 || '%' OR external_id LIKE '%' || $2 || '%')
                    LIMIT 1
                `, [company_id, cleanPhone]);

                if (convRes.rows.length > 0) {
                    const convId = convRes.rows[0].id;
                    await pool.query(`DELETE FROM conversations_tags WHERE conversation_id = $1 AND tag_id = $2`, [convId, tagId]);
                }
            }
        }

        res.json({ message: 'Tag removed from lead' });
    } catch (error) {
        console.error('Error removing tag from lead:', error);
        res.status(500).json({ error: 'Failed to remove tag from lead' });
    }
};

// --- CONVERSATION TAGS ---

export const getConversationTags = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { conversationId } = req.params;

        const result = await pool.query(`
            SELECT t.* 
            FROM crm_tags t
            JOIN conversations_tags ct ON ct.tag_id = t.id
            WHERE ct.conversation_id = $1
        `, [conversationId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching conversation tags:', error);
        res.status(500).json({ error: 'Failed to fetch conversation tags' });
    }
};

export const addConversationTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { conversationId } = req.params;
        const { tagId } = req.body;

        // 1. Add to Conversation
        await pool.query(`
            INSERT INTO conversations_tags (conversation_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [conversationId, tagId]);

        // 2. Sync to Lead
        const convRes = await pool.query('SELECT phone, company_id FROM whatsapp_conversations WHERE id = $1', [conversationId]);
        if (convRes.rows.length > 0) {
            const { phone, company_id } = convRes.rows[0];
            const cleanPhone = normalizePhone(phone);
            if (cleanPhone) {
                // Find Lead with this phone
                const leadRes = await pool.query(`
                    SELECT id FROM crm_leads 
                    WHERE company_id = $1 AND phone LIKE '%' || $2 || '%'
                    LIMIT 1
                `, [company_id, cleanPhone]);

                if (leadRes.rows.length > 0) {
                    const leadId = leadRes.rows[0].id;
                    await pool.query(`
                        INSERT INTO leads_tags (lead_id, tag_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [leadId, tagId]);
                }
            }
        }

        res.json({ message: 'Tag added to conversation' });
    } catch (error) {
        console.error('Error adding tag to conversation:', error);
        res.status(500).json({ error: 'Failed to add tag to conversation' });
    }
};

export const removeConversationTag = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const { conversationId, tagId } = req.params;

        // 1. Remove from Conversation
        await pool.query(`DELETE FROM conversations_tags WHERE conversation_id = $1 AND tag_id = $2`, [conversationId, tagId]);

        // 2. Sync to Lead
        const convRes = await pool.query('SELECT phone, company_id FROM whatsapp_conversations WHERE id = $1', [conversationId]);
        if (convRes.rows.length > 0) {
            const { phone, company_id } = convRes.rows[0];
            const cleanPhone = normalizePhone(phone);
            if (cleanPhone) {
                const leadRes = await pool.query(`
                    SELECT id FROM crm_leads 
                    WHERE company_id = $1 AND phone LIKE '%' || $2 || '%'
                    LIMIT 1
                `, [company_id, cleanPhone]);

                if (leadRes.rows.length > 0) {
                    const leadId = leadRes.rows[0].id;
                    await pool.query(`DELETE FROM leads_tags WHERE lead_id = $1 AND tag_id = $2`, [leadId, tagId]);
                }
            }
        }

        res.json({ message: 'Tag removed from conversation' });
    } catch (error) {
        console.error('Error removing tag from conversation:', error);
        res.status(500).json({ error: 'Failed to remove tag from conversation' });
    }
};
