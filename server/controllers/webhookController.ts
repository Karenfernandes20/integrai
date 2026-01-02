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

// Caching for performance
const instanceCache = new Map<string, number>();
const stagesCache: { map: any, lastFetch: number } = { map: null, lastFetch: 0 };
const STAGE_CACHE_TTL = 300000; // 5 minutes

// Memory logging to catch the last few payloads if they fail mapping
const lastPayloads: any[] = [];
const pushPayload = (p: any) => {
    lastPayloads.unshift({ t: new Date().toISOString(), ...p });
    if (lastPayloads.length > 20) lastPayloads.pop();
};

export const debugWebhookPayloads = (req: Request, res: Response) => {
    res.json(lastPayloads);
};


export const handleWebhook = async (req: Request, res: Response) => {
    // 1. Respond immediately to avoid Evolution API blocking or timeouts
    res.status(200).json({ status: 'received' });

    // 2. Process in dynamic data retrieval and DB logic in the background
    (async () => {
        try {
            const body = req.body;
            if (!body) {
                console.warn('[Webhook] Received empty body');
                return;
            }

            // Verbose logging for debugging - LOG THE WHOLE BODY INITIALLY TO TRACE STRUCTURE
            console.log('[Webhook] New payload received from Evolution API');

            // Extract raw metadata for logging
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

            console.log(`[Webhook] Event: ${type} | Instance: ${instance}`);
            pushPayload({ type, instance, keys: Object.keys(body), body: body });

            if (!type) {
                console.warn('[Webhook] Missing type/event in payload root. Body keys:', Object.keys(body));
                return;
            }

            const normalizedType = type.toString().toUpperCase();

            // Accept various message event patterns (be exhaustive)
            const isMessageEvent = [
                'MESSAGES_UPSERT', 'MESSAGES.UPSERT',
                'MESSAGE_UPSERT', 'MESSAGE.UPSERT',
                'MESSAGES_SET', 'MESSAGES.SET',
                'MESSAGE_SET', 'MESSAGE.SET',
                'MESSAGES_RECEIVE', 'MESSAGE_RECEIVE',
                'MESSAGES.RECEIVE', 'MESSAGE.RECEIVE',
                'SEND_MESSAGE'
            ].includes(normalizedType);

            if (!isMessageEvent) {
                // Silently ignore other events but log them for trace
                const ignitionEvents = ['CONNECTION_UPDATE', 'PRESENCE_UPDATE', 'TYPEING_START', 'CHATS_UPSERT', 'CHATS_UPDATE'];
                if (!ignitionEvents.includes(normalizedType)) {
                    console.log(`[Webhook] Ignoring non-message event: ${normalizedType}`);
                }
                return;
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
            if (!msg || (!msg.key && !msg.id)) {
                console.warn('[Webhook] Data structure mismatch. Could not find msg.key. Keys in messages:', msg ? Object.keys(msg) : 'null');
                pushPayload({ error: 'Mismatch structure', data: messages });
                return;
            }

            // Normalize message structure (some versions put message at root, others inside messages array)
            const remoteJid = msg.key?.remoteJid || msg.remoteJid || msg.jid;
            if (!remoteJid) {
                console.warn('[Webhook] Missing remoteJid in message');
                return;
            }
            console.log(`[Webhook] Message JID: ${remoteJid} | fromMe: ${msg.key?.fromMe}`);

            if (remoteJid === 'status@broadcast') return;

            if (!pool) {
                console.error('[Webhook] CRITICAL: DB pool is null');
                return;
            }

            // Resolve Company ID
            let companyId: number | null = instanceCache.get(instance) || null;
            if (!companyId) {
                console.log(`[Webhook] Cache miss for instance "${instance}". Looking up in DB...`);
                const compLookup = await pool.query(
                    'SELECT id FROM companies WHERE LOWER(evolution_instance) = LOWER($1)',
                    [instance]
                );
                if (compLookup.rows.length > 0) {
                    companyId = compLookup.rows[0].id;
                    instanceCache.set(instance, companyId!);
                    console.log(`[Webhook] Success! Instance "${instance}" mapped to companyId ${companyId}`);
                } else {
                    // Check if there is ONLY ONE company as fallback
                    const allCompanies = await pool.query('SELECT id, evolution_instance FROM companies');
                    console.log('[Webhook] Available companies in DB:', allCompanies.rows.map(c => `${c.id}:${c.evolution_instance}`).join(', '));

                    if (allCompanies.rows.length === 1) {
                        companyId = allCompanies.rows[0].id;
                        console.log(`[Webhook] Single-Company Mode: Mapping instance "${instance}" to companyId ${companyId} (only one available)`);
                        instanceCache.set(instance, companyId!);
                    }
                }
            }

            if (!companyId) {
                console.warn(`[Webhook] ABORTED: Could not map instance "${instance}" to any company.`);
                return;
            }

            // Prepare Data
            const isFromMe = msg.key?.fromMe || msg.fromMe || false;
            const direction = isFromMe ? 'outbound' : 'inbound';
            const phone = remoteJid.includes('@') ? remoteJid.split('@')[0] : remoteJid;
            const name = msg.pushName || msg.pushname || phone;
            const isGroup = remoteJid.includes('@g.us');
            const senderJid = msg.key?.participant || msg.participant || (isGroup ? null : remoteJid);
            const senderName = msg.pushName || msg.pushname || (senderJid ? senderJid.split('@')[0] : null);

            let groupName = null;
            if (isGroup) {
                groupName = `Grupo ${phone.substring(0, 8)}...`;
                console.log(`[Webhook] Detected GROUP message for JID: ${remoteJid}`);
            }

            // UPSERT Conversation
            let conversationId: number;
            const checkConv = await pool.query(
                `SELECT id, status, is_group, contact_name, group_name, profile_pic_url FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2 AND company_id = $3`,
                [remoteJid, instance, companyId]
            );

            let currentStatus: string = 'PENDING';

            if (checkConv.rows.length > 0) {
                const row = checkConv.rows[0];
                conversationId = row.id;
                currentStatus = row.status || 'PENDING';

                let newStatus = currentStatus;
                if (direction === 'inbound' && currentStatus === 'CLOSED') newStatus = 'PENDING';
                else if (direction === 'outbound' && currentStatus !== 'OPEN') newStatus = 'OPEN';

                currentStatus = newStatus;

                // Sync basic data if changed (Run in background)
                if (newStatus !== row.status || (msg.pushName && !row.is_group && row.contact_name !== msg.pushName)) {
                    pool.query(`UPDATE whatsapp_conversations SET status = $1, contact_name = COALESCE($2, contact_name) WHERE id = $3`,
                        [newStatus, (msg.pushName && !row.is_group) ? msg.pushName : null, conversationId]
                    ).catch(e => console.error('[Webhook BG Update Error]:', e));
                }

            } else {
                currentStatus = direction === 'outbound' ? 'OPEN' : 'PENDING';

                // For new groups, try to get a better name if possible
                let finalName = isGroup ? `Grupo ${phone.substring(0, 8)}` : name;

                const newConv = await pool.query(
                    `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, company_id, is_group, group_name) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [remoteJid, phone, finalName, instance, currentStatus, companyId, isGroup, isGroup ? finalName : null]
                );
                conversationId = newConv.rows[0].id;
            }

            // Extract Content Robustly from various WhatsApp message structures
            let content = '';
            let messageType = 'text';
            let mediaUrl: string | null = null;
            const m = msg.message;
            if (!m) return;

            const getRealMessage = (mBody: any) => {
                if (mBody.viewOnceMessageV2?.message) return mBody.viewOnceMessageV2.message;
                if (mBody.viewOnceMessage?.message) return mBody.viewOnceMessage.message;
                if (mBody.ephemeralMessage?.message) return mBody.ephemeralMessage.message;
                return mBody;
            };

            const realM = getRealMessage(m);

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
                // Secondary extraction for less common fields
                const textCandidates = ['text', 'caption', 'title', 'displayName', 'body'];
                for (const candidate of textCandidates) {
                    if (realM[candidate]) {
                        content = realM[candidate];
                        break;
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
            }

            const sent_at = new Date((msg.messageTimestamp || msg.timestamp || Date.now() / 1000) * 1000);
            const externalId = msg.key?.id || msg.id || `gen-${Date.now()}`;

            // Insert Message into database
            const insertedMsg = await pool.query(
                `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, message_type, media_url, user_id, sender_jid, sender_name) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                 ON CONFLICT (external_id) DO NOTHING RETURNING *`,
                [conversationId, direction, content, sent_at, 'received', externalId, messageType, mediaUrl, null, senderJid, senderName]
            );

            // If duplicate message (conflict), stop processing
            if (insertedMsg.rows.length === 0) {
                console.log(`[Webhook] Duplicate message detected for external_id ${externalId}. Skipping.`);
                return;
            }
            console.log(`[Webhook] Message inserted into DB with ID: ${insertedMsg.rows[0].id}`);

            // Emit Socket (Critical Path for UI Responsiveness)
            const io = req.app.get('io');
            // emission
            if (io) {
                const room = `company_${companyId}`;
                const payload = {
                    ...insertedMsg.rows[0],
                    phone,
                    contact_name: (checkConv.rows.length > 0 ? checkConv.rows[0].contact_name : name) || name,
                    is_group: checkConv.rows.length > 0 ? checkConv.rows[0].is_group : isGroup,
                    group_name: (checkConv.rows.length > 0 ? checkConv.rows[0].group_name : null) || groupName,
                    profile_pic_url: checkConv.rows.length > 0 ? checkConv.rows[0].profile_pic_url : null,
                    remoteJid,
                    instance,
                    company_id: companyId,
                    status: currentStatus,
                    sender_jid: insertedMsg.rows[0].sender_jid,
                    sender_name: insertedMsg.rows[0].sender_name
                };
                console.log(`[Webhook] Emitting message to room ${room}`);
                io.to(room).emit('message:received', payload);
            }

            // 6. Non-critical post-processing (Metadata & CRM & Profile Pic)
            (async () => {
                console.log(`[Webhook] Starting non-critical post-processing for conversation ${conversationId}.`);
                // Update Conversation Metadata (Last message preview)
                await pool!.query(
                    `UPDATE whatsapp_conversations 
                     SET last_message_at = $1, last_message = $2, 
                         unread_count = CASE WHEN $3 = 'inbound' THEN unread_count + 1 ELSE unread_count END 
                     WHERE id = $4`,
                    [sent_at, content, direction, conversationId]
                );
                console.log(`[Webhook] Conversation ${conversationId} metadata updated.`);

                const isGroup = remoteJid.endsWith('@g.us');

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
                            const compRes = await pool!.query('SELECT evolution_apikey FROM companies WHERE id = $1', [companyId]);
                            if (compRes.rows.length > 0 && compRes.rows[0].evolution_apikey) {
                                const apikey = compRes.rows[0].evolution_apikey;
                                const baseUrl = process.env.EVOLUTION_API_URL || "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";

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
                                                await pool!.query('UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE jid = $2 AND instance = $3', [picUrl, remoteJid, instance]);
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

                        const [contactCheck, checkLead] = await Promise.all([
                            // Check if contact is saved with a real name (not just the phone)
                            pool!.query(`SELECT id FROM whatsapp_contacts WHERE jid = $1 AND instance = $2 AND name IS NOT NULL AND name != '' AND name != $3 LIMIT 1`, [remoteJid, instance, phone]),
                            pool!.query('SELECT id FROM crm_leads WHERE phone = $1 AND company_id = $2', [phone, companyId])
                        ]);

                        if (checkLead.rows.length === 0 && contactCheck.rows.length === 0) {
                            console.log(`[Webhook] Creating auto-lead for unregistered contact ${phone} in LEADS stage.`);
                            await pool!.query(
                                `INSERT INTO crm_leads (name, phone, origin, stage_id, company_id, created_at, updated_at, description) 
                                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 'Lead automático (Nova mensagem)')`,
                                [name || phone, phone, 'WhatsApp', leadsStageId, companyId]
                            );
                        } else if (checkLead.rows.length > 0) {
                            // Update existing lead timestamp
                            await pool!.query('UPDATE crm_leads SET updated_at = NOW() WHERE id = $1', [checkLead.rows[0].id]);
                        }
                    }
                }
            })().catch(e => console.error('[Webhook Post-processing Error]:', e));

        } catch (err) {
            console.error('[Webhook Main Error]:', err);
        }
    })();
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        let companyId = user?.company_id;

        let query = `
            SELECT c.*, 
            (SELECT content FROM whatsapp_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message,
            (SELECT sender_name FROM whatsapp_messages WHERE conversation_id = c.id AND sender_name IS NOT NULL LIMIT 1) as last_sender_name,
            COALESCE(co.profile_pic_url, c.profile_pic_url) as profile_pic_url,
            co.push_name as contact_push_name
            FROM whatsapp_conversations c
            LEFT JOIN whatsapp_contacts co ON (c.external_id = co.jid AND c.instance = co.instance)
            WHERE 1=1
        `;
        const params: any[] = [];

        if (user.role !== 'SUPERADMIN') {
            query += ` AND c.company_id = $1`;
            params.push(companyId);
        } else {
            if (companyId) {
                query += ` AND c.company_id = $1`;
                params.push(companyId);
            } else {
                query += ` AND c.company_id IS NULL`;
            }
        }

        query += ` ORDER BY c.last_message_at DESC NULLS LAST`;

        const result = await pool.query(query, params);
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
        const user = (req as any).user;
        const companyId = user?.company_id;

        console.log(`[getMessages] Fetching messages for conversation ${conversationId}, user company: ${companyId}`);

        const check = await pool.query('SELECT company_id FROM whatsapp_conversations WHERE id = $1', [conversationId]);
        if (check.rows.length === 0) {
            console.warn(`[getMessages] Conversation ${conversationId} not found`);
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const msgCompanyId = check.rows[0].company_id;

        // Superadmin without company context can see everything
        // Regular user/Admin must match company_id
        if (user.role !== 'SUPERADMIN' || companyId) {
            if (msgCompanyId && companyId && msgCompanyId !== companyId) {
                console.warn(`[getMessages] Permission denied for conversation ${conversationId}. MsgCompany: ${msgCompanyId}, UserCompany: ${companyId}`);
                return res.status(403).json({ error: 'Você não tem permissão para acessar estas mensagens.' });
            }
        }

        const result = await pool.query(
            `SELECT m.*, u.full_name as agent_name 
             FROM whatsapp_messages m 
             LEFT JOIN app_users u ON m.user_id = u.id 
             WHERE m.conversation_id = $1 
             ORDER BY m.sent_at ASC`,
            [conversationId]
        );

        console.log(`[getMessages] Success. Found ${result.rows.length} messages.`);
        res.json(result.rows);
    } catch (error) {
        console.error('[getMessages Error]:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};
