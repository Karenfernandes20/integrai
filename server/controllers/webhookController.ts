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
        // console.log("[Webhook] Received:", JSON.stringify(body));

        let type = body.type || body.event;
        let data = body.data;
        let instance = body.instance || (data?.instance) || 'integrai';

        // Support array-style payloads (used in some Evolution versions)
        if (Array.isArray(body) && body.length > 0) {
            type = body[0].type || body[0].event;
            data = body[0].data;
            instance = body[0].instance || 'integrai';
        }

        if (!type) {
            return res.status(200).send();
        }

        const normalizedType = type.toLowerCase();

        if (normalizedType === 'messages.upsert' || normalizedType === 'messages_upsert') {
            // Find the message object
            let msg: any = null;
            if (data?.messages && Array.isArray(data.messages)) {
                msg = data.messages[0];
            } else {
                msg = data;
            }

            if (!msg || !msg.key) return res.status(200).send();

            const remoteJid = msg.key.remoteJid;

            // Ignore status/groups
            if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
                return res.status(200).send();
            }

            const isFromMe = msg.key.fromMe;
            const direction = isFromMe ? 'outbound' : 'inbound';

            // Business Logic: 
            // Inbound messages make the chat PENDING if it was CLOSED.
            // If it's OPEN, it stays OPEN.
            const phone = remoteJid.split('@')[0];
            const name = msg.pushName || phone;

            if (!pool) return res.status(500).send();

            // 1. Upsert Conversation (Scoped by Instance)
            let conversationId: number;
            let currentStatus: string = 'PENDING';

            const checkConv = await pool.query(
                `SELECT id, status FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2`,
                [remoteJid, instance]
            );

            if (checkConv.rows.length > 0) {
                conversationId = checkConv.rows[0].id;
                const existingStatus = checkConv.rows[0].status;
                currentStatus = existingStatus || 'PENDING';

                // Rules:
                // - If inbound and CLOSED -> Move to PENDING
                // - If outbound -> Move to OPEN
                if (direction === 'inbound') {
                    if (existingStatus === 'CLOSED') {
                        currentStatus = 'PENDING';
                        await pool.query("UPDATE whatsapp_conversations SET status = 'PENDING' WHERE id = $1", [conversationId]);
                    }
                } else if (direction === 'outbound') {
                    if (existingStatus !== 'OPEN') {
                        currentStatus = 'OPEN';
                        await pool.query("UPDATE whatsapp_conversations SET status = 'OPEN' WHERE id = $1", [conversationId]);
                    }
                }

                // Sync name if updated
                if (msg.pushName) {
                    await pool.query('UPDATE whatsapp_conversations SET contact_name = $1 WHERE id = $2', [msg.pushName, conversationId]);
                }
            } else {
                currentStatus = direction === 'outbound' ? 'OPEN' : 'PENDING';
                const newConv = await pool.query(
                    `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status) 
                     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                    [remoteJid, phone, name, instance, currentStatus]
                );
                conversationId = newConv.rows[0].id;
            }

            // 2. Insert Message
            let content = '';
            const m = msg.message;
            if (m?.conversation) content = m.conversation;
            else if (m?.extendedTextMessage?.text) content = m.extendedTextMessage.text;
            else if (m?.imageMessage?.caption) content = m.imageMessage.caption;
            else if (m?.videoMessage?.caption) content = m.videoMessage.caption;
            else if (m?.buttonsResponseMessage?.selectedButtonId) content = m.buttonsResponseMessage.selectedButtonId;
            else if (m?.listResponseMessage?.title) content = m.listResponseMessage.title;
            else content = '[Mídia/Tipo não suportado]';

            const sent_at = new Date((msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000);

            const insertedMsg = await pool.query(
                `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id) 
                 VALUES ($1, $2, $3, $4, 'received', $5) 
                 ON CONFLICT DO NOTHING
                 RETURNING id, conversation_id, direction, content, sent_at, status, external_id`,
                [conversationId, direction, content, sent_at, msg.key.id]
            );

            if (insertedMsg.rows.length === 0) return res.status(200).send(); // Avoid processing duplicates

            // Update metadata
            await pool.query(
                `UPDATE whatsapp_conversations 
                 SET last_message_at = $1, 
                     last_message = $2, 
                     unread_count = CASE WHEN $3 = 'inbound' THEN unread_count + 1 ELSE unread_count END 
                 WHERE id = $4`,
                [sent_at, content, direction, conversationId]
            );

            // EMIT SOCKET EVENT
            const io = req.app.get('io');
            if (io) {
                const newMessageObj = insertedMsg.rows[0];
                io.emit('message:received', {
                    ...newMessageObj,
                    phone: phone,
                    contact_name: name,
                    remoteJid: remoteJid,
                    instance: instance,
                    status: currentStatus // Send updated status to frontend
                });
            }

            // CRM Integration (Inbound leads)
            if (direction === 'inbound') {
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
