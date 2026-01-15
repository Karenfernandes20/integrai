import { pool } from '../db';
import { incrementUsage } from './limitService';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function sendWhatsAppMessage({
    companyId,
    phone,
    message,
    contactName,
    userId,
    io,
    mediaUrl,
    mediaType,
    campaignId,
    followUpId
}: {
    companyId: number | null,
    phone: string,
    message: string,
    contactName?: string,
    userId?: number | null,
    io?: any,
    mediaUrl?: string | null,
    mediaType?: string | null,
    campaignId?: number,
    followUpId?: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        if (!pool) return { success: false, error: 'Database not configured' };

        // 1. Resolve Evolution Config
        let evolution_instance, evolution_apikey, evolution_url;
        let resolvedCompanyId = companyId;

        if (followUpId || campaignId) {
            // Se tivermos um ID de contexto, podemos tentar buscar a conversa primeiro para saber a instância
            const contextQuery = followUpId
                ? await pool.query('SELECT conversation_id, company_id FROM crm_follow_ups WHERE id = $1', [followUpId])
                : await pool.query('SELECT instance_id, company_id FROM whatsapp_campaigns WHERE id = $1', [campaignId]);

            if (contextQuery.rows.length > 0) {
                const ctx = contextQuery.rows[0];
                resolvedCompanyId = ctx.company_id || companyId;
                const convId = ctx.conversation_id;
                const campaignInstanceId = ctx.instance_id;

                if (convId) {
                    const convRes = await pool.query('SELECT instance FROM whatsapp_conversations WHERE id = $1', [convId]);
                    if (convRes.rows.length > 0) {
                        evolution_instance = convRes.rows[0].instance;
                    }
                } else if (campaignInstanceId) {
                    const instRes = await pool.query('SELECT instance_key FROM company_instances WHERE id = $1', [campaignInstanceId]);
                    if (instRes.rows.length > 0) {
                        evolution_instance = instRes.rows[0].instance_key;
                    }
                }
            }
        }

        const compRes = await pool.query(
            'SELECT evolution_instance, evolution_apikey, evolution_url FROM companies WHERE id = $1',
            [resolvedCompanyId]
        );

        if (compRes.rows.length === 0) {
            return { success: false, error: 'Empresa não encontrada ou sem configuração Evolution' };
        }

        const compData = compRes.rows[0];
        evolution_instance = evolution_instance || compData.evolution_instance;
        evolution_apikey = compData.evolution_apikey;
        evolution_url = compData.evolution_url;
        const baseUrl = (evolution_url || process.env.EVOLUTION_API_URL || "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host").replace(/\/$/, "");

        const cleanPhone = phone.replace(/\D/g, "");
        console.log(`[sendWhatsAppMessage] Preparing to send to ${cleanPhone} via ${evolution_instance}. Media: ${mediaUrl ? 'YES' : 'NO'}`);

        // 2. Prepare Payload and Endpoint based on strict flows
        let targetUrl = '';
        const payload: any = {
            number: cleanPhone,
            options: {
                delay: 1200,
                presence: "composing",
                linkPreview: false
            }
        };

        if (mediaUrl) {
            // === MEDIA FLOW ===
            targetUrl = `${baseUrl}/message/sendMedia/${evolution_instance}`;

            // Validate Media URL
            if (mediaUrl.startsWith('http')) {
                try {
                    const check = await fetch(mediaUrl, { method: 'HEAD' });
                    if (!check.ok) {
                        console.error(`[sendWhatsAppMessage] Media URL unreachable: ${mediaUrl} (${check.status})`);
                        return { success: false, error: `URL de mídia inválida ou inacessível (Status ${check.status})` };
                    }
                } catch (e: any) {
                    console.error(`[sendWhatsAppMessage] Failed to check media URL: ${e.message}`);
                    return { success: false, error: `Erro ao verificar URL da mídia: ${e.message}` };
                }
            }

            // Process Local vs Remote
            let finalMedia = mediaUrl;
            let isBase64 = false;

            try {
                const filename = mediaUrl.split('/').pop()?.split('?')[0];
                const ups = path.join(__dirname, '../uploads');
                const possibleLocalPath = filename ? path.join(ups, filename) : '';

                const fileExists = filename && fs.existsSync(possibleLocalPath);
                const isUploadPath = mediaUrl.includes('/uploads/');
                const isLocalhost = mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1');

                if (fileExists && (isUploadPath || isLocalhost)) {
                    console.log(`[sendWhatsAppMessage] Converting local file to Base64: ${filename}`);
                    const fileBuffer = fs.readFileSync(possibleLocalPath);
                    finalMedia = fileBuffer.toString('base64');
                    isBase64 = true;
                }
            } catch (e) {
                console.error("[sendWhatsAppMessage] Error reading local file:", e);
                // Continue with URL if local read fails
            }

            const validTypes = ['image', 'video', 'document', 'audio'];
            const safeMediaType = validTypes.includes(mediaType?.toLowerCase() || '') ? mediaType?.toLowerCase() : 'image';
            const fileName = (mediaUrl.split('/').pop() || 'file').split('?')[0];

            // Strict Payload for sendMedia (Evolution API typically accepts this flat structure OR mediaMessage)
            // We use the flattened structure as per "campos corretos" requirement
            payload.media = finalMedia;
            payload.mediatype = safeMediaType;
            payload.caption = message || "";
            payload.fileName = fileName;

            // Note: If Evolution expects 'mediaMessage' object, this might fail.
            // But user specifically asked for "image", "caption" etc. in specific workflow.

        } else {
            // === TEXT FLOW ===
            targetUrl = `${baseUrl}/message/sendText/${evolution_instance}`;
            payload.textMessage = { text: message };
            payload.text = message;
        }

        // 3. LOG PAYLOAD (Requirement 2)
        const logPayload = { ...payload };
        if (logPayload.media && logPayload.media.length > 200) logPayload.media = '[BASE64_HIDDEN]';
        console.log(`[sendWhatsAppMessage] POST ${targetUrl}`);
        console.log(`[sendWhatsAppMessage] Headers: { apikey: '${evolution_apikey ? '***' : 'MISSING'}' }`);
        console.log(`[sendWhatsAppMessage] Payload:`, JSON.stringify(logPayload, null, 2));

        // 4. Send Request
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolution_apikey
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        // 5. Log Response (Requirement 2 & 7)
        console.log(`[sendWhatsAppMessage] Response Status: ${response.status}`);
        console.log(`[sendWhatsAppMessage] Response Body: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);

        if (!response.ok) {
            let errorMsg = responseText;
            try {
                const jsonErr = JSON.parse(responseText);
                errorMsg = jsonErr.message || jsonErr.error || JSON.stringify(jsonErr);
            } catch (e) { }
            // Never mask as success
            return { success: false, error: `Evolution Error (${response.status}): ${errorMsg}` };
        }

        const data = JSON.parse(responseText);

        // 6. DB Updates (Success flow)
        const remoteJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

        // Sync with Atendimento
        const checkConv = await pool.query(
            'SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2',
            [remoteJid, evolution_instance]
        );

        let conversationId: number;
        const source = campaignId ? 'campaign' : (followUpId ? 'follow_up' : null);

        if (checkConv.rows.length > 0) {
            conversationId = checkConv.rows[0].id;
            await pool.query(
                `UPDATE whatsapp_conversations 
                 SET last_message = $1, last_message_at = NOW(), status = 'OPEN', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3), last_message_source = $5
                 WHERE id = $4`,
                [message, userId, companyId, conversationId, source]
            );
        } else {
            const newConv = await pool.query(
                `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id, last_message_source) 
                 VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, NOW(), $7, $8) RETURNING id`,
                [remoteJid, cleanPhone, contactName || cleanPhone, evolution_instance, userId, message, companyId, source]
            );
            conversationId = newConv.rows[0].id;
        }

        const externalMessageId = data?.key?.id;
        const insertedMsg = await pool.query(
            'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, media_url, message_type, campaign_id, follow_up_id, company_id) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
            [conversationId, 'outbound', message, 'sent', externalMessageId, userId, mediaUrl || null, mediaType || 'text', campaignId || null, followUpId || null, companyId]
        );

        if (companyId) {
            await incrementUsage(companyId, 'messages', 1);
        }

        if (io && companyId) {
            const socketPayload = {
                ...insertedMsg.rows[0],
                phone: cleanPhone,
                contact_name: contactName || cleanPhone,
                status: 'OPEN',
                direction: 'outbound',
                content: message,
                sent_at: new Date().toISOString(),
                user_id: userId,
                remoteJid,
                instance: evolution_instance,
                company_id: companyId,
                agent_name: campaignId ? "(Campanha)" : (followUpId ? "(Follow-Up)" : null),
                media_url: mediaUrl,
                message_type: mediaType || 'text'
            };
            io.to(`company_${companyId}`).emit('message:received', socketPayload);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error sending WhatsApp message:', error);
        return { success: false, error: error.message };
    }
}
