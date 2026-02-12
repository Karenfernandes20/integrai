import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';
import { triggerWorkflow } from './workflowController';
import { processChatbotMessage } from '../services/chatbotService';
import { ensureQueueSchema, getOrCreateQueueId } from './queueController';
import { normalizePhone, extractPhoneFromJid, isGroupJid } from '../utils/phoneUtils';
import { downloadMediaFromEvolution } from '../services/mediaService';
import { getEvolutionConfig } from './evolutionController';

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

export const debugWebhookPayloads = (req: Request, res: Response) => {
    res.json(lastPayloads);
};


// ... imports
import { handleCallWebhook } from './callController';

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
        // reaction: { text: "❤️", key: { remoteJid, fromMe, id } } -> The 'key' inside 'reaction' is the TARGET message.
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
    // 1. Respond immediately to avoid Evolution API blocking or timeouts
    res.status(200).json({ status: 'received' });

    // 2. Process in dynamic data retrieval and DB logic in the background
    (async () => {
        try {
            const body = req.body;
            console.log('🔔 [WEBHOOK] RECEBIDO EM:', new Date().toLocaleString('pt-BR'));
            console.log('🔔 [WEBHOOK] Tipo:', body?.type || body?.event);
            console.log('🔔 [WEBHOOK] Instância:', body?.instance || body?.instanceName);
            if (!body) return;

            // ... logging logic ...

            // Extract raw metadata for logging (Re-extraction for scope safety)
            let type = body.type || body.event;
            let data = body.data;
            let instance = body.instance || body.data?.instance || body.instanceName || 'integrai';

            // Handle wrapped payloads (some proxy or version of Evolution might wrap in array)
            if (Array.isArray(body) && body.length > 0) {
                console.log('[Webhook] Detected array payload');
                type = body[0].type || body[0].event;
                data = body[0].data;
                instance = body[0].instance || body[0].data?.instance || body[0].instanceName || instance;
            }

            const normalizedType = type ? type.toString().toUpperCase() : '';

            // REACTION EVENT HANDLING
            if (['MESSAGES_REACTION', 'MESSAGE_REACTION', 'REACTION'].includes(normalizedType)) {
                await handleReactionWebhook(body, instance, req.app.get('io'));
                return;
            }

            // CALL EVENT HANDLING
            if (type === 'CALL' || type === 'call') {
                const callInstance = instance || 'integrai';
                await handleCallWebhook(body, callInstance, req.app.get('io'));
                return;
            }

            // CONNECTION UPDATE HANDLING
            // Evolution V2: event="CONNECTION_UPDATE", data={ state: "open"|"close"|"connecting", statusReason: number }
            if (normalizedType === 'CONNECTION_UPDATE' || normalizedType === 'INSTANCE_UPDATE') {
                const stateData = data || body;
                const state = stateData.state || stateData.status;
                const rawNumber = stateData.number;
                const cleanNumber = rawNumber ? rawNumber.split(':')[0] : null;

                const dbStatus = state === 'open' ? 'connected' : (state === 'close' ? 'disconnected' : (state || 'disconnected'));

                if (instance && pool) {
                    // Update DB
                    await pool.query(
                        'UPDATE company_instances SET status = $1, phone = COALESCE($2, phone) WHERE instance_key = $3',
                        [dbStatus, cleanNumber, instance]
                    );

                    console.log(`[Webhook] Instance ${instance} connection status updated to ${dbStatus} (${state})`);

                    // Emit Socket Event
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('instance:status', {
                            instanceKey: instance,
                            status: dbStatus,
                            state: state
                        });
                        console.log(`[Webhook] Emitted instance:status for ${instance}`);
                    }
                }
                return;
            }

            console.log(`[Webhook] Event: ${type} | Instance: ${instance}`);
            pushPayload({ type, instance, keys: Object.keys(body), body: body });

            // ... rest of the function ...

            // Accept various message event patterns (be exhaustive)
            const isMessageEvent = [
                'MESSAGES_UPSERT', 'MESSAGES.UPSERT',
                'MESSAGE_UPSERT', 'MESSAGE.UPSERT',
                'MESSAGES_UPDATE', 'MESSAGES.UPDATE',
                'MESSAGE_UPDATE', 'MESSAGE.UPDATE',
                'MESSAGES_SET', 'MESSAGES.SET',
                'MESSAGE_SET', 'MESSAGE.SET',
                'MESSAGES_RECEIVE', 'MESSAGE_RECEIVE',
                'MESSAGES.RECEIVE', 'MESSAGE.RECEIVE',
                'SEND_MESSAGE', 'SEND.MESSAGE'
            ].includes(normalizedType);

            if (!isMessageEvent) {
                // Silently ignore other events but log them for trace
                const ignitionEvents = ['CONNECTION_UPDATE', 'PRESENCE_UPDATE', 'TYPEING_START', 'CHATS_UPSERT', 'CHATS_UPDATE'];
                if (!ignitionEvents.includes(normalizedType)) {
                    console.log(`[Webhook] Ignoring non-message event: ${normalizedType}`);
                }
                return;
            }

            // OPTIMISTIC STATUS UPDATE: If we are receiving or sending messages, the instance is CONNECTED.
            if (instance && pool) {
                pool.query(
                    'UPDATE company_instances SET status = $1 WHERE (instance_key = $2 OR name = $2) AND status != $1',
                    ['connected', instance]
                ).catch(e => console.error('[Webhook] Error auto-updating instance status:', e));
            }

            // Extract message object robustly
            let messages = data?.messages || body.messages || data || body.message;
            if (Array.isArray(messages)) {
                if (messages.length === 0) {
                    console.log('[Webhook] Empty messages array');
                    return;
                }
                console.log(`[Webhook] Processing array of ${messages.length} messages`);
                messages = messages[0];
            }

            const msg: any = messages;
            if (!msg) {
                console.warn('[Webhook] No message data found');
                return;
            }

            // Debug logging for UPDATE events to see structure
            if (normalizedType.includes('UPDATE')) {
                console.log('[Webhook DEBUG] messages.update event structure:', JSON.stringify(msg, null, 2));
            }

            // -------------------------------------------------------------------------
            // 🛑 CRITICAL FIX: RemoteJid & Group Handling (User Prompt Step 1)
            // -------------------------------------------------------------------------
            const rawRemoteJid = msg.key?.remoteJid || msg.remoteJid || msg.jid;

            // Validate JID presence
            if (!rawRemoteJid || !rawRemoteJid.includes('@')) {
                console.warn(`[Webhook] Invalid rawRemoteJid: "${rawRemoteJid}". Ignoring.`);
                return;
            }

            // Determine if it is a Group (hard rule)
            // Treat as group if JID is group OR payload explicitly marks it as group.
            const payloadIsGroup = msg?.isGroup === true || msg?.is_group === true || msg?.chat?.isGroup === true || msg?.key?.isGroup === true;
            const isGroup = rawRemoteJid.endsWith('@g.us') || payloadIsGroup;

            // Standardize remoteJid
            // If Group: USE IT AS IS (Do not normalize/extract phone yet)
            // If Individual: Normalize
            let remoteJid = rawRemoteJid;
            // Additional safety: ensure we are using the Group ID from key.remoteJid, NOT participant
            if (isGroup && msg.key?.participant) {
                // Double check: message.key.remoteJid IS the group.
                // We rely on rawRemoteJid being correct.
            }

            // Normalize JID for DB (external_id)
            // Groups: KEEP AS IS (e.g. 123456@g.us)
            // Individuals: Extract phone and append @s.whatsapp.net (e.g. 55119999999@s.whatsapp.net)
            let normalizedJid = remoteJid;
            if (!isGroup) {
                const phonePart = extractPhoneFromJid(remoteJid);
                normalizedJid = phonePart + '@s.whatsapp.net';
            } else {
                // Ensure group JID consistency
                // remove any weird prefixes/suffixes if necessary, but usually raw is fine for groups
                if (!normalizedJid.endsWith('@g.us')) normalizedJid += '@g.us';
            }

            // STRICT VALIDATION
            if (rawRemoteJid === 'status@broadcast') return;

            // -------------------------------------------------------------------------
            // MODIFIED logic for robust isFromMe detection
            let isFromMe = false;
            let fromMeSource = "default(false)";

            // 1. Explicit fromMe flags are highest priority
            if (msg.key?.fromMe !== undefined) {
                isFromMe = msg.key.fromMe === true || msg.key.fromMe === 'true';
                fromMeSource = `key.fromMe:${isFromMe}`;
            } else if (msg.fromMe !== undefined) {
                isFromMe = msg.fromMe === true || msg.fromMe === 'true';
                fromMeSource = `fromMe:${isFromMe}`;
            }
            // 2. Event type is very strong indicator for API-sent messages
            else if (normalizedType === 'SEND_MESSAGE' || normalizedType === 'MESSAGE_SEND') {
                isFromMe = true;
                fromMeSource = `event:${normalizedType}`;
            }
            // 3. System/API source indicators
            else if (msg.messageSource === 'api' || msg.messageSource === 'system' || msg.data?.messageSource === 'api' || msg.data?.messageSource === 'system') {
                isFromMe = true;
                fromMeSource = "messageSource:api/system";
            }
            // 4. ID-based Heuristics (BAE5, 3EB0, 3A, BAE are common sent prefixes)
            else {
                const idPrefix = (msg.key?.id || msg.id || "").substring(0, 4);
                if (/^(BAE5|3EB0|3A|BAE)/.test(idPrefix)) {
                    isFromMe = true;
                    fromMeSource = `prefix:${idPrefix}`;
                } else if (msg.status === 'sent') {
                    isFromMe = true;
                    fromMeSource = "status:sent";
                }
            }

            // FINAL OVERRIDE
            if (msg.key?.fromMe === false || msg.fromMe === false || msg.key?.fromMe === 'false' || msg.fromMe === 'false') {
                isFromMe = false;
                fromMeSource = "explicit:false_override";
            }

            if (remoteJid === 'status@broadcast') return;
            if (!pool) return;

            // Resolve Company and Instance ID
            let meta = instanceMetaCache.get(instance);
            if (!meta) {
                // 1. Check Multi-Instance Table (Preferred) - Check both Key and Name
                const instanceLookup = await pool.query(
                    'SELECT id, company_id, name FROM company_instances WHERE LOWER(instance_key) = LOWER($1) OR LOWER(name) = LOWER($1)',
                    [instance]
                );
                if (instanceLookup.rows.length > 0) {
                    const row = instanceLookup.rows[0];
                    meta = {
                        companyId: row.company_id,
                        instanceId: row.id,
                        instanceName: row.name || instance
                    };
                }

                // 2. Fallback to Legacy Single Instance Column
                if (!meta) {
                    const compLookup = await pool.query('SELECT id, name FROM companies WHERE LOWER(evolution_instance) = LOWER($1)', [instance]);
                    if (compLookup.rows.length > 0) {
                        meta = {
                            companyId: compLookup.rows[0].id,
                            instanceId: 0, // No specific instance_id record
                            instanceName: instance
                        };
                    }
                }

                if (meta) {
                    instanceMetaCache.set(instance, meta);
                }
            }

            if (!meta) {
                const allCompanies = await pool.query('SELECT id FROM companies');
                if (allCompanies.rows.length === 1) {
                    meta = {
                        companyId: allCompanies.rows[0].id,
                        instanceId: 0,
                        instanceName: instance
                    };
                    instanceMetaCache.set(instance, meta);
                } else {
                    return;
                }
            }

            const companyId = meta.companyId;
            const instanceId = meta.instanceId > 0 ? meta.instanceId : null;
            const instanceDisplayName = meta.instanceName;
            await ensureQueueSchema();
            const defaultQueueId = await getOrCreateQueueId(companyId, 'Recepcao');

            const direction = isFromMe ? 'outbound' : 'inbound';
            let messageSource: string | null = null;
            if (direction === 'outbound') {
                // ... outbound source detection ...
                let rawSource = msg.source;
                if (!rawSource && normalizedType.includes('UPSERT')) rawSource = 'whatsapp_mobile';
                if (!rawSource && normalizedType.includes('SEND')) rawSource = 'api';
                if (!rawSource) rawSource = 'unknown';

                if (['ios', 'android', 'web', 'whatsapp_mobile'].includes(rawSource)) {
                    messageSource = 'whatsapp_mobile';
                } else {
                    messageSource = 'evolution_api';
                }
            }

            const phone = extractPhoneFromJid(remoteJid);
            // For groups, keep a group identifier in phone as well to avoid accidental private matching in old clients.
            const normalizedPhone = isGroup ? normalizedJid : normalizePhone(phone);
            const name = msg.pushName || msg.pushname || phone;
            const groupNameFromPayload =
                msg.groupName ||
                msg.group_name ||
                msg.chatName ||
                msg.subject ||
                msg.chat?.subject ||
                msg.chat?.name ||
                msg.groupMetadata?.subject ||
                null;
            // isGroup already defined

            // Correct Sender JID Logic
            const senderJidRaw = msg.key?.participant || msg.participant || (isGroup ? null : remoteJid);
            let senderJid: string | null = null;
            if (senderJidRaw) {
                const senderPhone = extractPhoneFromJid(senderJidRaw);
                senderJid = senderPhone + (senderJidRaw.includes('@g.us') ? '@g.us' : '@s.whatsapp.net');
            } else {
                senderJid = normalizedJid;
            }
            let senderName = msg.pushName || msg.pushname || (senderJid ? senderJid.split('@')[0] : null);
            // Group messages should display participant name above the bubble.
            if (isGroup && senderJid) {
                try {
                    const senderContact = await pool.query(
                        'SELECT name, push_name FROM whatsapp_contacts WHERE jid = $1 AND company_id = $2 LIMIT 1',
                        [senderJid, companyId]
                    );
                    if (senderContact.rows.length > 0) {
                        senderName = senderContact.rows[0].name || senderContact.rows[0].push_name || senderName;
                    }
                } catch (e) {
                    console.warn('[Webhook] Failed to resolve sender name from contacts:', e);
                }
            }

            let groupName = null;
            if (isGroup) {
                // Never use pushName (participant name) as the group title.
                groupName = groupNameFromPayload || `Grupo ${phone.substring(0, 8)}...`;
                console.log(`[Webhook] Detected GROUP message for JID: ${normalizedJid}`);
            }

            // Upsert Contact to prevent loose contacts and handle name updates
            if (!isGroup && companyId) {
                try {
                    await pool.query(`
                        INSERT INTO whatsapp_contacts (jid, phone, name, push_name, instance, updated_at, company_id)
                        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
                        ON CONFLICT (jid, company_id) 
                        DO UPDATE SET 
                            name = COALESCE(NULLIF(EXCLUDED.name, EXCLUDED.phone), whatsapp_contacts.name),
                            push_name = COALESCE(EXCLUDED.push_name, whatsapp_contacts.push_name),
                            phone = EXCLUDED.phone,
                            instance = EXCLUDED.instance,
                            updated_at = NOW()
                    `, [normalizedJid, normalizedPhone, name, msg.pushName || null, instance, companyId]);
                } catch (err) {
                    console.error('[Webhook] Error upserting contact:', err);
                }
            }

            // --- UNIFIED CONVERSATION LINKING LOGIC ---
            let conversationId: number;
            let currentStatus: string = 'PENDING';

            // STRICT GROUP HANDLING: Look up by external_id AND instance.
            // This aligns with UNIQUE(external_id, instance, company_id).
            let checkQuery = `
                SELECT id, status, is_group, contact_name, group_name, profile_pic_url, external_id, instance 
                FROM whatsapp_conversations 
                WHERE company_id = $2 AND instance = $3 AND (external_id = $1`;

            const queryParams = [normalizedJid, companyId, instance];

            if (!isGroup) {
                // Legacy support for individual chats via phone
                checkQuery += ` OR (phone = $4 AND is_group = false))`;
                queryParams.push(normalizedPhone);
            } else {
                checkQuery += `)`;
                // queryParams.push(null); // Not needed if we don't bind $4
            }

            // Execute query
            let checkConv = await pool.query(checkQuery, queryParams);

            // If found, we use it. Instance matches by definition.
            if (checkConv.rows.length > 0) {
                const row = checkConv.rows[0];
                conversationId = row.id;
                currentStatus = row.status || 'PENDING';
                let newStatus = currentStatus;

                if (direction === 'inbound') {
                    // Inbound messages always reopen CLOSED chats to PENDING
                    if (currentStatus === 'CLOSED') newStatus = 'PENDING';
                }
                else if (direction === 'outbound') {
                    // Start logic for User Request: Mobile-initiated -> PENDING
                    const isMobile = messageSource === 'whatsapp_mobile';

                    if (isMobile) {
                        // If I initiate/reply on mobile, user wants it to be PENDING so they can 'open' it in system later
                        // Applies if it's currently CLOSED.
                        if (currentStatus === 'CLOSED') {
                            newStatus = 'PENDING';
                        }
                        // If it's already OPEN, we keep it OPEN (assuming agent is working on it)
                        // If it's PENDING, we keep it PENDING.
                    } else {
                        // API/System sent messages -> Auto Open
                        if (currentStatus === 'CLOSED' || currentStatus === 'PENDING') {
                            newStatus = 'OPEN';
                        }
                    }
                }

                currentStatus = newStatus;
                const shouldForceGroup = isGroup && row.is_group !== true;
                const shouldUpdateGroupName = isGroup && !!groupNameFromPayload && row.group_name !== groupNameFromPayload;
                if (newStatus !== row.status || (msg.pushName && !row.is_group && row.contact_name !== msg.pushName) || shouldForceGroup || shouldUpdateGroupName) {
                    pool.query(
                        `UPDATE whatsapp_conversations
                         SET status = $1,
                             contact_name = COALESCE($2, contact_name),
                             is_group = CASE WHEN $4 THEN true ELSE is_group END,
                             group_name = CASE 
                                 WHEN $5 IS NOT NULL THEN $5
                                 WHEN $4 THEN COALESCE(group_name, contact_name, $2, external_id)
                                 ELSE group_name
                             END
                         WHERE id = $3`,
                        [
                            newStatus,
                            (msg.pushName && !row.is_group) ? msg.pushName : (isGroup && groupNameFromPayload ? groupNameFromPayload : null),
                            conversationId,
                            shouldForceGroup,
                            isGroup ? groupNameFromPayload : null
                        ]
                    ).catch(() => { });
                }
            } else {
                // LAST RESORT VALIDATION BEFORE CREATION
                // Prevent creating conversations for "technical" IDs (e.g. 'BAE5...', '3EB0...') that slipped through
                // A valid individual contact phone should be numeric.
                const isNumericPhone = /^\d+$/.test(phone);

                // STRICT PHONE VALIDATION
                // Reject technical IDs, session IDs, shorter than 10 or longer than 14 (valid E.164 + DDI is usually 12-13 digits)
                // Examples to reject: 231675384586385 (15 digits), 1234 (too short)
                if (!isGroup && (!isNumericPhone || phone.length < 10 || phone.length > 14)) {
                    console.warn(`[Webhook] Refusing to create conversation for invalid phone format: "${phone}" (JID: ${normalizedJid}). This looks like a technical ID.`);
                    return;
                }

                if (direction === 'outbound') {
                    // New Conversation Logic
                    // Mobile -> PENDING
                    // System -> OPEN
                    const isMobile = messageSource === 'whatsapp_mobile';
                    currentStatus = isMobile ? 'PENDING' : 'OPEN';
                } else {
                    currentStatus = 'PENDING';
                }

                const finalName = isGroup ? (groupName || `Grupo ${phone.substring(0, 8)}`) : name;

                // Final Check for Duplication before Insert (Race Condition buffer)
                // Must match UNIQUE constraint: (external_id, instance, company_id)
                const raceCheck = await pool.query(
                    'SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2 AND company_id = $3',
                    [normalizedJid, instance, companyId]
                );
                if (raceCheck.rows.length > 0) {
                    conversationId = raceCheck.rows[0].id;
                    console.log(`[Webhook] Recovered conversation ${conversationId} from race condition check.`);
                } else {
                    const newConv = await pool.query(
                        `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, company_id, is_group, group_name, last_instance_key, queue_id)
                     VALUES ($1, $2, $3, $4::text, $5, $6, $7, $8, $4::text, $9) RETURNING id`,
                        [normalizedJid, normalizedPhone, finalName, String(instance), currentStatus, companyId, isGroup, isGroup ? finalName : null, defaultQueueId]
                    );
                    conversationId = newConv.rows[0].id;
                }
            }

            // Extract Content Robustly from various WhatsApp message structures
            let content = '';
            let messageType = 'text';
            let mediaUrl: string | null = null;

            // Look for message object at multiple levels
            const m = msg.message || msg.data?.message || msg;

            // If the whole msg has a conversation field, use it
            if (typeof msg.conversation === 'string') {
                content = msg.conversation;
            } else if (!m || typeof m !== 'object') {
                // For messages.update events, we might not have the full message content
                // These are often just status updates, so we can skip them or use a placeholder
                if (normalizedType.includes('UPDATE')) {
                    console.log('[Webhook] Skipping messages.update without content (likely status update)');
                    return;
                }
                console.warn('[Webhook] No message content found in msg');
                return;
            }

            const getRealMessage = (mBody: any) => {
                if (!mBody) return {};
                if (mBody.viewOnceMessageV2?.message) return mBody.viewOnceMessageV2.message;
                if (mBody.viewOnceMessage?.message) return mBody.viewOnceMessage.message;
                if (mBody.ephemeralMessage?.message) return mBody.ephemeralMessage.message;
                return mBody;
            };

            const realM = getRealMessage(m);

            // Determine message type and extract content/mediaUrl
            if (realM.conversation) {
                content = realM.conversation;
            } else if (realM.extendedTextMessage?.text) {
                content = realM.extendedTextMessage.text;
            } else if (realM.imageMessage) {
                messageType = 'image';
                content = realM.imageMessage.caption || 'Foto';
                mediaUrl = realM.imageMessage.url || null;
            } else if (realM.videoMessage) {
                messageType = 'video';
                content = realM.videoMessage.caption || 'Vídeo';
                mediaUrl = realM.videoMessage.url || null;
            } else if (realM.audioMessage) {
                messageType = 'audio';
                content = 'Mensagem de voz';
                mediaUrl = realM.audioMessage.url || null;
            } else if (realM.documentMessage) {
                messageType = 'document';
                content = realM.documentMessage.fileName || realM.documentMessage.caption || 'Documento';
                mediaUrl = realM.documentMessage.url || null;
            } else if (realM.stickerMessage) {
                messageType = 'sticker';
                content = 'Figurinha';
                mediaUrl = realM.stickerMessage.url || null;
            } else if (realM.locationMessage) {
                messageType = 'location';
                content = 'Localização';
            } else if (realM.contactMessage) {
                messageType = 'contact';
                content = realM.contactMessage.displayName || 'Contato';
            } else if (realM.buttonsResponseMessage) {
                content = realM.buttonsResponseMessage.selectedDisplayText || realM.buttonsResponseMessage.selectedButtonId || 'Botão selecionado';
            } else if (realM.listResponseMessage) {
                content = realM.listResponseMessage.title || realM.listResponseMessage.singleSelectReply?.selectedRowId || 'Item selecionado';
            } else if (realM.templateButtonReplyMessage) {
                content = realM.templateButtonReplyMessage.selectedId || 'Botão selecionado';
            } else {
            }

            // Check for additional media sources from Evolution special fields (base64, publicUrl)
            // if we are in a media-type message and mediaUrl is still missing or internal
            const isMediaType = ['image', 'video', 'audio', 'document', 'sticker'].includes(messageType);
            if (isMediaType && (!mediaUrl || mediaUrl.startsWith('http://localhost') || !mediaUrl.startsWith('http'))) {
                const extraMedia = msg.base64 || msg.publicUrl || msg.data?.base64 || msg.data?.publicUrl;
                if (extraMedia) {
                    mediaUrl = extraMedia;
                } else if (!isFromMe) {
                    // Try to download from Evolution asynchronously
                    downloadMediaFromEvolution(instance, msg, companyId).then(localUrl => {
                        if (localUrl && pool) {
                            pool.query('UPDATE whatsapp_messages SET media_url = $1 WHERE external_id = $2', [localUrl, externalId])
                                .then(() => {
                                    const io = req.app.get('io');
                                    if (io) {
                                        io.to(`company_${companyId}`).emit('message:media_update', {
                                            external_id: externalId,
                                            media_url: localUrl
                                        });
                                    }
                                }).catch(e => console.error('[Webhook] DB update for media failed:', e));
                        }
                    }).catch(e => console.error('[Webhook] Media download error:', e));
                }
            }

            if (!content) {
                const keys = Object.keys(realM);
                if (keys.length > 0) {
                    const k = keys[0].replace('Message', '');
                    content = `[${k}]`;
                } else {
                    content = '[Mensagem]';
                }
            }

            const sent_at = new Date((msg.messageTimestamp || msg.timestamp || Date.now() / 1000) * 1000);
            // Handle both structures: msg.key.id (upsert) and msg.keyId/messageId (update)
            const externalId = msg.key?.id || msg.keyId || msg.messageId || msg.id || `gen-${Date.now()}`;

            console.log(`[Webhook] Preparing to save message: direction=${direction}, externalId=${externalId}, convId=${conversationId}, content="${content.substring(0, 30)}..."`);

            // Insert Message into database with instance tracking
            const insertedMsg = await pool.query(
                `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, message_type, media_url, user_id, sender_jid, sender_name, company_id, instance_id, instance_key, instance_name) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
                 ON CONFLICT (external_id) DO NOTHING RETURNING *`,
                [conversationId, direction, content, sent_at.toISOString(), 'received', externalId, messageType, mediaUrl, null, senderJid, senderName, companyId, instanceId, instance, instanceDisplayName]
            );

            if (insertedMsg.rows.length > 0) {
                console.log(`[Webhook] ✅ Message SAVED to DB: ID=${insertedMsg.rows[0].id}, direction=${direction}, external_id=${externalId}`);

                await logEvent({
                    eventType: direction === 'inbound' ? 'message_in' : 'message_out',
                    origin: 'webhook',
                    status: 'success',
                    message: `Mensagem ${direction === 'inbound' ? 'recebida' : 'enviada'} (${messageType})`,
                    conversationId,
                    phone,
                    details: { content: content.substring(0, 500), instance, externalId }
                });
            }

            // If duplicate message (conflict), we still want to emit conversation update
            if (insertedMsg.rows.length === 0) {
                console.log(`[Webhook] Duplicate message detected for external_id ${externalId}. Signaling conversation update.`);
                // Fetch the existing message to emit to socket
                const existingResult = await pool.query(`
                    SELECT wm.*, u.full_name as agent_name 
                    FROM whatsapp_messages wm
                    LEFT JOIN app_users u ON wm.user_id = u.id
                    WHERE wm.external_id = $1
                `, [externalId]);

                if (existingResult.rows.length > 0) {
                    const existingMsg = existingResult.rows[0];
                    console.log(`[Webhook] Found existing message: ID=${existingMsg.id}, direction=${existingMsg.direction}, content="${existingMsg.content?.substring(0, 30)}..."`);

                    const io = req.app.get('io');
                    if (io) {
                        const room = `company_${companyId}`;
                        const instanceRoom = `instance_${instance}`;
                        const payload = {
                            ...existingMsg,
                            phone: phone,
                            contact_name: (checkConv.rows.length > 0 ? checkConv.rows[0].contact_name : (isGroup ? groupName : name)) || (isGroup ? groupName : name),
                            is_group: checkConv.rows.length > 0 ? checkConv.rows[0].is_group : isGroup,
                            group_name: (checkConv.rows.length > 0 ? checkConv.rows[0].group_name : null) || groupName,
                            profile_pic_url: checkConv.rows.length > 0 ? checkConv.rows[0].profile_pic_url : null,
                            remoteJid,
                            instance,
                            instance_id: instanceId,
                            instance_name: instanceDisplayName,
                            instance_friendly_name: instanceDisplayName,
                            company_id: companyId,
                            status: currentStatus,
                            sender_jid: existingMsg.sender_jid,
                            sender_name: existingMsg.sender_name,
                            agent_name: existingMsg.agent_name || ((existingMsg.direction === 'outbound' && !existingMsg.user_id) ? (existingMsg.message_source === 'whatsapp_mobile' ? 'Celular' : 'Sistema') : null),
                            message_origin: (existingMsg.direction === 'outbound' && !existingMsg.user_id) ? (existingMsg.message_source === 'whatsapp_mobile' ? 'whatsapp_mobile' : 'evolution_api') : 'system'
                        };
                        console.log(`[Webhook] Emitting duplicate message to rooms ${room}, ${instanceRoom}, global | Direction: ${existingMsg.direction}`);
                        io.to(room).emit('message:received', payload);
                        io.to(instanceRoom).emit('message:received', payload);
                        io.to('global').emit('message:received', payload);
                    } else {
                        console.warn('[Webhook] Socket.io not available for duplicate message emission');
                    }
                } else {
                    console.warn(`[Webhook] Could not find existing message with external_id ${externalId} in database`);
                }

                // CRITICAL FIX: DO NOT RETURN HERE. CONTINUE TO POST-PROCESSING.
                // We want to ensure conversation metadata (last_message, unread_count) is consistent 
                // even if we received valid duplicate webhooks (e.g. SEND_MESSAGE + UPSERT)
            } else {
                console.log(`[Webhook] Message inserted into DB: ID=${insertedMsg.rows[0].id} | direction=${direction} | content="${content.substring(0, 30)}..."`);

                // Trigger Workflow Engine
                triggerWorkflow('message_received', {
                    message_id: insertedMsg.rows[0].id,
                    content,
                    direction,
                    company_id: companyId,
                    conversation_id: conversationId,
                    phone: phone
                }).catch(e => console.error('[Workflow Trigger Error]:', e));

                // Process Chatbot (V2 logic)
                if (direction === 'inbound') {
                    processChatbotMessage(instance, phone, content).catch(e => console.error('[Chatbot Error]:', e));
                }

                // Emit Socket (Critical Path for UI Responsiveness)
                const io = req.app.get('io');
                if (io) {
                    // Contention Rule: AI Fallback
                    if (direction === 'outbound' && !insertedMsg.rows[0].user_id) {
                        const invalidPatterns = ['error', 'falha', 'invalid', 'null', 'undefined', 'n/a'];
                        const isInvalid = !content || content.length < 2 || invalidPatterns.some(p => content.toLowerCase().includes(p));

                        if (isInvalid) {
                            console.warn(`[Webhook] AI returned invalid response: "${content}". Applying fallback.`);
                            await logEvent({
                                eventType: 'ia_error',
                                origin: 'ia',
                                status: 'warning',
                                message: `IA retornou resposta inválida: "${content}". Fallback aplicado.`,
                                conversationId,
                                details: { originalContent: content }
                            });
                            // Fallback Message
                            content = "Desculpe, tive um problema técnico ao processar sua solicitação. Um atendente humano será notificado.";
                            // Update the inserted message with fallback content
                            await pool.query('UPDATE whatsapp_messages SET content = $1 WHERE id = $2', [content, insertedMsg.rows[0].id]);
                            insertedMsg.rows[0].content = content;
                        }
                    }

                    const room = `company_${companyId}`;
                    const instanceRoom = `instance_${instance}`;
                    const payload = {
                        ...insertedMsg.rows[0],
                        phone,
                        contact_name: (checkConv.rows.length > 0 ? checkConv.rows[0].contact_name : (isGroup ? groupName : name)) || (isGroup ? groupName : name),
                        is_group: checkConv.rows.length > 0 ? checkConv.rows[0].is_group : isGroup,
                        group_name: (checkConv.rows.length > 0 ? checkConv.rows[0].group_name : null) || groupName,
                        profile_pic_url: checkConv.rows.length > 0 ? checkConv.rows[0].profile_pic_url : null,
                        remoteJid,
                        instance,
                        instance_id: instanceId,
                        instance_name: instanceDisplayName,
                        instance_friendly_name: instanceDisplayName,
                        company_id: companyId,
                        status: currentStatus,
                        sender_jid: insertedMsg.rows[0].sender_jid,
                        sender_name: insertedMsg.rows[0].sender_name,
                        message_source: messageSource,
                        agent_name: (direction === 'outbound' && !insertedMsg.rows[0].user_id) ? (messageSource === 'whatsapp_mobile' ? 'WhatsApp' : (msg.agent_name || 'Sistema')) : null,
                        message_origin: (direction === 'outbound' && !insertedMsg.rows[0].user_id) ? (messageSource === 'whatsapp_mobile' ? 'whatsapp_mobile' : 'evolution_api') : 'system'
                    };
                    console.log(`[Webhook] Emitting message to rooms ${room}, ${instanceRoom}, global | Direction: ${insertedMsg.rows[0].direction}`);
                    io.to(room).emit('message:received', payload);
                    io.to(instanceRoom).emit('message:received', payload);
                    io.to('global').emit('message:received', payload);
                }
            }

            // 6. Non-critical post-processing (Metadata & CRM & Profile Pic)
            (async () => {
                console.log(`[Webhook] Starting non-critical post-processing for conversation ${conversationId}.`);
                // Update Conversation Metadata (Last message preview)
                await pool!.query(
                    `UPDATE whatsapp_conversations 
                     SET last_message_at = $1, last_message = $2, 
                         unread_count = CASE WHEN $3 = 'inbound' THEN unread_count + 1 ELSE unread_count END,
                         last_instance_key = $4
                     WHERE id = $5`,
                    [sent_at.toISOString(), content, direction, instance, conversationId]
                );
                // ... (rest of the block logic continues as is, no change needed in text replacement if I target carefully)

                console.log(`[Webhook] Conversation ${conversationId} metadata updated.`);

                const isGroup = isGroupJid(remoteJid);

                // Profile Pic & Name Fetch Logic (if missing or placeholder)
                const row = checkConv.rows[0] || {};
                const hasPic = row.profile_pic_url;
                const isPlaceholderName = isGroup && (
                    !row.contact_name ||
                    row.contact_name.startsWith('Grupo ') ||
                    row.contact_name === remoteJid ||
                    row.contact_name === phone ||
                    row.group_name?.startsWith('Grupo ')
                );

                if (!hasPic || isPlaceholderName) {
                    console.log(`[Webhook] Fetching profile pic or group name for ${remoteJid}.`);
                    (async () => {
                        try {
                            const cfgRes = await pool!.query(
                                `SELECT
                                    COALESCE(ci.api_key, c.evolution_apikey) as api_key,
                                    COALESCE(c.evolution_url, $3::text) as evolution_url
                                 FROM companies c
                                 LEFT JOIN company_instances ci
                                   ON ci.company_id = c.id
                                  AND (LOWER(ci.instance_key) = LOWER($2) OR LOWER(ci.name) = LOWER($2))
                                 WHERE c.id = $1
                                 ORDER BY CASE WHEN ci.api_key IS NOT NULL AND ci.api_key <> '' THEN 0 ELSE 1 END
                                 LIMIT 1`,
                                [companyId, instance, process.env.EVOLUTION_API_URL || "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host"]
                            );
                            const apikey = cfgRes.rows[0]?.api_key;
                            const baseUrl = String(cfgRes.rows[0]?.evolution_url || process.env.EVOLUTION_API_URL || "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host");
                            if (apikey) {

                                // 1. Fetch Name if Group and placeholder
                                if (isPlaceholderName) {
                                    console.log(`[Webhook] Attempting to fetch real group name for ${remoteJid}.`);
                                    const groupUrl = `${baseUrl.replace(/\/$/, "")}/group/findGroup/${instance}?groupJid=${remoteJid}`;
                                    const gRes = await fetch(groupUrl, {
                                        method: "GET",
                                        headers: { "Content-Type": "application/json", "apikey": apikey }
                                    });
                                    if (gRes.ok) {
                                        const gData = await gRes.json();
                                        const realGroupName = gData.subject || gData.name;
                                        if (realGroupName) {
                                            await pool!.query('UPDATE whatsapp_conversations SET contact_name = $1, group_name = $1 WHERE id = $2', [realGroupName, conversationId]);
                                            console.log(`[Webhook] Updated group name for ${remoteJid} to ${realGroupName}.`);
                                        }
                                        // Bonus: try to get pic from this same call
                                        const pic = gData.profilePictureUrl || gData.pic || gData.picture;
                                        if (pic && !hasPic) {
                                            await pool!.query('UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE id = $2', [pic, conversationId]);
                                            console.log(`[Webhook] Pre-emptively updated group pic from group metadata for ${remoteJid}.`);
                                        }
                                    } else {
                                        console.warn(`[Webhook] Failed to fetch group name for ${remoteJid}. Status: ${gRes.status}`);
                                    }
                                }

                                // 2. Fetch Picture
                                if (!hasPic) {
                                    console.log(`[Webhook] Attempting to fetch profile picture for ${remoteJid}.`);
                                    const picUrl_endpoint = `${baseUrl.replace(/\/$/, "")}/chat/fetchProfilePictureUrl/${instance}`;
                                    const response = await fetch(picUrl_endpoint, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "apikey": apikey },
                                        body: JSON.stringify({ number: remoteJid })
                                    });

                                    if (response.ok) {
                                        const data = await response.json();
                                        const picUrl = data.profilePictureUrl || data.url;
                                        if (picUrl) {
                                            await pool!.query('UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE id = $2', [picUrl, conversationId]);
                                            if (!isGroup) {
                                                await pool!.query('UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE (jid = $2 OR jid = $3) AND company_id = $4', [picUrl, remoteJid, normalizedJid, companyId]);
                                            }
                                            console.log(`[Webhook] Updated profile picture for ${remoteJid}.`);
                                        }
                                    } else {
                                        console.warn(`[Webhook] Failed to fetch profile picture for ${remoteJid}. Status: ${response.status}`);
                                    }
                                }
                            } else {
                                console.log(`[Webhook] No API key found for company ${companyId} to fetch profile pic/group name.`);
                            }
                        } catch (e) {
                            console.error(`[Webhook] Error fetching profile pic/group name for ${remoteJid}:`, e);
                        }
                    })();
                }

                // CRM Logic: Auto-create lead for new contacts (Only for individual chats)
                if (direction === 'inbound' && currentStatus === 'PENDING' && !isGroup) {
                    console.log(`[Webhook] Processing CRM logic for PENDING inbound message from ${phone}.`);

                    // Find company-specific LEADS stage
                    const stageRes = await pool!.query(
                        `SELECT id FROM crm_stages WHERE name = 'LEADS' AND company_id = $1 LIMIT 1`,
                        [companyId]
                    );

                    if (stageRes.rows.length === 0) {
                        console.warn(`[Webhook] LEADS stage not found for company ${companyId}. Skipping auto-lead creation.`);
                    } else {
                        const leadsStageId = stageRes.rows[0].id;

                        const cleanPhone = phone.replace(/\D/g, '');
                        // Search for lead with variations (with and without 55, or just matching the last 10-11 digits)
                        const [contactCheck, checkLead] = await Promise.all([
                            // Check if contact is saved with a real name (not just the phone)
                            pool!.query(`SELECT id FROM whatsapp_contacts WHERE jid = $1 AND company_id = $2 AND name IS NOT NULL AND name != '' AND name != $3 LIMIT 1`, [remoteJid, companyId, phone]),
                            pool!.query(`
                                SELECT id, name, stage_id FROM crm_leads 
                                WHERE (phone = $1 OR phone = $2 OR phone LIKE '%' || $2) 
                                AND company_id = $3 
                                LIMIT 1
                            `, [phone, cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone, companyId])
                        ]);

                        if (checkLead.rows.length === 0 && contactCheck.rows.length === 0) {
                            console.log(`[Webhook] Creating auto-lead for unregistered contact ${phone} in LEADS stage.`);

                            // Try to get the name from whatsapp_contacts even if it was just the phone (maybe it's updated now)
                            const savedContact = await pool!.query(
                                "SELECT name FROM whatsapp_contacts WHERE jid = $1 AND company_id = $2 LIMIT 1",
                                [remoteJid, companyId]
                            );
                            const bestName = (savedContact.rows[0]?.name && savedContact.rows[0].name !== phone)
                                ? savedContact.rows[0].name
                                : name;

                            await pool!.query(
                                `INSERT INTO crm_leads (name, phone, origin, stage_id, company_id, instance, created_at, updated_at, description) 
                                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'Lead automático (Nova mensagem)')`,
                                [bestName || name || phone, phone, 'WhatsApp', leadsStageId, companyId, instance]
                            );
                        } else if (checkLead.rows.length > 0) {
                            const lead = checkLead.rows[0];
                            // If lead name is just the phone, and we have a better name now, update it
                            if (lead.name === phone && name && name !== phone) {
                                await pool!.query('UPDATE crm_leads SET name = $1, updated_at = NOW() WHERE id = $2', [name, lead.id]);
                            } else {
                                await pool!.query('UPDATE crm_leads SET updated_at = NOW() WHERE id = $1', [lead.id]);
                            }
                        }
                    }
                }
            })().catch(async e => {
                console.error('[Webhook Post-processing Error]:', e);
                await logEvent({
                    eventType: 'webhook_error',
                    origin: 'webhook',
                    status: 'warning',
                    message: `Falha no pós-processamento do Webhook (não-crítico): ${e.message}`,
                    details: { error: e.stack, conversationId }
                });
            });

        } catch (err: any) {
            console.error('[Webhook Main Error]:', err);
            // Structural errors or unrecognized payloads shouldn't necessarily be "Critical Failures"
            // We use 'warning' to avoid spamming the Superadmin alert panel if it's a transient or structural mismatch
            await logEvent({
                eventType: 'webhook_error',
                origin: 'webhook',
                status: 'warning',
                message: `Webhook: Falha estrutural no processamento (não-interrompível): ${err.message}`,
                details: { error: err.stack, body: req.body }
            });
        }
    })();
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureQueueSchema();

        const user = (req as any).user;
        let companyId = req.query.companyId || user?.company_id;

        // --- OPTIMISTIC REPAIR FOR NULL COMPANY_IDS (DISABLED FOR MOCK MODE) ---
        // if (user.role === 'SUPERADMIN') {
        //     try {
        //         await pool.query(`...`);
        //     } catch (e) { console.error('[Repair Mapping Error]:', e); }
        // }

        let query = `
            SELECT c.*, 
            (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us') as computed_is_group,
            (SELECT content FROM whatsapp_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message,
            (SELECT sender_name FROM whatsapp_messages WHERE conversation_id = c.id AND sender_name IS NOT NULL LIMIT 1) as last_sender_name,
            CASE
              WHEN (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                THEN COALESCE(c.profile_pic_url, co.profile_pic_url)
              ELSE COALESCE(co.profile_pic_url, c.profile_pic_url)
            END as profile_pic_url,
            CASE
              WHEN co.name IS NULL OR btrim(co.name) = '' THEN NULL
              WHEN co.name ~* 'https?://'
                OR length(co.name) > 60
                OR co.name ~ E'[\\r\\n]'
                OR co.name ~ '^\\[[^\\]]+\\]$'
              THEN NULL
              ELSE co.name
            END as contact_saved_name,
            co.push_name as contact_push_name,
            comp.name as company_name,
            COALESCE(ci.name, c.last_instance_key, c.instance) as instance_friendly_name,
            q.name as queue_name,
            CASE WHEN c.status = 'OPEN' THEN au.full_name ELSE NULL END as assigned_user_name,
            COALESCE((
                SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
                FROM conversations_tags ct
                JOIN crm_tags t ON ct.tag_id = t.id
                WHERE ct.conversation_id = c.id
            ), '[]'::json) as tags
            FROM whatsapp_conversations c
            LEFT JOIN LATERAL (
                SELECT wc.profile_pic_url, wc.push_name, wc.name
                FROM whatsapp_contacts wc
                WHERE wc.company_id = c.company_id
                  AND (
                    (
                      (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                      AND (
                        wc.jid = c.external_id
                        OR wc.jid = REPLACE(c.external_id, '@g.us', '@c.us')
                      )
                    )
                    OR
                    (
                      NOT (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                      AND (
                        wc.jid = c.external_id
                        OR wc.jid = REPLACE(c.external_id, '@s.whatsapp.net', '@c.us')
                        OR wc.phone = split_part(c.external_id, '@', 1)
                        OR (
                            REGEXP_REPLACE(COALESCE(wc.phone, ''), '\\D', '', 'g') <> ''
                            AND REGEXP_REPLACE(COALESCE(wc.phone, ''), '\\D', '', 'g') = REGEXP_REPLACE(COALESCE(c.phone, ''), '\\D', '', 'g')
                        )
                      )
                    )
                  )
                ORDER BY
                  CASE
                    WHEN wc.jid = c.external_id THEN 0
                    WHEN (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                         AND wc.jid = REPLACE(c.external_id, '@g.us', '@c.us') THEN 1
                    WHEN NOT (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                         AND wc.jid = REPLACE(c.external_id, '@s.whatsapp.net', '@c.us') THEN 1
                    WHEN NOT (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                         AND wc.phone = split_part(c.external_id, '@', 1) THEN 2
                    WHEN NOT (c.is_group = true OR c.external_id LIKE '%@g.us' OR c.phone LIKE '%@g.us')
                         AND (
                            REGEXP_REPLACE(COALESCE(wc.phone, ''), '\\D', '', 'g') <> ''
                            AND REGEXP_REPLACE(COALESCE(wc.phone, ''), '\\D', '', 'g') = REGEXP_REPLACE(COALESCE(c.phone, ''), '\\D', '', 'g')
                         ) THEN 3
                    ELSE 9
                  END,
                  CASE WHEN wc.profile_pic_url IS NOT NULL AND wc.profile_pic_url <> '' THEN 0 ELSE 1 END,
                  wc.updated_at DESC NULLS LAST,
                  wc.id DESC
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
            query += ` AND c.company_id = $1`;
            params.push(user.company_id);
        } else {
            if (companyId) {
                query += ` AND c.company_id = $1`;
                params.push(companyId);
            }
            // Superadmin without companyId now sees all companies/instances
        }

        // Lenient filter for valid conversations
        query += ` AND (
            c.is_group = true 
            OR c.phone IS NULL
            OR (c.phone ~ '^[0-9+]+$' AND LENGTH(REGEXP_REPLACE(c.phone, '\\D', '', 'g')) BETWEEN 8 AND 15)
            OR c.external_id IS NOT NULL
        )`;

        // Optional: Only show conversations with messages (but let's be safe and allow all for now)
        // query += ` AND EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.conversation_id = c.id)`;

        query += ` ORDER BY c.last_message_at DESC NULLS LAST`;

        let result;
        try {
            result = await pool.query(query, params);
        } catch (dbError: any) {
            console.error('[getConversations] DB Failed, returning MOCK DATA for testing:', dbError.message);
            // MOCK DATA RETURN
            const mockConvs = [
                {
                    id: 9991,
                    external_id: '5511999999999@s.whatsapp.net',
                    phone: '5511999999999',
                    contact_name: 'Karen Fernandes (Mock)', // Saved Name
                    contact_push_name: 'Karen Whatsapp',
                    last_message: 'Teste de Mock Data',
                    last_message_at: new Date().toISOString(),
                    unread_count: 2,
                    profile_pic_url: null,
                    status: 'OPEN',
                    is_group: false,
                    company_id: 1,
                    instance: 'integrai',
                    user_id: 1
                },
                {
                    id: 9992,
                    external_id: '12036302392@g.us',
                    phone: '12036302392@g.us', // Group JID often stored in phone col for groups
                    contact_name: 'Grupo Teste',
                    last_message: 'Mensagem no grupo',
                    last_message_at: new Date(Date.now() - 3600000).toISOString(),
                    unread_count: 0,
                    status: 'PENDING',
                    is_group: true,
                    group_name: 'Grupo de Teste Mock',
                    company_id: 1,
                    instance: 'integrai',
                    user_id: null
                }
            ];
            return res.json(mockConvs);
        }
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
                    (isUsableGroupName(row.group_name) ? row.group_name : null) ||
                    'Grupo'
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
        console.error('Error fetching conversations:', error);
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
                    return res.status(403).json({ error: 'Você não tem permissão para acessar estas mensagens.' });
                }
            }

            const result = await pool.query(
                `SELECT m.*, 
                        u.full_name as user_name,
                        wc.name as saved_name,
                        COALESCE(m.sender_name, wc.name, split_part(m.sender_jid, '@', 1)) as sender_name,
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
                        COALESCE(ci.name, m.instance_name, m.instance_key) as instance_friendly_name
                FROM whatsapp_messages m 
                LEFT JOIN app_users u ON m.user_id = u.id 
                LEFT JOIN whatsapp_contacts wc ON (
                    (m.sender_jid IS NOT NULL AND wc.jid = m.sender_jid AND wc.company_id = $2)
                    OR 
                    (m.sender_jid IS NULL AND m.direction = 'inbound' AND wc.jid = (SELECT external_id FROM whatsapp_conversations WHERE id = m.conversation_id LIMIT 1) AND wc.company_id = $2)
                )
                LEFT JOIN company_instances ci ON m.instance_id = ci.id
                WHERE m.conversation_id = $1 
                ORDER BY m.sent_at ASC`,
                [conversationId, msgCompanyId]
            );

            console.log(`[getMessages] Success. Found ${result.rows.length} messages. Resetting unread count.`);

            // Reset unread count in background
            pool.query('UPDATE whatsapp_conversations SET unread_count = 0 WHERE id = $1', [conversationId])
                .catch(e => console.error('[getMessages] Failed to reset unread count:', e));

            res.json(result.rows);

        } catch (dbErr: any) {
            console.error('[getMessages] DB Operation Failed (likely connection). Returning MOCK MESSAGES for testing.', dbErr.message);

            // MOCK MESSAGES FOR TESTING LABELS
            const mockMessages = [
                {
                    id: 101,
                    content: 'Oi Karen! Mensagem de cliente entrando...',
                    direction: 'inbound',
                    saved_name: 'Karen Fernandes (Mock)', // Testing Input Label
                    status: 'received',
                    sent_at: new Date(Date.now() - 10000000).toISOString()
                },
                {
                    id: 102,
                    content: 'Olá! Esta é uma mensagem de Campanha Automática.',
                    direction: 'outbound',
                    message_origin: 'campaign', // Testing Campaign Label
                    status: 'read',
                    sent_at: new Date(Date.now() - 9000000).toISOString()
                },
                {
                    id: 103,
                    content: 'Tudo bem? Este é um Follow-Up.',
                    direction: 'outbound',
                    message_origin: 'follow_up', // Testing Follow-Up Label
                    status: 'sent',
                    sent_at: new Date(Date.now() - 8000000).toISOString()
                },
                {
                    id: 104,
                    content: 'Respondendo via Celular (app) ou IA (sem usuário).',
                    direction: 'outbound',
                    message_origin: 'whatsapp_mobile', // Testing Celular Label
                    status: 'sent',
                    user_id: null,
                    sent_at: new Date(Date.now() - 7000000).toISOString()
                },
                {
                    id: 105,
                    content: 'Mensagem enviada pelo Atendente Manual.',
                    direction: 'outbound',
                    message_origin: 'system_user',
                    user_name: 'Atendente Mock', // Testing User Name
                    user_id: 1,
                    status: 'read',
                    sent_at: new Date(Date.now() - 6000000).toISOString()
                }
            ];
            return res.json(mockMessages);
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
        const token = req.query['hub.token'];
        const challenge = req.query['hub.challenge'];

        // We can use a global verify token or check against companies?
        // Simpler: Use a fixed token for the platform, or allow companies to set it?
        // User instructions said "Webhook URL (read only)". Usually implies platform handles it.
        // Let's us "integrai_instagram_verify_token" or check env.
        const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || 'integrai_verify_token';

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('[Instagram Webhook] Verified successfully.');
                res.status(200).send(challenge);
            } else {
                console.warn(`[Instagram Webhook] Verification failed. Token: ${token}, Mode: ${mode}`);
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(400);
        }
    } catch (e) {
        console.error('[Instagram Verify Error]', e);
        res.sendStatus(500);
    }
};

export const handleInstagramWebhook = async (req: Request, res: Response) => {
    try {
        const body = req.body;
        console.log('[Instagram Webhook] Received event:', JSON.stringify(body, null, 2));

        // 1. Acknowledge immediately
        res.status(200).send('EVENT_RECEIVED');

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

                            console.log(`[Instagram Webhook] Msg from ${senderId}: ${text}`);

                            // Get User Profile (optional, async)
                            let username = 'Instagram User';
                            let profilePic = null;
                            try {
                                const url = `https://graph.facebook.com/v18.0/${senderId}?fields=name,username,profile_pic&access_token=${company.instagram_access_token}`;
                                const profileRes = await fetch(url);
                                if (profileRes.ok) {
                                    const profile = await profileRes.json();
                                    username = profile.username || profile.name || username;
                                    profilePic = profile.profile_pic;
                                }
                            } catch (e) { /* ignore profile fetch error */ }

                            // Create/Update Conversation
                            // We use 'instagram:' + senderId as external_id? Or just senderId?
                            // To avoid collision with phone numbers, prefixed is safer, but whatsapp uses raw numbers.
                            // Let's use senderId as external_id and channel='instagram'

                            // Check existing conversation
                            const convRes = await pool!.query(`
                                SELECT id, status FROM whatsapp_conversations 
                                WHERE external_id = $1 AND company_id = $2
                            `, [senderId, company.id]);

                            let conversationId;
                            if (convRes.rows.length > 0) {
                                conversationId = convRes.rows[0].id;
                                // Update status if needed (reopen logic similar to whatsapp)
                                if (convRes.rows[0].status === 'CLOSED') {
                                    await pool!.query('UPDATE whatsapp_conversations SET status = $1 WHERE id = $2', ['PENDING', conversationId]);
                                }
                            } else {
                                const defaultQueueId = await getOrCreateQueueId(company.id, 'Recepcao');
                                // Create New Conversation
                                const newConv = await pool!.query(`
                                    INSERT INTO whatsapp_conversations 
                                    (company_id, external_id, phone, contact_name, status, channel, instagram_user_id, instagram_username, profile_pic_url, queue_id)
                                    VALUES ($1, $2, $3, $4, 'PENDING', 'instagram', $5, $6, $7, $8)
                                    RETURNING id
                                `, [company.id, senderId, '0000000000', username, senderId, username, profilePic, defaultQueueId]);
                                conversationId = newConv.rows[0].id;
                            }

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
                                    content = 'Vídeo';
                                } else if (att.type === 'audio') {
                                    msgType = 'audio';
                                    mediaUrl = att.payload.url;
                                    content = 'Áudio';
                                } else {
                                    content = `[Anexo: ${att.type}]`;
                                }
                            }

                            // Save Message
                            const insertedMsg = await pool!.query(`
                                INSERT INTO whatsapp_messages 
                                (company_id, conversation_id, direction, content, message_type, media_url, status, external_id, channel, sender_name, sent_at)
                                VALUES ($1, $2, 'inbound', $3, $4, $5, 'received', $6, 'instagram', $7, NOW())
                                RETURNING *
                            `, [company.id, conversationId, content, msgType, mediaUrl, messageId, username]);

                            // Emit Socket
                            const io = req.app.get('io');
                            if (io) {
                                const payload = {
                                    ...insertedMsg.rows[0],
                                    contact_name: username,
                                    profile_pic_url: profilePic,
                                    message_origin: 'instagram'
                                };
                                io.to(`company_${company.id}`).emit('message:received', payload);
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
