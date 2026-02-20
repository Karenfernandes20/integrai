import { Request, Response } from 'express';
import { pool } from '../database.js';
import { logEvent } from '../logger.js';
import { triggerWorkflow } from './workflowController.js';
import { processChatbotMessage } from '../services/chatbotService.js';
import { getOrCreateQueueId } from './queueController.js';
import { normalizePhone, extractPhoneFromJid, isGroupJid } from '../utils/phoneUtils.js';
import { downloadMediaFromEvolution } from '../services/mediaService.js';
import { returnToPending } from './conversationController.js';
import { handleWhaticketGreeting } from '../services/whaticketService.js';
import { getEvolutionConfig } from './evolutionController.js';
import { getInstagramProfile, formatInstagramUsername } from '../services/instagramProfileService.js';

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

// Caching for performance
const instanceMetaCache = new Map<string, { companyId: number, instanceId: number, instanceName: string }>();
const stagesCache: { map: any, lastFetch: number } = { map: null, lastFetch: 0 };
const STAGE_CACHE_TTL = 300000; // 5 minutes

// Memory logging to catch the last few payloads if they fail mapping
const lastPayloads: any[] = [];
const pushPayload = (p: any) => {
    lastPayloads.unshift({ t: new Date().toISOString(), ...p });
    if (lastPayloads.length > 20) lastPayloads.pop();
};

const picSyncThrottle = new Map<string, number>();
let hasGroupSubjectColumnCache: boolean | null = null;


const resolveConversationChannel = (instanceKey?: string | null): 'whatsapp' | 'instagram' => {
    const normalized = String(instanceKey || '').toLowerCase();
    if (normalized.includes('instagram') || normalized.includes('ig')) {
        return 'instagram';
    }
    return 'whatsapp';
};

