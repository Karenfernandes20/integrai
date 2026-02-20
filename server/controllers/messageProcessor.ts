
import { Request, Response } from 'express';
import { pool } from '../db/index.js';
import { resolveCompanyByInstanceKey } from '../utils/evolutionUtils.js';
import { getOrCreateQueueId } from './queueController.js';

const isUsableGroupTitle = (value?: string | null) => {
    if (!value) return false;
    const normalized = String(value).trim();
    if (!normalized) return false;
    if (/@g\.us$/i.test(normalized) || /@s\.whatsapp\.net$/i.test(normalized)) return false;
    if (/^grupo\s+\d+$/i.test(normalized)) return false;
    if (/^\d{8,16}$/.test(normalized)) return false;
    return true;
};

const extractGroupTitle = (msg: any) => {
    const m = msg?.message || {};
    const contextInfo =
        m?.extendedTextMessage?.contextInfo
        || m?.imageMessage?.contextInfo
        || m?.videoMessage?.contextInfo
        || m?.documentMessage?.contextInfo
        || {};

    const candidates = [
        msg?.groupName,
        msg?.groupSubject,
        msg?.subject,
        contextInfo?.groupSubject,
    ];

    for (const candidate of candidates) {
        if (isUsableGroupTitle(candidate)) {
            return String(candidate).trim();
        }
    }

    return null;
};

const ensureLeadForFirstPendingMessage = async (
    companyId: number,
    phone: string,
    leadName: string,
    instanceName: string
) => {
    const existingLead = await pool!.query(
        'SELECT id FROM crm_leads WHERE company_id = $1 AND phone = $2 LIMIT 1',
        [companyId, phone]
    );

    if (existingLead.rows.length > 0) {
        return null;
    }

    const leadsStageRes = await pool!.query(
        `SELECT id
         FROM crm_stages
         WHERE company_id = $1
           AND UPPER(TRIM(name)) = 'LEADS'
         ORDER BY position ASC
         LIMIT 1`,
        [companyId]
    );

    const fallbackStageRes = leadsStageRes.rows.length > 0
        ? { rows: [] }
        : await pool!.query(
            'SELECT id FROM crm_stages WHERE company_id = $1 ORDER BY position ASC LIMIT 1',
            [companyId]
        );

    const targetStageId = leadsStageRes.rows[0]?.id || fallbackStageRes.rows[0]?.id;

    if (!targetStageId) {
        return null;
    }

    const insertedLead = await pool!.query(
        `INSERT INTO crm_leads
            (name, phone, stage_id, company_id, origin, description, created_at, updated_at, instance)
         VALUES ($1, $2, $3, $4, 'WhatsApp', 'Criado automaticamente ao entrar em pendentes', NOW(), NOW(), $5)
         ON CONFLICT (phone, company_id) DO NOTHING
         RETURNING *`,
        [leadName || phone, phone, targetStageId, companyId, instanceName]
    );

    return insertedLead.rows[0] || null;
};

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
        const participant = isGroup ? (key.participantAlt || msg.participantAlt || key.participant || msg.participant || remoteJid) : remoteJid;
        const groupTitleFromPayload = isGroup ? extractGroupTitle(msg) : null;

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
            // Only update contact_name if it's NOT a group (private chats update name based on user)
            // For groups, we KEEP the existing group name
            let nameUpdateQuery = "";
            // We do NOT force 'OPEN' anymore. 
            // Logic: 
            // - If CLOSED -> Reopen as PENDING (Queue) and clear user_id
            // - If PENDING -> Stay PENDING
            // - If OPEN -> Stay OPEN

            let params = [content, instanceName, conversationId]; // base params ($1, $2, $3) - Note: status is dynamic now

            if (!isGroup) {
                nameUpdateQuery = ", contact_name = $4";
                params.push(senderContactName);
            } else {
                const currentGroupName = convRes.rows[0].contact_name;
                if (groupTitleFromPayload && (!currentGroupName || !isUsableGroupTitle(currentGroupName))) {
                    nameUpdateQuery = ", contact_name = $4, group_name = $4";
                    params.push(groupTitleFromPayload);
                } else if (!currentGroupName) {
                    nameUpdateQuery = ", contact_name = $4";
                    params.push("Grupo " + groupPhone);
                }
            }

            // Update Conversation
            // We use SQL CASE to handle status transition atomically
            const updateResult = await pool.query(`
                UPDATE whatsapp_conversations SET 
                    last_message = $1,
                    last_message_at = NOW(),
                    unread_count = unread_count + 1,
                    status = CASE WHEN status = 'CLOSED' THEN 'PENDING' ELSE status END,
                    user_id = CASE WHEN status = 'CLOSED' THEN NULL ELSE user_id END, 
                    instance = $2
                    ${nameUpdateQuery}
                WHERE id = $3
                RETURNING status
            `, params);

            const newStatus = updateResult.rows[0]?.status || 'OPEN'; // Fallback if update fails (shouldn't happens)
            console.log(`[Message Processor] Updated Conversation ${conversationId} (Status: ${newStatus})`);

            // Store for return
            var finalConversationStatus = newStatus;

        } else {
            // Create new conversation
            // For groups, we don't know the name yet. Use "Grupo + Number" 
            const defaultQueueId = await getOrCreateQueueId(companyId, 'Recepcao');
            const newConvName = isGroup ? (groupTitleFromPayload || `Grupo ${groupPhone}`) : senderContactName;

            // Start as PENDING (Waiting in Queue), not OPEN
            const newConv = await pool.query(`
                INSERT INTO whatsapp_conversations 
                    (external_id, phone, contact_name, instance, last_message, last_message_at, unread_count, company_id, status, user_id, is_group, group_name, queue_id, channel)
                VALUES ($1, $2, $3, $4, $5, NOW(), 1, $6, 'PENDING', NULL, $7, $8, $9, 'whatsapp')
                RETURNING id, status
            `, [remoteJid, isGroup ? groupPhone : senderPhone, newConvName, instanceName, content, companyId, isGroup, isGroup ? newConvName : null, defaultQueueId]);

            conversationId = newConv.rows[0].id;
            var finalConversationStatus = newConv.rows[0].status;
            console.log(`[Message Processor] Created New Conversation ${conversationId} (PENDING)`);

            if (!isGroup) {
                try {
                    const newLead = await ensureLeadForFirstPendingMessage(companyId, senderPhone, senderContactName, instanceName);
                    if (newLead) {
                        console.log(`[Message Processor] ✅ Auto-created CRM lead for ${senderPhone} (company ${companyId})`);
                    }
                } catch (leadError: any) {
                    console.error(`[Message Processor] ❌ Failed to auto-create CRM lead:`, leadError?.message || leadError);
                }
            }
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
                conversationStatus: finalConversationStatus,
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
