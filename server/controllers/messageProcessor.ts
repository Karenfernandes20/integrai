
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

        // Ignore invalid, group messages or broadcast
        if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
            console.log(`[Message Processor] Ignored message from ${remoteJid} (Group/Broadcast)`);
            return;
        }

        // If fromMe, we generally ignore unless we want to sync sent messages, 
        // but the requirement says "Ignorar mensagens onde: key.fromMe === true", so we obey.
        // However, existing logic usually syncs outbound too. 
        // The user explicit request: "Ignorar mensagens onde: key.fromMe === true"
        if (fromMe) {
            console.log(`[Message Processor] Ignored message (fromMe === true)`);
            return;
        }

        const externalId = key.id;
        const pushName = msg.pushName;
        const messageType = msg.messageType || (msg.message ? Object.keys(msg.message)[0] : 'unknown');

        // 2. Extract Content & Type
        let content = "";
        const m = msg.message || {};

        // Recursive content extraction usually needed for quoted, ephemeral, viewOnce, etc.
        // Simplifying based on common patterns:
        if (m.conversation) content = m.conversation;
        else if (m.extendedTextMessage?.text) content = m.extendedTextMessage.text;
        else if (m.imageMessage) content = m.imageMessage.caption || "[Imagem]";
        else if (m.audioMessage) content = "[Áudio]";
        else if (m.videoMessage) content = m.videoMessage.caption || "[Vídeo]";
        else if (m.documentMessage) content = m.documentMessage.fileName || "[Documento]";
        else if (m.stickerMessage) content = "[Figurinha]";
        else content = "[Mensagem]";

        if (!content && messageType !== 'protocolMessage') {
            // empty content check
            console.log(`[Message Processor] Empty content for message ${externalId}`);
            return;
        }

        console.log(`[Message Processor] Processing ${messageType} from ${remoteJid}`);

        // 3. Convert remoteJid (Remove suffix)
        const phone = remoteJid.replace('@s.whatsapp.net', '');
        const cleanPhone = phone.split(':')[0]; // Safety against JIDs with device specific suffixes

        // 4. Fluxo Obrigatório

        // STEP A: Buscar ou criar contato
        let finalContactName = pushName || cleanPhone;

        // Try to find existing contact
        const contactRes = await pool.query(
            "SELECT name FROM whatsapp_contacts WHERE (phone = $1 OR jid = $2) AND company_id = $3 LIMIT 1",
            [cleanPhone, remoteJid, companyId]
        );

        if (contactRes.rows.length > 0 && contactRes.rows[0].name) {
            finalContactName = contactRes.rows[0].name;
        } else {
            // Create Contact if not exists
            await pool.query(`
        INSERT INTO whatsapp_contacts (jid, phone, name, push_name, instance, created_at, updated_at, company_id)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6)
        ON CONFLICT (jid, company_id) DO NOTHING
      `, [remoteJid, cleanPhone, finalContactName, pushName, instanceName, companyId]);
        }

        // STEP B: Buscar ou criar conversa
        let conversationId: number;

        // Check if conversation exists (by external_id OR phone)
        // IMPORTANT: status check is part of requirements later, here we just resolve ID
        const convRes = await pool.query(
            `SELECT id, status, user_id FROM whatsapp_conversations WHERE (external_id = $1 OR phone = $2) AND company_id = $3`,
            [remoteJid, cleanPhone, companyId]
        );

        if (convRes.rows.length > 0) {
            conversationId = convRes.rows[0].id;
            const currentStatus = convRes.rows[0].status;

            // 7) Se a conversa existir mas estiver com status diferente de "open":
            // Atualizar automaticamente para "open"
            // ALSO: 5) Garantir que apareça na aba de atendimento (status='open')

            let newStatus = 'OPEN'; // Force OPEN as per requirement 7

            // Update Conversation
            await pool.query(`
        UPDATE whatsapp_conversations SET 
            last_message = $1,
            last_message_at = NOW(),
            unread_count = unread_count + 1,
            status = $2, 
            contact_name = $3,
            instance = $4
        WHERE id = $5
      `, [content, newStatus, finalContactName, instanceName, conversationId]);

            console.log(`[Message Processor] Updated Conversation ${conversationId} to OPEN`);

        } else {
            // Create new conversation
            // 5) Garantir que a conversa apareça na aba de atendimento se: assignedTo for null, status = "open"
            // We set user_id to NULL initially (unassigned) and status = 'OPEN'

            const newConv = await pool.query(`
        INSERT INTO whatsapp_conversations 
            (external_id, phone, contact_name, instance, last_message, last_message_at, unread_count, company_id, status, user_id)
        VALUES ($1, $2, $3, $4, $5, NOW(), 1, $6, 'OPEN', NULL)
        RETURNING id
      `, [remoteJid, cleanPhone, finalContactName, instanceName, content, companyId]);

            conversationId = newConv.rows[0].id;
            console.log(`[Message Processor] Created New Conversation ${conversationId} (OPEN)`);

            // Auto-Lead Creation (Optional but good practice to keep)
            try {
                const stageRes = await pool.query("SELECT id FROM crm_stages WHERE name = 'Leads' AND company_id = $1 LIMIT 1", [companyId]);
                if (stageRes.rows.length > 0) {
                    await pool.query(`
                   INSERT INTO crm_leads (name, phone, stage_id, origin, company_id, instance, created_at, updated_at)
                   VALUES ($1, $2, $3, 'WhatsApp', $4, $5, NOW(), NOW())
                   ON CONFLICT (phone, company_id) DO NOTHING
               `, [finalContactName, cleanPhone, stageRes.rows[0].id, companyId, instanceName]);
                }
            } catch (e) { }
        }

        // STEP C: Salvar mensagem no banco
        const insertedMsg = await pool.query(`
        INSERT INTO whatsapp_messages 
            (conversation_id, direction, content, sent_at, status, message_type, external_id, company_id, instance_key)
        VALUES ($1, 'inbound', $2, NOW(), 'received', $3, $4, $5, $6)
        ON CONFLICT (external_id) DO NOTHING
        RETURNING *
    `, [conversationId, content, messageType, externalId, companyId, instanceName]);

        if (insertedMsg.rows.length > 0) {
            console.log(`[Message Processor] ✅ Message saved: ${insertedMsg.rows[0].id}`);

            // Emit Socket Event
            // 6) Logar logs detalhados (already doing via console)
            // ... Socket emission ...
            return {
                message: insertedMsg.rows[0],
                conversationId,
                contactName: finalContactName,
                phone: cleanPhone
            };
        } else {
            console.log(`[Message Processor] Duplicate message (External ID: ${externalId})`);
            return null; // Duplicate
        }

    } catch (error: any) {
        console.error(`[Message Processor] ❌ Failed:`, error.message);
        throw error;
    }
};
