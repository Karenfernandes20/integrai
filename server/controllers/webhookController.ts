import { Request, Response } from 'express';
import { pool } from '../db/index.js';
import { logEvent } from '../logger.js';
import { triggerWorkflow } from './workflowController.js';
import { processChatbotMessage } from '../services/chatbotService.js';
import { ensureQueueSchema, getOrCreateQueueId } from './queueController.js';
import { normalizePhone, extractPhoneFromJid, isGroupJid } from '../utils/phoneUtils.js';
import { downloadMediaFromEvolution } from '../services/mediaService.js';
import { returnToPending } from './conversationController.js';
import { handleWhaticketGreeting } from '../services/whaticketService.js';
import { getEvolutionConfig } from './evolutionController.js';

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
            let instance = body.instance || body.data?.instance || body.instanceName;
            if (!instance) {
                console.warn('[Webhook] Missing instance name in payload');
                return res.status(200).send('Instance missing');
            }

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

            // Accept message and group/chat update event patterns
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

            const isGroupOrChatUpdate = [
                'GROUPS_UPDATE', 'GROUPS.UPDATE',
                'GROUP_UPDATE', 'GROUP.UPDATE',
                'CHATS_UPDATE', 'CHATS.UPDATE',
                'CHATS_UPSERT', 'CHATS.UPSERT'
            ].includes(normalizedType);

            if (!isMessageEvent && !isGroupOrChatUpdate) {
                // Silently ignore other events but log them for trace
                const ignitionEvents = ['CONNECTION_UPDATE', 'PRESENCE_UPDATE', 'TYPEING_START'];
                if (!ignitionEvents.includes(normalizedType)) {
                    console.log(`[Webhook] Ignoring non-essential event: ${normalizedType}`);
                }
                return;
            }

            // If it's a group/chat update, we handle it and return
            if (isGroupOrChatUpdate) {
                const updateData = Array.isArray(data) ? data[0] : data;
                const updateJid = updateData?.id || updateData?.remoteJid || updateData?.jid;
                const updateName = updateData?.subject || updateData?.name || updateData?.title;

                if (updateJid && updateJid.endsWith('@g.us') && updateName && pool) {
                    console.log(`[Webhook] Updating group name for ${updateJid} to ${updateName}`);
                    await pool.query(
                        'UPDATE whatsapp_conversations SET group_name = $1, contact_name = $1, is_group = true WHERE external_id = $2',
                        [updateName, updateJid]
                    );

                    // Emit socket update so frontend refreshes name
                    const io = req.app.get('io');
                    if (io) {
                        io.emit('conversation:updated', { external_id: updateJid, group_name: updateName });
                    }
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

                // Process additional batched messages as independent webhook runs.
                // Evolution can bundle multiple messages in a single webhook payload.
                // Previously we only handled messages[0], causing silent message loss.
                if (messages.length > 1) {
                    const extraMessages = messages.slice(1);
                    for (const extraMessage of extraMessages) {
                        const syntheticBody = {
                            ...body,
                            data: {
                                ...(body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}),
                                messages: [extraMessage]
                            }
                        };

                        const syntheticReq = Object.assign(
                            Object.create(Object.getPrototypeOf(req)),
                            req,
                            { body: syntheticBody }
                        ) as Request;

                        const syntheticRes: Partial<Response> = {};
                        syntheticRes.status = () => syntheticRes as Response;
                        syntheticRes.json = () => syntheticRes as Response;
                        syntheticRes.send = () => syntheticRes as Response;

                        setImmediate(() => {
                            handleWebhook(syntheticReq, syntheticRes as Response).catch((err) => {
                                console.error('[Webhook] Failed to process batched message:', err);
                            });
                        });
                    }
                }

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
                console.warn(`[Webhook] Unrecognized instance: ${instance}. No mapping found and global fallback disabled.`);
                return;
            }

            const companyId = meta.companyId;
            if (!companyId) {
                console.warn(`[Webhook] Instance ${instance} found but has NO associated company_id.`);
                return;
            }
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

                if (['web', 'whatsapp_web'].includes(rawSource)) {
                    messageSource = 'whatsapp_web';
                } else if (['ios', 'android', 'whatsapp_mobile'].includes(rawSource)) {
                    messageSource = 'whatsapp_mobile';
                } else {
                    messageSource = 'evolution_api';
                }
            }

            const phone = extractPhoneFromJid(remoteJid);
            // For groups, keep a group identifier in phone as well to avoid accidental private matching in old clients.
            const normalizedPhone = isGroup ? normalizedJid : normalizePhone(phone);

            // User Request: First time contact should show phone number. 
            // We save pushName in its own column but use phone for the 'name' initially.
            const name = normalizedPhone;

            const groupNameFromPayload =
                msg.groupName ||
                msg.group_name ||
                msg.chatName ||
                msg.subject ||
                msg.chat?.subject ||
                msg.chat?.name ||
                msg.groupMetadata?.subject ||
                msg.data?.subject ||
                msg.data?.group_name ||
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
                        "SELECT name, push_name FROM contacts WHERE external_id = $1 AND company_id = $2 AND channel = 'whatsapp' LIMIT 1",
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
                groupName = groupNameFromPayload;

                if (!groupName) {
                    console.log(`[Webhook] Group message received for ${normalizedJid} but NO SUBJECT in payload. Triggering background refresh.`);
                    // Proactively try to get metadata in background
                    const { refreshConversationMetadata } = await import('./evolutionController.js');
                    if (refreshConversationMetadata) {
                        // We don't await this as it might be slow
                        refreshConversationMetadata({ params: { conversationId: normalizedJid }, query: { companyId } } as any, { json: () => { } } as any).catch(() => { });
                    }
                }

                console.log(`[Webhook] Detected GROUP message for JID: ${normalizedJid} | Name: ${groupName || 'PENDING REFRESH'}`);
            }

            // Upsert Contact to prevent loose contacts and handle name updates
            if (!isGroup && companyId) {
                try {
                    // Update Contact without overwriting a manually set name
                    await pool.query(`
                        INSERT INTO contacts (company_id, channel, external_id, phone, name, push_name, instance, updated_at)
                        VALUES ($1, 'whatsapp', $2, $3, $4, $5, $6, NOW())
                        ON CONFLICT (company_id, channel, external_id) 
                        DO UPDATE SET 
                            name = CASE 
                                WHEN contacts.name IS NULL OR contacts.name = '' OR contacts.name = contacts.phone THEN EXCLUDED.name
                                ELSE contacts.name 
                            END,
                            push_name = COALESCE(EXCLUDED.push_name, contacts.push_name),
                            phone = EXCLUDED.phone,
                            instance = EXCLUDED.instance,
                            updated_at = NOW()
                    `, [companyId, normalizedJid, normalizedPhone, name, msg.pushName || null, instance]);
                } catch (err) {
                    console.error('[Webhook] Error upserting contact:', err);
                }
            }

            // --- UNIFIED CONVERSATION LINKING LOGIC (Anti-Duplication) ---
            let conversationId: number;
            let currentStatus: string = 'PENDING';
            let isNewConversation = false;
            let previousStatus = 'PENDING';

            const supportsGroupSubject = await hasGroupSubjectColumn();

            // 1. First Attempt: Match strictly by JID + Instance + Company (The Gold Standard)
            let checkConv = await pool.query(
                `SELECT id, status, is_group, contact_name, group_name, ${supportsGroupSubject ? 'group_subject,' : 'NULL AS group_subject,'} profile_pic_url, external_id, instance, phone, channel 
                 FROM whatsapp_conversations 
                 WHERE company_id = $1 AND external_id = $2 AND instance = $3`,
                [companyId, normalizedJid, instance]
            );

            // 2. Second Attempt (Individuals Only): Fallback to matching by cleaned Phone Number across ANY instance
            // This prevents "Ghost Cards" or Duplicates when the same user appears on a different instance or with/without suffix
            if (checkConv.rows.length === 0 && !isGroup) {
                checkConv = await pool.query(
                    `SELECT id, status, is_group, contact_name, group_name, ${supportsGroupSubject ? 'group_subject,' : 'NULL AS group_subject,'} profile_pic_url, external_id, instance, phone, channel 
                     FROM whatsapp_conversations 
                     WHERE company_id = $1 AND is_group = false AND phone = $2
                     ORDER BY last_message_at DESC LIMIT 1`,
                    [companyId, normalizedPhone]
                );
                if (checkConv.rows.length > 0) {
                    console.log(`[Webhook] Found conversation by phone match instead of JID/Instance for ${normalizedPhone}. Preventing duplication.`);
                }
            }

            // If found, we use it. 
            if (checkConv.rows.length > 0) {

                const row = checkConv.rows[0];
                conversationId = row.id;
                previousStatus = row.status || 'PENDING';
                currentStatus = row.status || 'PENDING';
                let newStatus = currentStatus;

                // User Request: EVERY message (inbound or outbound) moves conversation to PENDING
                // regardless of its current state, unless manually changed to OPEN/CLOSED in system.
                newStatus = 'PENDING';

                currentStatus = newStatus;
                const shouldForceGroup = isGroup && row.is_group !== true;
                const shouldUpdateGroupName = isGroup && !!groupNameFromPayload && row.group_name !== groupNameFromPayload;
                const shouldUpdateGroupSubject = isGroup && !!groupNameFromPayload && row.group_subject !== groupNameFromPayload;
                const resolvedChannel = row.channel || resolveConversationChannel(instance);

                // CRITICAL FIX: Ensure we don't use pushName (sender) for group titles
                const isActuallyGroup = isGroup || row.is_group;

                if (newStatus !== row.status || (!isActuallyGroup && msg.pushName && (row.contact_name === null || row.contact_name === '' || row.contact_name === row.phone)) || shouldForceGroup || shouldUpdateGroupName || shouldUpdateGroupSubject) {
                    const updateParams = [
                        newStatus,
                        isActuallyGroup ? (groupNameFromPayload || row.group_name || row.contact_name) : (msg.pushName || null),
                        conversationId,
                        shouldForceGroup,
                        isActuallyGroup ? (groupNameFromPayload || row.group_name || row.contact_name) : null,
                        resolvedChannel
                    ];

                    const updateSql = supportsGroupSubject
                        ? `UPDATE whatsapp_conversations
                           SET status = $1,
                               contact_name = CASE 
                                   WHEN contact_name IS NULL OR contact_name = '' OR contact_name = phone THEN COALESCE($2, contact_name)
                                   ELSE contact_name
                               END,
                               is_group = CASE WHEN $4 THEN true ELSE is_group END,
                               group_name = CASE 
                                   WHEN $5 IS NOT NULL THEN $5
                                   WHEN $4 THEN COALESCE(group_name, contact_name, $2, external_id)
                                   ELSE group_name
                               END,
                               group_subject = CASE
                                   WHEN $4 AND $5 IS NOT NULL THEN $5
                                   ELSE group_subject
                               END,
                               group_last_sync = CASE
                                   WHEN $4 AND $5 IS NOT NULL THEN NOW()
                                   ELSE group_last_sync
                               END,
                               channel = COALESCE(channel, $6)
                           WHERE id = $3`
                        : `UPDATE whatsapp_conversations
                           SET status = $1,
                               contact_name = CASE 
                                   WHEN contact_name IS NULL OR contact_name = '' OR contact_name = phone THEN COALESCE($2, contact_name)
                                   ELSE contact_name
                               END,
                               is_group = CASE WHEN $4 THEN true ELSE is_group END,
                               group_name = CASE 
                                   WHEN $5 IS NOT NULL THEN $5
                                   WHEN $4 THEN COALESCE(group_name, contact_name, $2, external_id)
                                   ELSE group_name
                               END,
                               group_last_sync = CASE
                                   WHEN $4 AND $5 IS NOT NULL THEN NOW()
                                   ELSE group_last_sync
                               END,
                               channel = COALESCE(channel, $6)
                           WHERE id = $3`;

                    pool.query(updateSql, updateParams).catch(() => { });
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

                // User Request: Every new conversation starts as PENDING
                isNewConversation = true;
                currentStatus = 'PENDING';
                const channel = resolveConversationChannel(instance);

                const finalName = isGroup ? (groupName || 'Grupo (Nome não sincronizado)') : name;

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
                    const newConv = supportsGroupSubject
                        ? await pool.query(
                            `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, company_id, is_group, group_name, group_subject, group_last_sync, last_instance_key, queue_id, channel)
                             VALUES ($1, $2, $3, $4::text, $5, $6, $7, $8, $9, $10, $4::text, $11, $12) RETURNING id`,
                            [normalizedJid, normalizedPhone, finalName, String(instance), currentStatus, companyId, isGroup, isGroup ? finalName : null, isGroup ? groupName : null, isGroup && groupName ? new Date() : null, defaultQueueId, channel]
                        )
                        : await pool.query(
                            `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, company_id, is_group, group_name, group_last_sync, last_instance_key, queue_id, channel)
                             VALUES ($1, $2, $3, $4::text, $5, $6, $7, $8, $9, $4::text, $10, $11) RETURNING id`,
                            [normalizedJid, normalizedPhone, finalName, String(instance), currentStatus, companyId, isGroup, isGroup ? finalName : null, isGroup && groupName ? new Date() : null, defaultQueueId, channel]
                        );
                    conversationId = newConv.rows[0].id;
                }
            }

            if (isGroup && supportsGroupSubject) {
                try {
                    const metadataRow = await pool.query(
                        'SELECT id, group_subject, instance, company_id FROM whatsapp_conversations WHERE id = $1 LIMIT 1',
                        [conversationId]
                    );
                    const conversation = metadataRow.rows[0];
                    if (conversation && !conversation.group_subject) {
                        const cfg = await getEvolutionConfig((req as any).user, 'messages.upsert.group_subject', conversation.company_id, conversation.instance || instance);
                        const baseUrl = String(cfg.url || '').replace(/\/$/, '');
                        const apiKey = cfg.apikey;
                        const instanceKey = conversation.instance || instance || cfg.instance;

                        if (baseUrl && apiKey && instanceKey) {
                            let groupInfoResponse = await fetch(`${baseUrl}/group-info/${normalizedJid}`, {
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json',
                                    apikey: apiKey,
                                    instance: String(instanceKey)
                                }
                            });

                            if (groupInfoResponse.status === 404) {
                                groupInfoResponse = await fetch(`${baseUrl}/group/findGroup/${instanceKey}?groupJid=${encodeURIComponent(normalizedJid)}`, {
                                    method: 'GET',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        apikey: apiKey
                                    }
                                });
                            }

                            if (groupInfoResponse.status === 404) {
                                console.warn('[Group] Could not fetch subject. Keeping existing.');
                            } else if (groupInfoResponse.ok) {
                                const groupInfo = await groupInfoResponse.json();
                                if (!groupInfo || (!groupInfo.data && !groupInfo.subject)) {
                                    console.warn('[Group] Could not fetch subject. Keeping existing.');
                                } else if (groupInfo?.data?.subject || groupInfo?.subject) {
                                    const subject = groupInfo?.data?.subject || groupInfo?.subject;
                                    await pool.query(
                                        `UPDATE whatsapp_conversations
                                         SET group_subject = $1,
                                             group_name = COALESCE(NULLIF(group_name, ''), $1),
                                             contact_name = CASE
                                               WHEN contact_name IS NULL OR contact_name = '' OR contact_name = 'Grupo (Nome não sincronizado)' THEN $1
                                               ELSE contact_name
                                             END,
                                             group_last_sync = NOW()
                                         WHERE id = $2`,
                                        [subject, conversation.id]
                                    );
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[Group] Could not fetch subject. Keeping existing.', error);
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

            // Insert Message into database with instance tracking and source attribution
            let insertedMsg = await pool.query(
                `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, message_type, media_url, user_id, sender_jid, sender_name, company_id, instance_id, instance_key, instance_name, message_source, message_origin) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
                 ON CONFLICT (external_id) DO NOTHING RETURNING *`,
                [conversationId, direction, content, sent_at.toISOString(), 'received', externalId, messageType, mediaUrl, null, senderJid, senderName, companyId, instanceId, instance, instanceDisplayName, messageSource, messageSource]
            );

            // Handle cross-company/instance collision when external_id is globally unique.
            // If the same external_id already exists for another conversation/company, this is NOT a real duplicate.
            // In this case, persist with a scoped id so the message is not lost from the frontend/history.
            if (insertedMsg.rows.length === 0) {
                const conflictCheck = await pool.query(
                    `SELECT id, conversation_id, company_id
                     FROM whatsapp_messages
                     WHERE external_id = $1
                     ORDER BY id DESC
                     LIMIT 1`,
                    [externalId]
                );

                const conflictRow = conflictCheck.rows[0];
                const isCrossConversationCollision = Boolean(
                    conflictRow && (
                        Number(conflictRow.conversation_id) !== Number(conversationId)
                        || Number(conflictRow.company_id) !== Number(companyId)
                    )
                );

                if (isCrossConversationCollision) {
                    const scopedExternalId = `${externalId}::c${companyId}::v${conversationId}`;
                    console.warn(`[Webhook] external_id collision detected (${externalId}). Saving as ${scopedExternalId}.`);
                    insertedMsg = await pool.query(
                        `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, message_type, media_url, user_id, sender_jid, sender_name, company_id, instance_id, instance_key, instance_name, message_source, message_origin) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                         ON CONFLICT (external_id) DO NOTHING RETURNING *`,
                        [conversationId, direction, content, sent_at.toISOString(), 'received', scopedExternalId, messageType, mediaUrl, null, senderJid, senderName, companyId, instanceId, instance, instanceDisplayName, messageSource, messageSource]
                    );
                }
            }

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

                // Whaticket: handle greeting for new or reopened tickets
                if (direction === 'inbound' && !isGroup) {
                    const io = req.app.get('io');
                    handleWhaticketGreeting(
                        conversationId,
                        companyId,
                        phone,
                        isNewConversation,
                        previousStatus,
                        io
                    ).catch(e => console.error('[Whaticket Webhook] Error:', e));
                }
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
                      AND wm.conversation_id = $2
                      AND wm.company_id = $3
                `, [externalId, conversationId, companyId]);

                if (existingResult.rows.length > 0) {
                    const existingMsg = existingResult.rows[0];
                    console.log(`[Webhook] Found existing message: ID=${existingMsg.id}, direction=${existingMsg.direction}, content="${existingMsg.content?.substring(0, 30)}..."`);

                    const io = req.app.get('io');
                    if (io) {
                        const conversationCompanyId = Number(checkConv.rows[0]?.company_id || companyId);
                        const room = `company_${conversationCompanyId}`;
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
                            company_id: conversationCompanyId,
                            status: currentStatus,
                            sender_jid: existingMsg.sender_jid,
                            sender_name: existingMsg.sender_name,
                            agent_name: existingMsg.agent_name || existingMsg.sent_by_user_name || ((existingMsg.direction === 'outbound' && !existingMsg.user_id) ? (existingMsg.message_source === 'whatsapp_mobile' ? 'Celular' : (existingMsg.message_source === 'whatsapp_web' ? 'WhatsApp Web' : 'Sistema')) : null),
                            message_origin: (existingMsg.direction === 'outbound' && !existingMsg.user_id) ? (existingMsg.message_source === 'whatsapp_mobile' ? 'whatsapp_mobile' : (existingMsg.message_source === 'whatsapp_web' ? 'whatsapp_web' : 'evolution_api')) : 'system'
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
                    processChatbotMessage(instance, phone, content, req.app.get('io')).catch(e => console.error('[Chatbot Error]:', e));
                }

                // Emit Socket (Critical Path for UI Responsiveness)
                const io = req.app.get('io');
                if (io) {
                    const conversationCompanyId = Number(checkConv.rows[0]?.company_id || companyId);
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

                    const room = `company_${conversationCompanyId}`;
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
                        company_id: conversationCompanyId,
                        status: currentStatus,
                        sender_jid: insertedMsg.rows[0].sender_jid,
                        sender_name: insertedMsg.rows[0].sender_name,
                        message_source: messageSource,
                        agent_name: insertedMsg.rows[0].sent_by_user_name || ((direction === 'outbound' && !insertedMsg.rows[0].user_id) ? (messageSource === 'whatsapp_mobile' ? 'Celular' : (messageSource === 'whatsapp_web' ? 'WhatsApp Web' : (msg.agent_name || 'Sistema'))) : null),
                        message_origin: (direction === 'outbound' && !insertedMsg.rows[0].user_id) ? (messageSource === 'whatsapp_mobile' ? 'whatsapp_mobile' : (messageSource === 'whatsapp_web' ? 'whatsapp_web' : 'evolution_api')) : 'system'
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
                group_subject: row.group_subject || (row.channel === 'instagram' ? 'Grupo Instagram' : 'Grupo WhatsApp')
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
            co.instagram_id,
            -- Prioritize Name/Username from contacts
            COALESCE(
                CASE WHEN (c.is_group = true OR c.external_id LIKE '%@g.us') THEN ${groupSubjectExpr} ELSE NULL END,
                CASE WHEN (c.is_group = true OR c.external_id LIKE '%@g.us') THEN NULLIF(TRIM(c.group_name), '') ELSE NULL END,
                NULLIF(TRIM(co.name), ''),
                CASE WHEN c.channel = 'instagram' AND co.push_name IS NOT NULL THEN '@' || co.push_name ELSE co.push_name END,
                NULLIF(TRIM(c.contact_name), ''),
                c.phone
            ) as display_name,
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
                    co.username as push_name, 
                    COALESCE(co.name, co.instagram_username, co.username) as name,
                    co.instagram_id
                FROM contacts co
                WHERE co.company_id = c.company_id
                  AND (
                    (c.channel = 'instagram' AND co.instagram_id = c.external_id)
                    OR
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
                  CASE
                    WHEN co.external_id = c.external_id OR co.instagram_id = c.external_id THEN 0
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
                    'Grupo (Nome não sincronizado)'
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
                details: 'Uma coluna esperada não existe. Rode as migrations e tente novamente.'
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
                    return res.status(403).json({ error: 'Você não tem permissão para acessar estas mensagens.' });
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
                .catch(e => console.error('[getMessages] Failed to reset unread count:', e));

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

        console.log(`[Instagram Webhook] Tentativa de verificação: mode=${mode}, token=${token}`);

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[Instagram Webhook] Verificado com sucesso.');
            // Meta exige que o desafio seja retornado como texto puro na resposta
            return res.status(200).send(challenge);
        }

        console.warn(`[Instagram Webhook] Falha na verificação. Token esperado: ${VERIFY_TOKEN ? 'Configurado' : 'AUSENTE'}`);
        return res.sendStatus(403);
    } catch (e) {
        console.error('[Instagram Verify Error]', e);
        return res.sendStatus(403);
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
            status: 'info',
            message: 'Instagram Webhook Received',
            details: body
        }).catch(e => console.error('Failed to log IG webhook', e));

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

                            // DEBUG: Log ID Length
                            if (process.env.DEBUG === 'true' || process.env.DEBUG_WEBHOOK === 'true') {
                                console.log(`[Instagram Webhook Debug] Msg from ${senderId} (len: ${senderId.length})`);
                                if (messageId) {
                                    console.log(`[Instagram Webhook Debug] MID: ${messageId} (len: ${messageId.length})`);
                                }
                            }

                            console.log(`[Instagram Webhook] Msg from ${senderId}: ${text}`);

                            // Get User Profile via Service (Meta Graph API)
                            const { getInstagramProfile, formatInstagramUsername } = await import('../services/instagramProfileService.js');
                            const profile = await getInstagramProfile(senderId, company.instagram_access_token, company.id);

                            const username = profile.username || senderId; // Username real ou ID numérico
                            const realName = profile.name || null;         // Nome completo (ex: "John Doe")
                            const profilePic = profile.profilePic || null;
                            const displayUsername = formatInstagramUsername(username); // @username ou "Instagram User"

                            // Prioridade de exibição: Nome Real > @username
                            const finalDisplayName = realName || displayUsername;

                            console.log(`[Instagram Webhook] Resolved Profile: @${username} | Name: ${realName} | Display: ${finalDisplayName}`);

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
                                const defaultQueueId = await getOrCreateQueueId(company.id, 'Recepcao');
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
