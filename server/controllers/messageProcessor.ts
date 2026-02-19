
import { Request, Response } from 'express';
import { pool } from '../db/index.js';
import { resolveCompanyByInstanceKey } from '../utils/evolutionUtils.js';

export const processIncomingMessage = async (companyId: number, instanceName: string, msg: any) => {
    try {
        if (!pool) throw new Error("Database not configured");

        const key = msg.key;
        if (!key) return;

        // 1. Validate Ignore Criteria
        const fromMe = key.fromMe === true;
        const remoteJid = key.remoteJid;
        const isGroup = remoteJid && remoteJid.endsWith('@g.us');

        // Ignore invalid or broadcast (Allow groups now)
        if (!remoteJid || remoteJid === 'status@broadcast') {
            console.log(`[Message Processor] Ignored message from ${remoteJid} (Invalid/Broadcast)`);
            return;
        }

        // If fromMe, we generally ignore unless we want to sync sent messages
        if (fromMe) {
            console.log(`[Message Processor] Ignored message (fromMe === true)`);
            return;
        }

        const externalId = key.id;
        const pushName = msg.pushName; // This is the SENDER name (even in groups)
        const messageType = msg.messageType || (msg.message ? Object.keys(msg.message)[0] : 'unknown');

        // For groups, the sender is the participant
        const participant = isGroup ? (key.participant || msg.participant) : remoteJid;

        // 2. Extract Content & Type
        let content = "";
        const m = msg.message || {};

        if (m.conversation) content = m.conversation;
        else if (m.extendedTextMessage?.text) content = m.extendedTextMessage.text;
        else if (m.imageMessage) content = m.imageMessage.caption || "[Imagem]";
        else if (m.audioMessage) content = "[Áudio]";
        else if (m.videoMessage) content = m.videoMessage.caption || "[Vídeo]";
        else if (m.documentMessage) content = m.documentMessage.fileName || "[Documento]";
        else if (m.stickerMessage) content = "[Figurinha]";
        else content = "[Mensagem]";

        if (!content && messageType !== 'protocolMessage') {
            console.log(`[Message Processor] Empty content for message ${externalId}`);
            return;
        }

        console.log(`[Message Processor] Processing ${messageType} from ${remoteJid} (Group: ${isGroup})`);

        // 3. Convert remoteJid / IDs
        const groupPhone = isGroup ? remoteJid.split('@')[0] : "";
        const senderPhoneRaw = participant ? participant.replace('@s.whatsapp.net', '') : remoteJid.replace('@s.whatsapp.net', '');
        const senderPhone = senderPhoneRaw.split(':')[0];

        // 4. Fluxo Obrigatório

        // STEP A: Buscar ou criar contato (DO REMETENTE)
        // Se for grupo, o contato é o participant. Se for privado, é o remoteJid.
        let senderContactName = pushName || senderPhone;

        // Try to find existing contact for the PARTICIPANT/SENDER
        const contactRes = await pool.query(
            "SELECT name FROM whatsapp_contacts WHERE (phone = $1 OR jid = $2) AND company_id = $3 LIMIT 1",
            [senderPhone, participant, companyId]
        );

        if (contactRes.rows.length > 0 && contactRes.rows[0].name) {
            senderContactName = contactRes.rows[0].name;
        } else {
            // Create Sender Contact if not exists
            await pool.query(`
                INSERT INTO whatsapp_contacts (jid, phone, name, push_name, instance, created_at, updated_at, company_id)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
                ON CONFLICT (jid, company_id) DO NOTHING
            `, [participant, senderPhone, senderContactName, pushName, instanceName, companyId]);
        }

        // STEP B: Buscar ou criar conversa (DO CHAT/GRUPO)
        let conversationId: number;

        // Find conversation by remoteJid (Group JID or User JID)
        const convRes = await pool.query(
            `SELECT id, status, contact_name FROM whatsapp_conversations WHERE external_id = $1 AND company_id = $2`,
            [remoteJid, companyId]
        );

        if (convRes.rows.length > 0) {
            conversationId = convRes.rows[0].id;
            const currentStatus = convRes.rows[0].status;

            // Only update contact_name if it's NOT a group (private chats update name based on user)
            // For groups, we KEEP the existing group name
            let nameUpdateQuery = "";
            let params = [content, 'OPEN', instanceName, conversationId]; // base params

            if (!isGroup) {
                // For private chats, update name if we have a better one
                // But actually, we usually want to keep the name user set? 
                // Let's only update if the current one is just a number? 
                // Or just update pushName. 
                // The original code updated it. Let's keep updating for private, but NOT for group.
                nameUpdateQuery = ", contact_name = $5";
                params.push(senderContactName);
            } else {
                // For groups, verify if we have the Last Sender Name column? 
                // If not, we just update the content.
                // Ideally we should store "last_sender_name" to show "John: Hello" in UI.
                // Assuming column exists or we append to content? No, UI should handle it.
                // We will update 'contact_name' ONLY if it is still null/empty (self-healing for new groups)
                if (!convRes.rows[0].contact_name) {
                    nameUpdateQuery = ", contact_name = $5";
                    params.push("Grupo " + groupPhone);
                }
            }

            // Update Conversation
            await pool.query(`
                UPDATE whatsapp_conversations SET 
                    last_message = $1,
                    last_message_at = NOW(),
                    unread_count = unread_count + 1,
                    status = $2, 
                    instance = $3
                    ${nameUpdateQuery}
                WHERE id = $4
            `, params);

            console.log(`[Message Processor] Updated Conversation ${conversationId}`);

        } else {
            // Create new conversation
            // For groups, we don't know the name yet. Use "Grupo + Number" 
            const newConvName = isGroup ? `Grupo ${groupPhone}` : senderContactName;

            const newConv = await pool.query(`
                INSERT INTO whatsapp_conversations 
                    (external_id, phone, contact_name, instance, last_message, last_message_at, unread_count, company_id, status, user_id, is_group)
                VALUES ($1, $2, $3, $4, $5, NOW(), 1, $6, 'OPEN', NULL, $7)
                RETURNING id
            `, [remoteJid, isGroup ? groupPhone : senderPhone, newConvName, instanceName, content, companyId, isGroup]);

            conversationId = newConv.rows[0].id;
            console.log(`[Message Processor] Created New Conversation ${conversationId}`);
        }

        // STEP C: Salvar mensagem no banco
        const insertedMsg = await pool.query(`
            INSERT INTO whatsapp_messages 
                (conversation_id, direction, content, sent_at, status, message_type, external_id, company_id, instance_key, sender_jid, sender_name)
            VALUES ($1, 'inbound', $2, NOW(), 'received', $3, $4, $5, $6, $7, $8)
            ON CONFLICT (external_id) DO NOTHING
            RETURNING *
        `, [conversationId, content, messageType, externalId, companyId, instanceName, participant, senderContactName]);

        if (insertedMsg.rows.length > 0) {
            console.log(`[Message Processor] ✅ Message saved: ${insertedMsg.rows[0].id}`);

            return {
                message: insertedMsg.rows[0],
                conversationId,
                contactName: isGroup ? (convRes.rows[0]?.contact_name || `Grupo ${groupPhone}`) : senderContactName,
                phone: isGroup ? groupPhone : senderPhone,
                isGroup,
                senderName: senderContactName
            };
        } else {
            return null; // Duplicate
        }

    } catch (error: any) {
        console.error(`[Message Processor] ❌ Failed:`, error.message);
        throw error;
    }
};
