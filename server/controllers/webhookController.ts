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
        // O Evolution pode mandar arrays de eventos ou objetos únicos dependendo da config
        // Vamos assumir o padrão Global Webhook: { type: "...", data: ... }
        const { type, data } = req.body;

        console.log(`Webhook received: ${type}`);

        if (type === 'messages.upsert') {
            const msg = data as WebhookMessage;
            const remoteJid = msg.key.remoteJid;

            // Ignora mensagens de status/grupo por enquanto, foca em user
            if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
                return res.status(200).send();
            }

            const isFromMe = msg.key.fromMe;
            const phone = remoteJid.split('@')[0];
            const name = msg.pushName || phone;

            if (!pool) {
                console.error("Database pool not available");
                return res.status(200).send();
            }

            // 1. Upsert Conversation
            // Verifica se já existe conversa com esse ID remoto (external_id)
            let conversationId: number;
            const checkConv = await pool.query(
                'SELECT id FROM whatsapp_conversations WHERE external_id = $1',
                [remoteJid]
            );

            if (checkConv.rows.length > 0) {
                conversationId = checkConv.rows[0].id;
                // Opcional: Atualizar nome se mudou
                if (msg.pushName) {
                    await pool.query('UPDATE whatsapp_conversations SET contact_name = $1 WHERE id = $2', [msg.pushName, conversationId]);
                }
            } else {
                const newConv = await pool.query(
                    'INSERT INTO whatsapp_conversations (external_id, phone, contact_name) VALUES ($1, $2, $3) RETURNING id',
                    [remoteJid, phone, name]
                );
                conversationId = newConv.rows[0].id;
            }

            // 2. Insert Message
            // Extrair texto (simplificado)
            let content = '';
            if (msg.message?.conversation) content = msg.message.conversation;
            else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
            else if (msg.message?.imageMessage?.caption) content = msg.message.imageMessage.caption;
            else content = '[Mídia ou outro tipo de mensagem]';

            const direction = isFromMe ? 'outbound' : 'inbound';
            const sent_at = new Date(msg.messageTimestamp * 1000);

            await pool.query(
                'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at) VALUES ($1, $2, $3, $4)',
                [conversationId, direction, content, sent_at]
            );

            console.log(`Message saved for conversation ${conversationId}: ${content}`);
        }

        return res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('Webhook Error:', error);
        // Retorna 200 para evitar que o Evolution fique tentando reenviar infinitamente em caso de erro de lógica
        return res.status(200).json({ status: 'error', message: 'Webhook processing failed' });
    }
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        // Retorna conversas com a última mensagem (simples)
        const result = await pool.query(`
            SELECT c.*, 
            (SELECT content FROM whatsapp_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message,
            (SELECT sent_at FROM whatsapp_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message_at
            FROM whatsapp_conversations c
            ORDER BY last_message_at DESC NULLS LAST
        `);

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
