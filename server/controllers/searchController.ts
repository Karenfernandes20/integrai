import { Request, Response } from 'express';
import { pool } from '../db';

export const globalSearch = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { q } = req.query;
        if (!q || typeof q !== 'string') return res.json({
            conversations: [],
            users: [],
            documents: [],
            tasks: [],
            contracts: []
        });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const isAdmin = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN';
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        const searchTerm = `%${q}%`;

        // Parallel search
        const [convs, users, docs, tasks, contracts] = await Promise.all([
            // 1. Conversations (Group and Direct)
            pool.query(`
                SELECT id, COALESCE(contact_name, group_name, phone) as title, 
                       CASE WHEN is_group THEN 'Grupo' ELSE phone END as subtitle, 
                       'conversation' as type, last_message_at as date
                FROM whatsapp_conversations
                WHERE (contact_name ILIKE $1 OR phone ILIKE $1 OR group_name ILIKE $1)
                ${!isSuperAdmin ? 'AND company_id = $2' : ''}
                ORDER BY last_message_at DESC LIMIT 5
            `, isSuperAdmin ? [searchTerm] : [searchTerm, companyId]),

            // 2. Users (Internal/External)
            pool.query(`
                SELECT id, full_name as title, CONCAT(role, ' - ', email) as subtitle, 'user' as type, created_at as date
                FROM app_users
                WHERE (full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
                ${!isSuperAdmin ? 'AND company_id = $2' : ''}
                LIMIT 5
            `, isSuperAdmin ? [searchTerm] : [searchTerm, companyId]),

            // 3. Documents (Messages with media)
            pool.query(`
                SELECT m.id, 
                       CASE 
                         WHEN m.message_type = 'document' THEN COALESCE(m.content, 'Documento Sem Nome')
                         WHEN m.message_type = 'image' THEN CONCAT('Imagem: ', COALESCE(m.content, 'Sem legenda'))
                         ELSE CONCAT('Arquivo: ', m.message_type)
                       END as title, 
                       CONCAT(c.contact_name, ' (', m.message_type, ')') as subtitle, 
                       'document' as type, m.sent_at as date, m.conversation_id
                FROM whatsapp_messages m
                JOIN whatsapp_conversations c ON m.conversation_id = c.id
                WHERE (m.message_type IN ('document', 'image', 'video', 'audio'))
                AND (m.content ILIKE $1 OR m.message_type ILIKE $1)
                ${!isSuperAdmin ? 'AND c.company_id = $2' : ''}
                ORDER BY m.sent_at DESC LIMIT 5
            `, isSuperAdmin ? [searchTerm] : [searchTerm, companyId]),

            // 4. Tasks (Admin Tasks)
            pool.query(`
                SELECT id, title, CONCAT(status, ' - ', priority) as subtitle, 'task' as type, due_date as date
                FROM admin_tasks
                WHERE (title ILIKE $1 OR description ILIKE $1)
                ${!isSuperAdmin ? 'AND company_id = $2' : ''}
                LIMIT 5
            `, isSuperAdmin ? [searchTerm] : [searchTerm, companyId]),

            // 5. Contracts (Messages specifically labeled or financial transactions)
            pool.query(`
                SELECT m.id, m.content as title, c.contact_name as subtitle, 'contract' as type, m.sent_at as date, m.conversation_id
                FROM whatsapp_messages m
                JOIN whatsapp_conversations c ON m.conversation_id = c.id
                WHERE (m.content ILIKE $1)
                AND (m.content ILIKE '%contrato%' OR m.content ILIKE '%fechado%' OR m.content ILIKE '%pdf%')
                ${!isSuperAdmin ? 'AND c.company_id = $2' : ''}
                UNION ALL
                SELECT id, description as title, CONCAT('Financeiro: ', type, ' - R$ ', amount) as subtitle, 'contract' as type, due_date as date, NULL as conversation_id
                FROM financial_transactions
                WHERE (description ILIKE $1 OR category ILIKE $1)
                ${!isSuperAdmin ? 'AND company_id = $2' : ''}
                LIMIT 5
            `, isSuperAdmin ? [searchTerm] : [searchTerm, companyId])
        ]);

        res.json({
            conversations: convs.rows,
            users: users.rows,
            documents: docs.rows,
            tasks: tasks.rows,
            contracts: contracts.rows
        });

    } catch (error) {
        console.error('[globalSearch] Error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};