const hasGroupSubjectColumn = async () => {
    if (!pool) return false;
    if (hasGroupSubjectColumnCache !== null) return hasGroupSubjectColumnCache;

    try {
        const result = await pool.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_name = 'whatsapp_conversations'
               AND column_name = 'group_subject'
             LIMIT 1`
        );
        hasGroupSubjectColumnCache = result.rows.length > 0;
    } catch (error) {
        console.warn('[Webhook] Could not verify group_subject column existence. Falling back to legacy schema mode.', error);
        hasGroupSubjectColumnCache = false;
    }

    return hasGroupSubjectColumnCache;
};

export const debugWebhookPayloads = (req: Request, res: Response) => {
    res.json(lastPayloads);
};


// ... imports
import { handleCallWebhook } from './callController.js';

// REACTION HANDLER
const handleReactionWebhook = async (payload: any, instance: string, io: any) => {
    try {
        if (!pool) return;

        // Evolution V2 Reaction Payload Structure Strategy
        // Payload sometimes comes as { data: { key:..., reaction:... } } or just { key:..., reaction:... }
        const data = payload.data || payload;
        const reaction = data.reaction;
        const key = data.key; // This is usually the key of the REACTION MESSAGE itself, NOT the target?
        // Actually, in Evolution/Baileys:
        // reaction: { text: "â¤ï¸", key: { remoteJid, fromMe, id } } -> The 'key' inside 'reaction' is the TARGET message.
        // The top-level 'key' is the sender info.

        if (!reaction || !reaction.key) {
            console.warn('[Webhook] Reaction event missing reaction.key data');
            return;
        }

        const targetKey = reaction.key;
        const targetId = targetKey.id;
        const emoji = reaction.text; // If null/empty, it is a removal

        // Sender Info
        const senderKey = key || {};
        const senderJid = senderKey.remoteJid || targetKey.remoteJid;
        const fromMe = senderKey.fromMe ?? targetKey.fromMe ?? false;

        // Find the target message in DB
        // We use external_id = targetId
        const msgRes = await pool.query('SELECT id, conversation_id, reactions, company_id FROM whatsapp_messages WHERE external_id = $1', [targetId]);

        if (msgRes.rows.length === 0) {
            console.warn(`[Webhook] Reaction target message not found: ${targetId}`);
            return;
        }

        const msg = msgRes.rows[0];
        let currentReactions = msg.reactions || [];
        if (!Array.isArray(currentReactions)) currentReactions = [];

        // Determine who reacted
        const reactorId = fromMe ? 'me' : senderJid;

        if (emoji) {
            // Add/Update reaction
            // Remove existing reaction from this user if any
            currentReactions = currentReactions.filter((r: any) => r.senderId !== reactorId);
            currentReactions.push({
                emoji,
                senderId: reactorId,
                fromMe,
                timestamp: Date.now()
            });
        } else {
            // Remove reaction (empty text)
            currentReactions = currentReactions.filter((r: any) => r.senderId !== reactorId);
        }

        // Update DB
        await pool.query('UPDATE whatsapp_messages SET reactions = $1 WHERE id = $2', [JSON.stringify(currentReactions), msg.id]);

        console.log(`[Webhook] Reaction processed for msg ${msg.id}: ${emoji || 'REMOVED'} by ${reactorId}`);

        // Emit Socket Update
        if (io) {
            const room = `company_${msg.company_id}`; // Using company from message
            const instanceRoom = `instance_${instance}`;
            io.to(room).emit('message:reaction', {
                messageId: msg.id,
                externalId: targetId,
                reactions: currentReactions,
                conversationId: msg.conversation_id
            });
            io.to(instanceRoom).emit('message:reaction', {
                messageId: msg.id,
                externalId: targetId,
                reactions: currentReactions,
                conversationId: msg.conversation_id
            });
        }

    } catch (e) {
        console.error('[Webhook] Error handling reaction:', e);
    }
};

export const handleWebhook = async (req: Request, res: Response) => {
    // 1. Return 200 OK immediately
    res.status(200).json({ status: 'received' });

    // 2. Process in background
    (async () => {
        try {
            const body = req.body;
            if (!body) return;

            // Handle Array or Object payload
            const payloads = Array.isArray(body) ? body : [body];

            for (const payload of payloads) {
                const eventType = payload.event || payload.type;
                const instance = payload.instance || payload.instanceName || payload.data?.instance;
                const data = payload.data; // data property usually contains the event payload

                if (!instance) {
                    continue; // Skip payloads without instance identification
                }

                // --- RESOLVE COMPANY (Optimization: Cache then DB) ---
                let meta = instanceMetaCache.get(instance);
                if (!meta) {
                    const instanceLookup = await pool.query(
                        `SELECT id, company_id, name 
                         FROM company_instances 
                         WHERE LOWER(instance_key) = LOWER($1) OR LOWER(name) = LOWER($1) 
                         LIMIT 1`,
                        [instance]
                    );
                    if (instanceLookup.rows.length > 0) {
                        const row = instanceLookup.rows[0];
                        meta = { companyId: row.company_id, instanceId: row.id, instanceName: row.name || instance };
                        instanceMetaCache.set(instance, meta);
                    }
                }

                if (!meta) {
                    console.warn(`[Webhook] Instance ${instance} not found in DB. Ignoring.`);
                    continue;
                }
                const { companyId, instanceId, instanceName: instanceDisplayName } = meta;

                // --- REQUIRED LOGGING ---
                if (['MESSAGES_UPSERT', 'messages.upsert'].includes(eventType)) {
                    console.log(`[Webhook] Recebido: messages.upsert`);
                    console.log(`[Webhook] Processando para Empresa ID: ${companyId}`);
                }

                // --- DISPATCH OTHER EVENTS ---
                // 1. REACTION
                if (['MESSAGES_REACTION', 'MESSAGE_REACTION', 'REACTION'].includes(eventType)) {
                    await handleReactionWebhook(payload, instance, req.app.get('io'));
                    continue;
                }
                // 2. CALL
                if (['CALL', 'call'].includes(eventType)) {
                    await handleCallWebhook(payload, instance, req.app.get('io'));
                    continue;
                }
                // 3. CONNECTION UPDATE
                if (['CONNECTION_UPDATE', 'connection.update'].includes(eventType)) {
                    const stateData = data || payload;
                    const state = stateData.state || stateData.status;
                    const dbStatus = state === 'open' ? 'connected' : (state === 'close' ? 'disconnected' : (state || 'disconnected'));

                    // Update DB
                    await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', [dbStatus, instance]);

                    // Emit
                    const io = req.app.get('io');
                    if (io) io.emit('instance:status', { instanceKey: instance, status: dbStatus, state });
                    continue;
                }

                // --- CORE: MESSAGES UPSERT ---
                if (['MESSAGES_UPSERT', 'messages.upsert'].includes(eventType)) {

                    const messages = data?.messages || data; // Evolution sometimes sends 'data' as the array if 'data' key exists? Normally data.messages

                    if (!messages || !Array.isArray(messages)) {
                        console.warn('[Webhook] messages.upsert payload invalid (no messages array)', JSON.stringify(data).substring(0, 100));
                        continue;
                    }

                    for (const message of messages) {
                        try {
                            const key = message.key;
                            if (!key) continue;
                            const remoteJid = key.remoteJid;

                            // Ignorar broadcasting
                            if (remoteJid === 'status@broadcast') continue;

                            // Extraction
                            const msg = message.message;
                            if (!msg) {
                                // Sometimes messages.upsert comes with status updates only (without message content)
                                // User said: "NÃO ignorar mensagens recebidas", "So ignorar status@broadcast e mensagens vazias sem conteudo real"
                                // If msg is missing, it's likely a status update event disguised or malformed.
                                continue;
                            }

                            // Texto extraído (Prioridade definida pelo USER)
                            const text =
                                msg?.conversation ||
                                msg?.extendedTextMessage?.text ||
                                msg?.imageMessage?.caption ||
                                msg?.videoMessage?.caption ||
                                msg?.buttonsResponseMessage?.selectedButtonId ||
                                msg?.listResponseMessage?.title ||
                                "";

                            console.log("[Message] Texto extraído:", text);

                            // Grupo?
                            const isGroup = remoteJid.endsWith('@g.us');
                            console.log("[Message] Grupo:", isGroup);

                            const fromMe = key.fromMe;
                            const messageId = key.id;
                            const timestamp = message.messageTimestamp || Math.floor(Date.now() / 1000);
                            const sentAt = new Date(Number(timestamp) * 1000);

                            // Participant handling for Groups
                            const participant = key.participant || message.participant || (isGroup ? null : remoteJid);
                            const senderJid = isGroup ? participant : remoteJid;

                            // Sender Name
                            const pushName = message.pushName || message.pushname || (isGroup ? null : "Contato");

                            // --- DB ACTIONS ---

                            // 1. Verify/Create Conversation
                            let conversationId: number;
                            let conversationClosed = false;

                            // Find existing
                            const convRes = await pool.query(
                                `SELECT id, status, is_group, contact_name FROM whatsapp_conversations WHERE company_id = $1 AND external_id = $2`,
                                [companyId, remoteJid]
                            );

                            if (convRes.rows.length === 0) {
                                // CREATE
                                const phone = extractPhoneFromJid(remoteJid);
                                const defaultQueueId = await getOrCreateQueueId(companyId, 'Recepção');

                                // Group Name or Contact Name
                                const contactName = isGroup
                                    ? (message.groupName || message.subject || "Grupo " + remoteJid)
                                    : (pushName || phone);

                                const newConv = await pool.query(
                                    `INSERT INTO whatsapp_conversations 
                                    (external_id, phone, contact_name, instance, status, company_id, is_group, group_name, queue_id, created_at, updated_at, unread_count, channel)
                                    VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7, $8, NOW(), NOW(), $9, 'whatsapp')
                                    RETURNING id`,
                                    [
                                        remoteJid,
                                        phone,
                                        contactName,
                                        instanceDisplayName,
                                        companyId,
                                        isGroup,
                                        isGroup ? contactName : null,
                                        defaultQueueId,
                                        fromMe ? 0 : 1 // Start with 1 unread if inbound
                                    ]
                                );
                                conversationId = newConv.rows[0].id;
                                console.log(`[Webhook] Created new conversation ${conversationId} for ${remoteJid}`);
                            } else {
                                const conv = convRes.rows[0];
                                conversationId = conv.id;
                                if (conv.status === 'CLOSED') conversationClosed = true;

                                // Update unread count and last message
                                await pool.query(
                                    `UPDATE whatsapp_conversations 
                                     SET last_message = $1, 
                                         last_message_at = $2,
                                         unread_count = CASE WHEN $3 = 'inbound' THEN unread_count + 1 ELSE unread_count END,
                                         status = CASE WHEN status = 'CLOSED' THEN 'PENDING' ELSE status END,
                                         updated_at = NOW()
                                     WHERE id = $4`,
                                    [text || (msg.imageMessage ? 'Imagem' : 'Mensagem'), sentAt.toISOString(), fromMe ? 'outbound' : 'inbound', conversationId]
                                );
                            }

                            // 2. Insert Message
                            // Identify type (basic)
                            let messageType = 'text';
                            let mediaUrl = null;
                            if (msg.imageMessage) { messageType = 'image'; mediaUrl = msg.imageMessage.url; }
                            else if (msg.videoMessage) { messageType = 'video'; mediaUrl = msg.videoMessage.url; }
                            else if (msg.audioMessage) { messageType = 'audio'; mediaUrl = msg.audioMessage.url; }
                            else if (msg.documentMessage) { messageType = 'document'; mediaUrl = msg.documentMessage.url; }
                            else if (msg.stickerMessage) { messageType = 'sticker'; mediaUrl = msg.stickerMessage.url; }

                            // Determine content fallback if empty text
                            let content = text;
                            if (!content) {
                                if (messageType === 'image') content = '[Imagem]';
                                else if (messageType === 'video') content = '[Vídeo]';
                                else if (messageType === 'audio') content = '[Áudio]';
                                else if (messageType === 'sticker') content = '[Figurinha]';
                                else content = '[Mensagem]';
                            }

                            const result = await pool.query(
                                `INSERT INTO whatsapp_messages 
                                (company_id, conversation_id, direction, content, message_type, media_url, status, external_id, sender_jid, sender_name, sent_at, instance_id, instance_name, message_source)
                                VALUES ($1, $2, $3, $4, $5, $6, 'received', $7, $8, $9, $10, $11, $12, $13)
                                ON CONFLICT (external_id) DO NOTHING RETURNING id`,
                                [
                                    companyId,
                                    conversationId,
                                    fromMe ? 'outbound' : 'inbound',
                                    content,
                                    messageType,
                                    mediaUrl,
                                    messageId,
                                    senderJid,
                                    pushName,
                                    sentAt.toISOString(),
                                    instanceId,
                                    instanceDisplayName,
                                    fromMe ? 'whatsapp_web' : 'whatsapp_mobile'
                                ]
                            );

                            if (result.rows.length > 0) {
                                console.log(`[Webhook] Saved message ${result.rows[0].id}`);

                                // 3. Log Event
                                await logEvent({
                                    eventType: fromMe ? 'message_out' : 'message_in',
                                    origin: 'webhook',
                                    status: 'success',
                                    message: `Message ${fromMe ? 'sent' : 'received'}`,
                                    conversationId,
                                    details: { content, externalId: messageId }
                                });

                                // 4. Socket Emit
                                // 4. Socket Emit
                                const io = req.app.get('io');
                                if (io) {
                                    const room = `company_${companyId}`;
                                    const payloadEmit = {
                                        id: result.rows[0].id,
                                        conversation_id: conversationId,
                                        company_id: companyId,
                                        direction: fromMe ? 'outbound' : 'inbound',
                                        content,
                                        message_type: messageType,
                                        media_url: mediaUrl,
                                        status: 'received',
                                        external_id: messageId,
                                        sender_jid: senderJid,
                                        sender_name: pushName,
                                        sent_at: sentAt.toISOString(),
                                        is_group: isGroup,
                                        contact_name: pushName,
                                        instance: instance
                                    };

                                    // Emit standard event
                                    io.to(room).emit('message:received', payloadEmit);

                                    // Emit user-requested diagnostic events
                                    io.to(room).emit('message.upsert', payloadEmit);
                                    if (isGroup) {
                                        io.to(room).emit('group.message.upsert', payloadEmit);
                                    }

                                    console.log(`[Webhook] Emitted Socket Events to ${room}: message:received, message.upsert${isGroup ? ', group.message.upsert' : ''}`);

                                    io.to(room).emit('conversation:updated', {
                                        id: conversationId,
                                        last_message: content,
                                        last_message_at: sentAt.toISOString(),
                                        unread_count: 1,
                                        status: conversationClosed ? 'PENDING' : undefined
                                    });
                                }

                                // 5. Trigger Workflow / Chatbot (Inbound only, usually)
                                if (!fromMe && !isGroup) {
                                    triggerWorkflow('message_received', {
                                        message_id: result.rows[0].id,
                                        content,
                                        direction: 'inbound',
                                        company_id: companyId,
                                        conversation_id: conversationId,
                                        phone: extractPhoneFromJid(remoteJid)
                                    }).catch(err => console.error('[Workflow] Trigger failed', err));

                                    processChatbotMessage(instance, remoteJid, content, req.app.get('io')).catch(err => console.error('[Chatbot] Failed', err));
                                }

                            } else {
                                console.log(`[Webhook] Message ${messageId} duplicate. Ignored.`);
                            }

                        } catch (msgErr) {
                            console.error('[Webhook] Error processing message item:', msgErr);
                            // User rule: "NÃO quebrar o loop"
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error('[Webhook] General Error:', e);
            await logEvent({
                eventType: 'webhook_error',
                origin: 'webhook',
                status: 'error',
                message: `Webhook processing error: ${e.message}`,
                details: { error: e.stack }
            });
        }
    })();
};
export const getConversations = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const supportsGroupSubject = await hasGroupSubjectColumn();

        const user = (req as any).user;
        const onlyGroups = String(req.query.onlyGroups || '').toLowerCase() === 'true';
        let companyId = req.query.companyId || user?.company_id;
        const groupSubjectExpr = supportsGroupSubject ? "NULLIF(TRIM(c.group_subject), '')" : 'NULL::text';


        if (onlyGroups) {
            const groupQuery = `
                SELECT
                    c.id,
                    ${groupSubjectExpr} AS group_subject,
                    COALESCE(NULLIF(TRIM(c.channel), ''), 'whatsapp') AS channel,
                    c.profile_pic_url AS profile_picture,
                    COALESCE(c.last_instance_key, c.instance) AS instance_key,
                    c.status,
                    c.external_id AS remote_jid,
                    c.company_id,
                    c.updated_at
                FROM whatsapp_conversations c
                WHERE c.is_group = true
            `;

            const params: any[] = [];
            let finalQuery = groupQuery;

            if (user.role !== 'SUPERADMIN') {
                finalQuery += ` AND c.company_id = $${params.length + 1}`;
                params.push(user.company_id);
            } else if (companyId) {
                finalQuery += ` AND c.company_id = $${params.length + 1}`;
                params.push(companyId);
            }

            finalQuery += ` ORDER BY c.updated_at DESC`;
            const groupResult = await pool.query(finalQuery, params);

            return res.json(groupResult.rows.map((row: any) => ({
                ...row,
                group_subject: row.group_subject || row.group_name || row.contact_name || (row.channel === 'instagram' ? 'Grupo Instagram' : 'Grupo WhatsApp')
            })));
        }

        // --- OPTIMISTIC REPAIR FOR NULL COMPANY_IDS (DISABLED FOR MOCK MODE) ---
        // if (user.role === 'SUPERADMIN') {
        //     try {
        //         await pool.query(`...`);
        //     } catch (e) { console.error('[Repair Mapping Error]:', e); }
        // }

        let query = `
            SELECT c.*, 
            (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us') as computed_is_group,
            lm.content as last_message,
            lm.sender_name as last_sender_name,
            lm.message_type as last_message_type,
            lm.direction as last_message_direction,
            lm.sent_at as last_message_at,
            CASE
              WHEN (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                THEN COALESCE(c.profile_pic_url, co.profile_pic_url)
              ELSE COALESCE(co.profile_pic_url, c.profile_pic_url)
            END as profile_pic_url,
            co.instagram_username,
            co.external_id as instagram_id,
            -- Prioritize Name/Username from contacts
            -- Instagram-specific display logic
            -- Priority: Contact Name > @Username > @ExternalID
            COALESCE(
                CASE WHEN (c.is_group = true OR c.external_id LIKE '%@g.us') THEN ${groupSubjectExpr} ELSE NULL END,
                CASE WHEN (c.is_group = true OR c.external_id LIKE '%@g.us') THEN NULLIF(TRIM(c.group_name), '') ELSE NULL END,
                NULLIF(TRIM(co.name), ''),
                CASE 
                    WHEN c.channel = 'instagram' AND co.username IS NOT NULL AND co.username != '' THEN 
                        CASE WHEN co.username LIKE '@%' THEN co.username ELSE '@' || co.username END
                    ELSE NULL 
                END,
                NULLIF(TRIM(c.contact_name), ''),
                CASE WHEN c.channel = 'instagram' THEN '@' || c.external_id ELSE c.phone END
            ) as display_name,
            -- Contact Saved Name logic
            CASE
              WHEN co.name IS NULL OR btrim(co.name) = '' THEN NULL
              WHEN co.name ~* 'https?://' OR length(co.name) > 60 THEN NULL
              ELSE co.name
            END as contact_saved_name,
            co.push_name as contact_push_name,
            comp.name as company_name,
            COALESCE(ci.name, c.last_instance_key, c.instance) as instance_friendly_name,
            ci.color as instance_color,
            q.name as queue_name,
            q.color as queue_color,
            CASE WHEN c.status = 'OPEN' THEN au.full_name ELSE NULL END as assigned_user_name,
            COALESCE((
                SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                FROM conversations_tags ct
                JOIN crm_tags t ON ct.tag_id = t.id
                WHERE ct.conversation_id = c.id
            ), '[]'::json) as tags
            FROM whatsapp_conversations c
            LEFT JOIN LATERAL (
                SELECT wm.content, wm.sender_name, wm.message_type, wm.direction, wm.sent_at
                FROM whatsapp_messages wm
                WHERE wm.conversation_id = c.id
                ORDER BY wm.sent_at DESC NULLS LAST, wm.id DESC
                LIMIT 1
            ) lm ON TRUE
            LEFT JOIN LATERAL (
                SELECT 
                    co.profile_picture as profile_pic_url, 
                    co.instagram_username,
                    co.username,
                    co.external_id,
                    -- For WhatsApp we often use push_name, for Instagram we want username
                    COALESCE(co.username, co.push_name) as push_name, 
                    COALESCE(co.name, co.instagram_username, co.username) as name
                FROM contacts co
                WHERE co.company_id = c.company_id
                  AND (
                    -- STRICT JOIN FOR INSTAGRAM
                    (c.channel = 'instagram' AND co.external_id = c.external_id)
                    OR
                    -- FUZZY JOIN FOR WHATSAPP
                    (c.channel = 'whatsapp' AND (
                        co.external_id = c.external_id
                        OR co.phone = split_part(c.external_id, '@', 1)
                        OR (
                            REGEXP_REPLACE(COALESCE(co.phone, ''), '\\D', '', 'g') <> ''
                            AND REGEXP_REPLACE(COALESCE(co.phone, ''), '\\D', '', 'g') = REGEXP_REPLACE(COALESCE(c.phone, ''), '\\D', '', 'g')
                        )
                    ))
                  )
                ORDER BY
                  -- Priority: Exact Match > Phone Match > Recent
                  CASE
                    WHEN co.external_id = c.external_id THEN 0
                    WHEN co.phone = split_part(c.external_id, '@', 1) THEN 1
                    ELSE 9
                  END,
                  co.updated_at DESC NULLS LAST
                LIMIT 1
            ) co ON TRUE
            LEFT JOIN companies comp ON c.company_id = comp.id
            LEFT JOIN company_instances ci ON c.last_instance_key = ci.instance_key
            LEFT JOIN queues q ON c.queue_id = q.id
            LEFT JOIN app_users au ON au.id = c.user_id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (user.role !== 'SUPERADMIN') {
            query += ` AND c.company_id = $${params.length + 1}`;
            params.push(user.company_id);

            // Whaticket: Queue filter for non-admins
            if (user.role !== 'ADMIN') {
                query += ` AND (
                    c.queue_id IS NULL 
                    OR c.queue_id IN (SELECT queue_id FROM whatsapp_queues_users WHERE user_id = $${params.length + 1})
                    OR c.user_id = $${params.length + 1}
                )`;
                params.push(user.id);
            }
        } else {
            if (companyId) {
                query += ` AND c.company_id = $${params.length + 1}`;
                params.push(companyId);
            }
        }

        // Lenient filter for valid conversations
        query += ` AND (
            c.is_group = true 
            OR c.phone IS NULL
            OR (c.phone ~ '^[0-9+]+$' AND LENGTH(REGEXP_REPLACE(c.phone, '\\D', '', 'g')) BETWEEN 8 AND 15)
            OR c.external_id IS NOT NULL
        )`;

        // Only valid conversations that already have at least one message
        query += ` AND EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.conversation_id = c.id)`;

        query += ` ORDER BY c.updated_at DESC`;

        const result = await pool.query(query, params);
        const isUsableGroupName = (value?: string | null) => {
            if (!value) return false;
            const name = String(value).trim();
            if (!name) return false;
            if (/@g\.us$/i.test(name) || /@s\.whatsapp\.net$/i.test(name)) return false;
            if (/^\d{8,16}$/.test(name)) return false;
            return true;
        };

        const normalizedRows = result.rows.map((row: any) => {
            const computedIsGroup = Boolean(row.computed_is_group);
            const fallbackGroupName = computedIsGroup
                ? (
                    (isUsableGroupName(row.group_subject) ? row.group_subject : null) ||
                    (isUsableGroupName(row.group_name) ? row.group_name : null) ||
                    'Grupo (Nome nÃ£o sincronizado)'
                )
                : row.group_name;
            return {
                ...row,
                is_group: computedIsGroup,
                group_name: fallbackGroupName
            };
        });

        // Lazy photo sync for existing conversations without profile_pic_url.
        // This runs in background and is throttled per company to avoid excessive API traffic.
        const syncCompanyId = user.role === 'SUPERADMIN' ? Number(companyId || 0) : Number(user.company_id || 0);
        if (syncCompanyId) {
            const throttleKey = `conv_pic_sync_${syncCompanyId}`;
            const lastRun = picSyncThrottle.get(throttleKey) || 0;
            const now = Date.now();
            if (now - lastRun > 60_000) {
                picSyncThrottle.set(throttleKey, now);
                const missingPics = normalizedRows
                    .filter((r: any) => !r.profile_pic_url && (r.external_id || r.phone))
                    .slice(0, 20);

                if (missingPics.length > 0) {
                    (async () => {
                        try {
                            const cfg = await getEvolutionConfig((req as any).user, 'lazy_pic_sync', String(syncCompanyId));
                            const baseUrl = String(cfg.url || '').replace(/\/$/, '');
                            const apiKey = cfg.apikey;
                            if (!baseUrl || !apiKey) return;

                            for (const conv of missingPics) {
                                try {
                                    const instanceKey = String(conv.last_instance_key || conv.instance || cfg.instance || '').trim();
                                    if (!instanceKey) continue;
                                    const target = String(conv.external_id || conv.phone || '').trim();
                                    if (!target) continue;

                                    let picUrl: string | null = null;
                                    const picRes = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instanceKey}`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', apikey: apiKey },
                                        body: JSON.stringify({ number: target })
                                    });
                                    if (picRes.ok) {
                                        const picData = await picRes.json();
                                        picUrl = picData.profilePictureUrl || picData.url || null;
                                    }

                                    if (!picUrl && conv.is_group) {
                                        const grpRes = await fetch(`${baseUrl}/group/findGroup/${instanceKey}?groupJid=${encodeURIComponent(target)}`, {
                                            method: 'GET',
                                            headers: { 'Content-Type': 'application/json', apikey: apiKey }
                                        });
                                        if (grpRes.ok) {
                                            const grpData = await grpRes.json();
                                            picUrl = grpData.profilePictureUrl || grpData.pic || grpData.picture || null;
                                        }
                                    }

                                    if (picUrl) {
                                        await pool!.query('UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE id = $2', [picUrl, conv.id]);
                                        if (!conv.is_group) {
                                            await pool!.query(
                                                'UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE (jid = $2 OR phone = $3) AND company_id = $4',
                                                [picUrl, conv.external_id || conv.phone, String(conv.phone || '').replace(/\D/g, ''), syncCompanyId]
                                            );
                                        }
                                    }
                                } catch (e) {
                                    console.warn('[getConversations] lazy photo sync item failed:', e);
                                }
                            }
                        } catch (e) {
                            console.warn('[getConversations] lazy photo sync failed:', e);
                        }
                    })();
                }
            }
        }

        res.json(normalizedRows);
    } catch (error) {
        const sqlState = (error as any)?.code;
        console.error('[getConversations] Error fetching conversations:', error);

        if (sqlState === '42703') {
            return res.status(500).json({
                error: 'Schema mismatch while fetching conversations',
                details: 'Uma coluna esperada nÃ£o existe. Rode as migrations e tente novamente.'
            });
        }

        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { conversationId } = req.params;
        const user = (req as any).user;
        const companyId = user?.company_id;

        try {
            console.log(`[getMessages] Fetching messages for conversation ${conversationId}, user company: ${companyId}`);

            const check = await pool.query('SELECT company_id, instance FROM whatsapp_conversations WHERE id = $1', [conversationId]);
            if (check.rows.length === 0) {
                // Even if conv not found in DB, if checking mock convo 9991/9992, return mock messages
                if (conversationId === '9991' || conversationId === '9992') throw new Error("Mock requested");

                console.warn(`[getMessages] Conversation ${conversationId} not found`);
                return res.status(404).json({ error: 'Conversation not found' });
            }

            const msgCompanyId = check.rows[0].company_id;
            const instance = check.rows[0].instance;

            // Permission Check: Superadmin sees everything. Others must match companyId.
            if (user.role !== 'SUPERADMIN') {
                if (!companyId || (msgCompanyId && msgCompanyId !== companyId)) {
                    console.warn(`[getMessages] Permission denied for conversation ${conversationId}. MsgCompany: ${msgCompanyId}, UserCompany: ${companyId}`);
                    return res.status(403).json({ error: 'VocÃª nÃ£o tem permissÃ£o para acessar estas mensagens.' });
                }
            }

            const result = await pool.query(
                `SELECT m.*, 
                        u.full_name as user_name,
                        COALESCE(co.name, co.instagram_username, co.username, m.sender_name, split_part(m.sender_jid, '@', 1)) as sender_name,
                        CASE 
                            WHEN m.campaign_id IS NOT NULL THEN 'campaign'
                            WHEN m.follow_up_id IS NOT NULL THEN 'follow_up'
                            WHEN m.user_id IS NOT NULL THEN 'system_user'
                            WHEN m.direction = 'outbound' AND m.user_id IS NULL THEN 'ai_agent'
                            ELSE 'unknown'
                        END as message_origin,
                        CASE 
                            WHEN m.campaign_id IS NOT NULL THEN 'Campanha'
                            WHEN m.follow_up_id IS NOT NULL THEN 'Follow-Up'
                            WHEN m.sent_by_user_name IS NOT NULL THEN m.sent_by_user_name
                            WHEN m.user_id IS NOT NULL THEN u.full_name
                            WHEN m.direction = 'outbound' AND m.user_id IS NULL THEN 'Agente de IA'
                            ELSE NULL
                        END as agent_name,
                        ci.name as instance_friendly_name,
                        ci.color as instance_color
                FROM whatsapp_messages m
                LEFT JOIN app_users u ON m.user_id = u.id
                LEFT JOIN contacts co ON (
                    co.company_id = $2 AND co.external_id = COALESCE(m.sender_jid, (SELECT external_id FROM whatsapp_conversations WHERE id = m.conversation_id LIMIT 1))
                )
                LEFT JOIN company_instances ci ON m.instance_id = ci.id
                WHERE m.conversation_id = $1 
                ORDER BY m.sent_at ASC`,
                [conversationId, msgCompanyId]
            );

            console.log(`[getMessages] Success. Found ${result.rows.length} messages. Resetting unread count.`);

            // Reset unread count in background
            pool.query('UPDATE whatsapp_conversations SET unread_count = 0 WHERE id = $1', [conversationId])
                .catch((e: any) => console.error('[getMessages] Failed to reset unread count:', e));

            res.json(result.rows);

        } catch (dbErr: any) {
            console.error('[getMessages] Database error:', dbErr);
            throw new Error('Database unavailable');
        }

    } catch (error) {
        console.error('[getMessages Error]:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};
// --- INSTAGRAM INTEGRATION ---

export const verifyInstagramWebhook = async (req: Request, res: Response) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;

        console.log(`[Instagram Webhook] Tentativa de verificaÃ§Ã£o: mode=${mode}, token=${token}`);

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Instagram Webhook] Verificado com sucesso.');
            // Meta exige que o desafio seja retornado como texto puro na resposta
            return res.status(200).send(challenge);
        }

        console.warn(`[Instagram Webhook] Falha na verificaÃ§Ã£o. Token esperado: ${VERIFY_TOKEN ? 'Configurado' : 'AUSENTE'}`);
        return res.sendStatus(403);
    } catch (e) {
        console.error('[Instagram Verify Error]', e);
        return res.sendStatus(403);
    }
};

export const verifyWhatsappOfficialWebhook = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log(`[WhatsApp Official Webhook] Tentativa de verificaÃ§Ã£o para empresa ${companyId}: mode=${mode}, token=${token}`);

        if (mode === 'subscribe' && token) {
            const result = await pool!.query(
                'SELECT whatsapp_official_webhook_token, verify_token FROM companies WHERE id = $1',
                [companyId]
            );
            const savedToken = result.rows[0]?.whatsapp_official_webhook_token || result.rows[0]?.verify_token;

            if (savedToken && token === savedToken) {
                console.log('[WhatsApp Official Webhook] Verificado com sucesso.');
                return res.status(200).send(challenge);
            }
        }

        console.warn(`[WhatsApp Official Webhook] Falha na verificaÃ§Ã£o para empresa ${companyId}.`);
        return res.sendStatus(403);
    } catch (e) {
        console.error('[WhatsApp Official Verify Error]', e);
        return res.sendStatus(403);
    }
};

export const handleWhatsappOfficialWebhook = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        const body = req.body;
        const compId = parseInt(companyId);

        if (isNaN(compId) || !pool) {
            res.sendStatus(400);
            return;
        }

        console.log(`[WhatsApp Official Webhook] Evento recebido para empresa ${companyId}`);

        // IMPORTANT: We respond 200 immediately to Meta to acknowledge receipt
        res.sendStatus(200);

        // Process in background
        (async () => {
            try {
                // Log event for debugging
                await logEvent({
                    eventType: 'webhook_received',
                    origin: 'webhook',
                    status: 'success',
                    message: `Webhook do WhatsApp Official recebido (Empresa ${companyId})`,
                    details: body
                });

                // Update Status to Connected
                await pool!.query("UPDATE companies SET whatsapp_meta_status = 'CONNECTED', whatsapp_meta_last_sync = NOW() WHERE id = $1", [compId]);

                if (!body.entry || !Array.isArray(body.entry)) return;

                for (const entry of body.entry) {
                    if (!entry.changes || !Array.isArray(entry.changes)) continue;

                    for (const change of entry.changes) {
                        const value = change.value;
                        if (!value || value.messaging_product !== 'whatsapp') continue;

                        const metadata = value.metadata;
                        const contactsRaw = value.contacts || [];
                        const messages = value.messages || [];
                        const statuses = value.statuses || [];

                        // 1. Handle Contacts (Profile Info)
                        // Meta sends contact info (like profile name) in the 'contacts' array
                        for (const contact of contactsRaw) {
                            const wa_id = contact.wa_id;
                            const profileName = contact.profile?.name;
                            if (wa_id && profileName) {
                                const externalId = wa_id + '@s.whatsapp.net';
                                try {
                                    // Upsert contact info
                                    await pool!.query(`
                                        INSERT INTO contacts (company_id, channel, external_id, phone, name, push_name, instance, updated_at)
                                        VALUES ($1, 'whatsapp', $2, $3, $4, $5, 'official', NOW())
                                        ON CONFLICT (company_id, channel, external_id) 
                                        DO UPDATE SET 
                                            push_name = COALESCE(EXCLUDED.push_name, contacts.push_name),
                                            updated_at = NOW()
                                    `, [compId, externalId, wa_id, wa_id, profileName]);
                                } catch (e) {
                                    console.error('[WhatsApp Official] Error upserting contact:', e);
                                }
                            }
                        }

                        // 2. Handle Messages
                        for (const msg of messages) {
                            // Skip system messages or unsupported types for now if needed
                            if (msg.type === 'system') continue;

                            const from = msg.from; // Phone number
                            const wamid = msg.id;
                            const timestamp = msg.timestamp; // Unix timestamp in seconds
                            const type = msg.type;

                            const remoteJid = from + '@s.whatsapp.net';
                            const phone = from;

                            // Content Extraction
                            let content = '';
                            let messageType = 'text';
                            let mediaUrl = null;

                            if (type === 'text') {
                                content = msg.text?.body || '';
                            } else if (type === 'image') {
                                messageType = 'image';
                                content = msg.image?.caption || 'Imagem';
                                // Used to download media later using media ID
                                mediaUrl = msg.image?.id;
                            } else if (type === 'video') {
                                messageType = 'video';
                                content = msg.video?.caption || 'VÃ­deo';
                                mediaUrl = msg.video?.id;
                            } else if (type === 'audio' || type === 'voice') {
                                messageType = 'audio';
                                content = 'Ãudio';
                                mediaUrl = (msg.audio || msg.voice)?.id;
                            } else if (type === 'document') {
                                messageType = 'document';
                                content = msg.document?.caption || msg.document?.filename || 'Documento';
                                mediaUrl = msg.document?.id;
                            } else if (type === 'location') {
                                messageType = 'location';
                                content = `LocalizaÃ§Ã£o: ${msg.location?.name || ''} (${msg.location?.latitude}, ${msg.location?.longitude})`;
                            } else if (type === 'button') {
                                content = msg.button?.text || '';
                            } else if (type === 'interactive') {
                                const interactive = msg.interactive;
                                if (interactive.type === 'button_reply') {
                                    content = interactive.button_reply?.title || interactive.button_reply?.id;
                                } else if (interactive.type === 'list_reply') {
                                    content = interactive.list_reply?.title || interactive.list_reply?.id;
                                }
                            } else {
                                content = `[Mensagem tipo ${type}]`;
                            }

                            // Sender Name Resolution
                            let senderName = phone;
                            const contactRes = await pool!.query(
                                "SELECT name, push_name FROM contacts WHERE company_id = $1 AND external_id = $2 LIMIT 1",
                                [compId, remoteJid]
                            );
                            if (contactRes.rows.length > 0) {
                                senderName = contactRes.rows[0].push_name || contactRes.rows[0].name || senderName;
                            }

                            // --- AUTO-CREATE LEAD LOGIC (First Time Interaction) ---
                            try {
                                const leadCheck = await pool!.query(
                                    "SELECT id FROM crm_leads WHERE company_id = $1 AND phone = $2",
                                    [compId, phone]
                                );

                                if (leadCheck.rows.length === 0) {
                                    // Find LEADS stage
                                    const stageRes = await pool!.query(
                                        "SELECT id FROM crm_stages WHERE company_id = $1 AND UPPER(name) = 'LEADS' LIMIT 1",
                                        [compId]
                                    );
                                    let targetStageId;
                                    if (stageRes.rows.length > 0) {
                                        targetStageId = stageRes.rows[0].id;
                                    } else {
                                        // Fallback
                                        const firstStage = await pool!.query(
                                            "SELECT id FROM crm_stages WHERE company_id = $1 ORDER BY position ASC LIMIT 1",
                                            [compId]
                                        );
                                        if (firstStage.rows.length > 0) targetStageId = firstStage.rows[0].id;
                                    }

                                    if (targetStageId) {
                                        const newLead = await pool!.query(
                                            `INSERT INTO crm_leads 
                                             (name, phone, stage_id, company_id, origin, description, created_at, updated_at, instance)
                                             VALUES ($1, $2, $3, $4, 'WhatsApp', 'Criado automaticamente via WhatsApp Official', NOW(), NOW(), 'official')
                                             RETURNING *`,
                                            [senderName, phone, targetStageId, compId]
                                        );

                                        // Emit socket for CRM update
                                        const io = req.app.get('io');
                                        if (io) {
                                            io.to(`company_${compId}`).emit('crm:lead_created', newLead.rows[0]);
                                        }
                                        console.log(`[WhatsApp Official] Auto-created CRM Lead for ${phone}`);
                                    }
                                }
                            } catch (e) {
                                console.error('[WhatsApp Official] Error creating auto-lead:', e);
                            }

                            // --- CONVERSATION HANDLING ---
                            let conversationId: number;

                            // Check existing conversation
                            // We use instance = 'official'
                            const checkConv = await pool!.query(
                                `SELECT id, status FROM whatsapp_conversations 
                                 WHERE company_id = $1 AND external_id = $2`,
                                // We matched by external_id mostly. Usually companies only have 1 active channel per number, 
                                // but strictly we should filter by channel or instance. 
                                // For now, let's assume external_id + company_id is unique enough or we explicitly check 'official'
                                // But to be consistent with "Integrai Karen" user request, we match what we have.
                                [compId, remoteJid]
                            );

                            let currentStatus = 'PENDING';
                            let isNew = false;
                            const instanceName = 'official';

                            if (checkConv.rows.length > 0) {
                                conversationId = checkConv.rows[0].id;
                                const row = checkConv.rows[0];

                                // FORCE UPDATE TO PENDING (User Request)
                                if (row.status !== 'PENDING') {
                                    await pool!.query(
                                        "UPDATE whatsapp_conversations SET status = 'PENDING', last_message_at = NOW(), contact_name = COALESCE(contact_name, $2) WHERE id = $1",
                                        [conversationId, senderName]
                                    );
                                    currentStatus = 'PENDING';
                                } else {
                                    // Just update timestamp
                                    await pool!.query(
                                        "UPDATE whatsapp_conversations SET last_message_at = NOW() WHERE id = $1",
                                        [conversationId]
                                    );
                                }
                            } else {
                                // Create new conversation
                                isNew = true;
                                const defaultQueueId = await getOrCreateQueueId(compId, 'Recepção');

                                const newConv = await pool!.query(
                                    `INSERT INTO whatsapp_conversations (
                                        external_id, phone, contact_name, instance, status, company_id, 
                                        is_group, queue_id, channel, last_message_at
                                    ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, 'whatsapp', NOW()) RETURNING id`,
                                    [remoteJid, phone, senderName, instanceName, 'PENDING', compId, defaultQueueId]
                                );
                                conversationId = newConv.rows[0].id;
                            }

                            // Insert Message
                            const insertedMsg = await pool!.query(`
                                INSERT INTO whatsapp_messages
                                (company_id, conversation_id, direction, content, message_type, media_url, status, external_id, channel, sender_name, sent_at)
                                VALUES($1, $2, 'inbound', $3, $4, $5, 'received', $6, 'whatsapp', $7, to_timestamp($8))
                                RETURNING *
                            `, [compId, conversationId, content, messageType, mediaUrl, wamid, senderName, timestamp]);

                            const msgPayload = insertedMsg.rows[0];

                            // Emit Socket
                            const io = req.app.get('io');
                            if (io) {
                                const payload = {
                                    ...msgPayload,
                                    contact_name: senderName,
                                    profile_pic_url: null, // TODO: Fetch profile pic if possible
                                    message_origin: 'whatsapp_official'
                                };
                                io.to(`company_${compId}`).emit('message:received', payload);

                                // Also emit conversation update to move card in UI
                                io.to(`company_${compId}`).emit('conversation:updated', {
                                    id: conversationId,
                                    status: 'PENDING',
                                    last_message: content,
                                    last_message_at: new Date(timestamp * 1000).toISOString(),
                                    unread_count: 1 // Increment logic might be needed
                                });
                            }

                            // Trigger Workflow
                            triggerWorkflow('message_received', {
                                message_id: msgPayload.id,
                                content,
                                direction: 'inbound',
                                company_id: compId,
                                conversation_id: conversationId,
                                phone: phone,
                                channel: 'whatsapp'
                            }).catch(() => { });
                        }

                        // 3. Handle Status Updates (Sent, Delivered, Read)
                        for (const status of statuses) {
                            const wamid = status.id;
                            const newStatus = status.status; // sent, delivered, read, failed
                            const recipientId = status.recipient_id; // verification

                            try {
                                const res = await pool!.query(
                                    "UPDATE whatsapp_messages SET status = $1 WHERE external_id = $2 AND company_id = $3 RETURNING id, conversation_id",
                                    [newStatus, wamid, compId]
                                );

                                if (res.rows.length > 0 && req.app.get('io')) {
                                    req.app.get('io').to(`company_${compId}`).emit('message:status', {
                                        externalId: wamid,
                                        status: newStatus,
                                        conversationId: res.rows[0].conversation_id
                                    });
                                }
                            } catch (e) {
                                console.error('[WhatsApp Official] Failed to update message status:', e);
                            }
                        }
                    }
                }

            } catch (e) {
                console.error('[WhatsApp Official Webhook Processing Error]', e);
            }
        })();

    } catch (e) {
        console.error('[WhatsApp Official Webhook Error]', e);
        if (!res.headersSent) res.sendStatus(500);
    }
};

export const handleInstagramWebhook = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        console.log('[Instagram Webhook] Received event:', JSON.stringify(body, null, 2));

        // LOG TO DB FOR DEBUGGING
        await logEvent({
            eventType: 'webhook_received',
            origin: 'webhook',
            status: 'success',
            message: 'Webhook do Instagram recebido',
            details: body
        });

        res.sendStatus(200);

        // 2. Process
        if (body.object === 'instagram' || body.object === 'page') {
            for (const entry of body.entry) {
                // Determine Company by Page ID/Instagram Business ID (recipient.id)
                // We need to match entry.id (Page ID) or messaging.recipient.id with company
                const pageId = entry.id;

                // Find company by page_id or business_id
                const companyRes = await pool!.query(`
                    SELECT id, instagram_enabled, instagram_access_token 
                    FROM companies 
                    WHERE instagram_page_id = $1 OR instagram_business_id = $1
                    LIMIT 1
                `, [pageId]);

                if (companyRes.rows.length === 0) {
                    console.warn(`[Instagram Webhook] Unknown Page ID: ${pageId}. No company found.`);
                    continue;
                }
                const company = companyRes.rows[0];
                if (!company.instagram_enabled) {
                    console.log(`[Instagram Webhook] Company ${company.id} has Instagram disabled.`);
                    continue;
                }

                // Process Messaging Events
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        const senderId = event.sender.id; // IGSID (Instagram Scoped User ID)

                        // Handle Messages
                        if (event.message) {
                            const messageId = event.message.mid;
                            const text = event.message.text;
                            const isEcho = event.message.is_echo;
                            const attachments = event.message.attachments;

                            // Skip echoes for now (messages sent by page), unless we want to sync outbound from other tools
                            if (isEcho) continue;

                            // DEBUG: Log ID Length
                            if (process.env.DEBUG === 'true' || process.env.DEBUG_WEBHOOK === 'true') {
                                console.log(`[Instagram Webhook Debug] Msg from ${senderId} (len: ${senderId.length})`);
                                if (messageId) {
                                    console.log(`[Instagram Webhook Debug] MID: ${messageId} (len: ${messageId.length})`);
                                }
                            }

                            console.log(`[Instagram Webhook] Msg from ${senderId}: ${text}`);

                            // Get User Profile via Service (Meta Graph API)
                            // Using static import now
                            const profile = await getInstagramProfile(senderId, company.instagram_access_token, company.id);

                            const username = profile.username || senderId; // Username real ou ID numÃ©rico
                            const realName = profile.name || null;         // Nome completo
                            const profilePic = profile.profilePic || null;

                            // Determine final display name
                            const finalDisplayName = realName || (username.startsWith('@') ? username : `@${username}`);

                            console.log(`[Instagram Webhook] Resolved Profile: @${username} | Name: ${realName} | Display: ${finalDisplayName}`);

                            // UPSERT Contact Logic
                            try {
                                await pool!.query(`
                                    INSERT INTO contacts (
                                        company_id, channel, external_id, 
                                        name, username, instagram_username, instagram_id, 
                                        profile_picture, updated_at
                                    )
                                    VALUES ($1, 'instagram', $2, $3, $4, $4, $2, $5, NOW())
                                    ON CONFLICT (company_id, channel, external_id)
                                    DO UPDATE SET
                                        name = COALESCE(EXCLUDED.name, contacts.name),
                                        username = COALESCE(EXCLUDED.username, contacts.username),
                                        instagram_username = COALESCE(EXCLUDED.instagram_username, contacts.instagram_username),
                                        profile_picture = COALESCE(EXCLUDED.profile_picture, contacts.profile_picture),
                                        updated_at = NOW()
                                `, [company.id, senderId, realName, username, profilePic]);
                            } catch (e) {
                                console.error('[Instagram Webhook] Error upserting contact:', e);
                            }

                            // Create/Update Conversation
                            // Check existing conversation
                            const convRes = await pool!.query(`
                                SELECT id, status FROM whatsapp_conversations 
                                WHERE external_id = $1 AND company_id = $2
                            `, [senderId, company.id]);

                            let conversationId;
                            if (convRes.rows.length > 0) {
                                conversationId = convRes.rows[0].id;
                                // Update status and name/username/pic
                                await pool!.query(`
                                    UPDATE whatsapp_conversations 
                                    SET status = CASE WHEN status = 'CLOSED' THEN 'PENDING' ELSE status END,
                                        contact_name = $1,
                                        instagram_username = $2,
                                        profile_pic_url = COALESCE($3, profile_pic_url),
                                        updated_at = NOW()
                                    WHERE id = $4
                                `, [finalDisplayName, username, profilePic, conversationId]);
                            } else {
                                const defaultQueueId = await getOrCreateQueueId(company.id, 'Recepção');
                                // Create New Conversation
                                const newConv = await pool!.query(`
                                    INSERT INTO whatsapp_conversations 
                                    (company_id, external_id, phone, contact_name, status, channel, instagram_user_id, instagram_username, profile_pic_url, queue_id, created_at, updated_at)
                                    VALUES ($1, $2, $3, $4, 'PENDING', 'instagram', $5, $6, $7, $8, NOW(), NOW())
                                    RETURNING id
                                `, [company.id, senderId, '0000000000', finalDisplayName, senderId, username, profilePic, defaultQueueId]);
                                conversationId = newConv.rows[0].id;
                            }

                            // Sync to contacts for consistency (Omnichannel)
                            await pool!.query(`
                                INSERT INTO contacts 
                                (company_id, channel, external_id, name, instagram_username, username, phone, instagram_id, profile_picture, updated_at)
                                VALUES ($1, 'instagram', $2, $3, $4, $4, $5, $6, $7, NOW())
                                ON CONFLICT (company_id, channel, external_id) 
                                DO UPDATE SET
                                    instagram_username = EXCLUDED.instagram_username,
                                    username = EXCLUDED.username,
                                    profile_picture = COALESCE(EXCLUDED.profile_picture, contacts.profile_picture),
                                    instagram_id = EXCLUDED.instagram_id,
                                    name = CASE 
                                        WHEN contacts.name IS NULL OR contacts.name = '' OR contacts.name = contacts.external_id OR contacts.name = 'Instagram User' THEN EXCLUDED.name 
                                        ELSE contacts.name 
                                    END,
                                    updated_at = NOW()
                            `, [company.id, senderId, finalDisplayName, username, '0000000000', senderId, profilePic]);
                            // Determine Message Type
                            let msgType = 'text';
                            let mediaUrl = null;
                            let content = text || '';

                            if (attachments && attachments.length > 0) {
                                const att = attachments[0];
                                if (att.type === 'image') {
                                    msgType = 'image';
                                    mediaUrl = att.payload.url;
                                    content = 'Imagem';
                                } else if (att.type === 'video') {
                                    msgType = 'video';
                                    mediaUrl = att.payload.url;
                                    content = 'VÃ­deo';
                                } else if (att.type === 'audio') {
                                    msgType = 'audio';
                                    mediaUrl = att.payload.url;
                                    content = 'Ãudio';
                                } else {
                                    content = `[Anexo: ${att.type}]`;
                                }
                            }

                            // Save Message
                            const insertedMsg = await pool!.query(`
                                INSERT INTO whatsapp_messages
                                (company_id, conversation_id, direction, content, message_type, media_url, status, external_id, channel, sender_name, sent_at)
                            VALUES($1, $2, 'inbound', $3, $4, $5, 'received', $6, 'instagram', $7, NOW())
                            RETURNING *
                                `, [company.id, conversationId, content, msgType, mediaUrl, messageId, finalDisplayName]);

                            // Emit Socket
                            const io = req.app.get('io');
                            if (io) {
                                const payload = {
                                    ...insertedMsg.rows[0],
                                    contact_name: finalDisplayName,
                                    profile_pic_url: profilePic,
                                    message_origin: 'instagram'
                                };
                                io.to(`company_${company.id} `).emit('message:received', payload);
                            }

                            // Trigger Workflow (Unified)
                            triggerWorkflow('message_received', {
                                message_id: insertedMsg.rows[0].id,
                                content,
                                direction: 'inbound',
                                company_id: company.id,
                                conversation_id: conversationId,
                                phone: senderId, // Use ID as identifier
                                channel: 'instagram'
                            }).catch(() => { });

                        }
                    }
                }
            }
        } else {
            res.sendStatus(404);
        }
    } catch (e: any) {
        console.error('[Instagram Webhook Error]', e);
        if (!res.headersSent) res.sendStatus(500);
    }
};
