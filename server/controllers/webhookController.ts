import { Request, Response } from 'express';
import { pool } from '../db';

// Tipo simplificado da mensagem
interface WebhookMessage {
    key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
    };
    pushName?: string;
    messageType: string;
    message: any;
    messageTimestamp: number;
}

export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const instance = body.instance || 'integrai'; // Fallback if missing, but critical for multi-tenancy

        let type = body.type;
        let data = body.data;

        // Simplify payload extraction logic
        if (Array.isArray(body) && body.length > 0) {
            type = body[0].type;
            data = body[0].data;
        } else if (!type && body.event) {
            type = body.event;
            data = body;
        }

        if (!type) {
            return res.status(200).send();
        }

        if (type === 'messages.upsert') {
            const msg = data as WebhookMessage;
            if (!msg.key) return res.status(200).send();

            const remoteJid = msg.key.remoteJid;

            // Ignore status/groups
            if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
                return res.status(200).send();
            }

            const isFromMe = msg.key.fromMe;
            let direction = isFromMe ? 'outbound' : 'inbound';
            const status = direction === 'outbound' ? 'OPEN' : 'PENDING';

            const phone = remoteJid.split('@')[0];
            const name = msg.pushName || phone;

            if (!pool) return res.status(500).send();

            // 1. Upsert Conversation (Scoped by Instance)
            let conversationId: number;

            // Check based on remoteJid AND instance
            const checkConv = await pool.query(
                `SELECT id, status FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2`,
                [remoteJid, instance]
            );

            if (checkConv.rows.length > 0) {
                conversationId = checkConv.rows[0].id;
                const existingStatus = checkConv.rows[0].status;

                // Sync name if updated
                if (msg.pushName) {
                    await pool.query('UPDATE whatsapp_conversations SET contact_name = $1 WHERE id = $2', [msg.pushName, conversationId]);
                }

                // If outbound from phone and status is PENDING/null, upgrade to OPEN
                if (direction === 'outbound' && (existingStatus === 'PENDING' || !existingStatus)) {
                    await pool.query("UPDATE whatsapp_conversations SET status = 'OPEN' WHERE id = $1", [conversationId]);
                }
            } else {
                const newConv = await pool.query(
                    `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status) 
                     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                    [remoteJid, phone, name, instance, status]
                );
                conversationId = newConv.rows[0].id;
            }

            // 2. Insert Message
            let content = '';
            if (msg.message?.conversation) content = msg.message.conversation;
            else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
            else if (msg.message?.imageMessage?.caption) content = msg.message.imageMessage.caption;
            else content = '[Mídia ou outro tipo de mensagem]';

            direction = isFromMe ? 'outbound' : 'inbound';
            const sent_at = new Date(msg.messageTimestamp * 1000);

            // Avoid duplicating messages if Evolution sends same ID twice
            // Ideally we check if message key.id exists for this conversation? For now just insert.
            const insertedMsg = await pool.query(
                `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id) 
                 VALUES ($1, $2, $3, $4, 'received', $5) 
                 RETURNING id, conversation_id, direction, content, sent_at, status, external_id`,
                [conversationId, direction, content, sent_at, msg.key.id]
            );

            // Update metadata
            if (direction === 'inbound') {
                await pool.query(
                    `UPDATE whatsapp_conversations 
                     SET last_message_at = $1, last_message = $2, unread_count = unread_count + 1 
                     WHERE id = $3`,
                    [sent_at, content, conversationId]
                );
            } else {
                // Outbound, just update time and message
                await pool.query(
                    `UPDATE whatsapp_conversations 
                     SET last_message_at = $1, last_message = $2
                     WHERE id = $3`,
                    [sent_at, content, conversationId]
                );
            }

            // EMIT SOCKET EVENT (Room: instance)
            const io = req.app.get('io');
            if (io) {
                const newMessageObj = insertedMsg.rows[0];
                // Emit event globally or to instance room. 
                // For now global 'message:received' but payload includes instance so client filters.
                io.emit('message:received', {
                    ...newMessageObj,
                    phone: phone,
                    contact_name: name,
                    remoteJid: remoteJid,
                    instance: instance
                });
            }

            // CRM Integration (Optional: only if inbound)
            if (direction === 'inbound') {
                // Check if lead exists (Global check or Instance check? Assuming global for now or scoped?)
                // Keeping it simple: check by phone globally
                const checkLead = await pool.query('SELECT id FROM crm_leads WHERE phone = $1', [phone]);
                if (checkLead.rows.length === 0) {
                    const stageRes = await pool.query('SELECT id FROM crm_stages ORDER BY position ASC LIMIT 1');
                    if (stageRes.rows.length > 0) {
                        await pool.query(
                            'INSERT INTO crm_leads (name, phone, origin, stage_id, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
                            [name, phone, 'WhatsApp', stageRes.rows[0].id]
                        );
                    }
                } else {
                    await pool.query('UPDATE crm_leads SET updated_at = NOW() WHERE phone = $1', [phone]);
                }
            }
        }

        return res.status(200).json({ status: 'success' });
    } catch (error: any) {
        console.error('Webhook Error:', error);
        return res.status(200).json({ status: 'error' });
    }
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        // Determine instance from authenticated user
        // Logic: SuperAdmin sees 'integrai' (default) or needs a way to select?
        // Admin/User sees their company's instance.
        const user = (req as any).user;
        let instanceFilter = 'integrai';

        if (user && user.role !== 'SUPERADMIN') {
            const userRes = await pool.query('SELECT company_id FROM app_users WHERE id = $1', [user.id]);
            if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
                const compRes = await pool.query('SELECT evolution_instance FROM companies WHERE id = $1', [userRes.rows[0].company_id]);
                if (compRes.rows.length > 0 && compRes.rows[0].evolution_instance) {
                    instanceFilter = compRes.rows[0].evolution_instance;
                }
            }
        }
        // If query param overrides (only for superadmin?)
        // const requestedInstance = req.query.instance; 

        const result = await pool.query(`
            SELECT c.*, 
            (SELECT content FROM whatsapp_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message
            FROM whatsapp_conversations c
            WHERE c.instance = $1 OR c.instance IS NULL  -- Backwards compatibility
            ORDER BY c.last_message_at DESC NULLS LAST
        `, [instanceFilter]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { conversationId } = req.params;
        const result = await pool.query(
            'SELECT * FROM whatsapp_messages WHERE conversation_id = $1 ORDER BY sent_at ASC',
            [conversationId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};
