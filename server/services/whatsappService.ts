import { pool } from '../db/index.js';
import { incrementUsage } from './limitService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizePhone } from '../utils/phoneUtils.js';
import { getEvolutionConfig } from '../controllers/evolutionController.js';

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
    followUpId,
    userName,
    instanceKey
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
    followUpId?: number,
    userName?: string,
    instanceKey?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        if (!pool) return { success: false, error: 'Database not configured' };

        // 1. Resolve Evolution Config
        const config = await getEvolutionConfig(
            { id: userId, company_id: companyId },
            'whatsapp_service',
            companyId as number,
            instanceKey
        );

        let evolution_instance = config.instance;
        let evolution_apikey = config.apikey;
        let evolution_url = config.url;
        let resolvedCompanyId = config.company_id;

        if (!evolution_instance || !evolution_apikey) {
            return { success: false, error: 'Configuração Evolution não encontrada para esta empresa.' };
        }

        const baseUrl = evolution_url.replace(/\/$/, "");

        const cleanPhone = normalizePhone(phone);
        console.log(`[sendWhatsAppMessage] Sending to ${cleanPhone} via instance ${evolution_instance}. Media: ${mediaUrl ? 'YES' : 'NO'}`);

        let targetUrl = '';
        let headers: any = {
            'apikey': evolution_apikey
        };
        let bodyPayload: any = null;

        // === MEDIA FLOW (Direct Base64 - Style WhatsApp Web) ===
        if (mediaUrl) {
            targetUrl = `${baseUrl}/message/sendMedia/${evolution_instance}`;
            headers['Content-Type'] = 'application/json';

            console.log(`[sendWhatsAppMessage] Processing media: ${mediaUrl}`);

            let base64Data = '';
            let fileName = 'file';
            let mimeType = 'image/jpeg';

            // 1. Resolve Path and Read File
            const uploadsMarker = '/uploads/';
            const hasUploads = mediaUrl.includes(uploadsMarker);
            const isRelative = !mediaUrl.startsWith('http');
            const isLocal = hasUploads || isRelative || mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1');

            if (isLocal) {
                try {
                    // Extract filename from path or URL
                    let cleanFileName = '';
                    if (hasUploads) {
                        cleanFileName = mediaUrl.split(uploadsMarker).pop()?.split('?')[0] || '';
                    } else if (isRelative) {
                        cleanFileName = path.basename(mediaUrl.split('?')[0]);
                    } else {
                        cleanFileName = path.basename(new URL(mediaUrl).pathname);
                    }

                    try { cleanFileName = decodeURIComponent(cleanFileName); } catch (e) { }
                    fileName = cleanFileName || 'media_file';

                    // Construct Absolute System Path
                    const uploadsDir = path.join(__dirname, '../uploads');
                    const absolutePath = path.isAbsolute(fileName) ? fileName : path.join(uploadsDir, fileName);

                    if (!fs.existsSync(absolutePath)) {
                        throw new Error(`Arquivo não encontrado no disco: ${absolutePath}`);
                    }

                    // READ BINARY -> BASE64
                    const buffer = fs.readFileSync(absolutePath);
                    base64Data = buffer.toString('base64');

                    // Determine MIME
                    const ext = path.extname(fileName).toLowerCase();
                    const mimeMap: Record<string, string> = {
                        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
                        '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'
                    };
                    mimeType = mimeMap[ext] || 'application/octet-stream';

                    console.log(`[sendWhatsAppMessage] Local file loaded: ${fileName} (${buffer.length} bytes)`);
                } catch (err: any) {
                    console.error(`[sendWhatsAppMessage] Local read error:`, err);
                    return { success: false, error: `Mídia inválida ou inexistente: ${err.message}` };
                }
            } else {
                // REMOTE MEDIA -> FETCH AND CONVERT TO BASE64
                // This ensures Evolution doesn't need to reach back to us if it's on a different network
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s download timeout

                    const remoteResp = await fetch(mediaUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!remoteResp.ok) throw new Error(`HTTP ${remoteResp.status}`);

                    const buffer = Buffer.from(await remoteResp.arrayBuffer());
                    base64Data = buffer.toString('base64');
                    fileName = path.basename(new URL(mediaUrl).pathname) || 'remote_file';
                    mimeType = remoteResp.headers.get('content-type') || 'application/octet-stream';

                    console.log(`[sendWhatsAppMessage] Remote file downloaded and encoded: ${fileName}`);
                } catch (err: any) {
                    console.error(`[sendWhatsAppMessage] Remote fetch error:`, err);
                    return { success: false, error: `Erro ao baixar mídia externa: ${err.message}` };
                }
            }

            // 2. CONSTRUCT PAYLOAD
            bodyPayload = JSON.stringify({
                number: cleanPhone,
                media: base64Data,
                fileName: fileName,
                caption: message || '',
                mediatype: mediaType || mimeType.split('/')[0] || 'image'
            });

            // Cleanup base64 from memory reference as soon as possible
            base64Data = '';

        } else {
            // === TEXT FLOW (JSON) ===
            targetUrl = `${baseUrl}/message/sendText/${evolution_instance}`;
            headers['Content-Type'] = 'application/json';
            bodyPayload = JSON.stringify({
                number: cleanPhone,
                options: {
                    delay: 1200,
                    presence: "composing",
                    linkPreview: false
                },
                textMessage: { text: message },
                text: message
            });
        }

        // 3. LOG PAYLOAD (Technical Log)
        console.log(`[sendWhatsAppMessage] POST ${targetUrl}`);
        if (mediaUrl) {
            console.log(`[sendWhatsAppMessage] Mode: MULTIPART/FORM-DATA`);
        } else {
            console.log(`[sendWhatsAppMessage] Mode: JSON`);
            console.log(bodyPayload);
        }

        // 4. Send Request
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: headers,
            body: bodyPayload
        });

        let responseText = await response.text();

        // 5. Check response and fallback
        if (!response.ok) {
            console.log(`[sendWhatsAppMessage] Initial request failed (${response.status}): ${responseText}`);

            // Fallback strategy: If 404 on sendMedia, try sendImage for images
            if (response.status === 404 && mediaUrl && bodyPayload instanceof FormData) {
                const safeMediaType = mediaType?.toLowerCase() || 'image';
                if (safeMediaType === 'image') {
                    console.log(`[sendWhatsAppMessage] 404 on sendMedia. Retrying with sendImage...`);
                    const retryUrl = `${baseUrl}/message/sendImage/${evolution_instance}`;

                    // Must recreate fetch with same payload
                    const retryResp = await fetch(retryUrl, { method: 'POST', headers, body: bodyPayload });
                    const retryText = await retryResp.text();

                    if (retryResp.ok) {
                        console.log(`[sendWhatsAppMessage] Retry with sendImage success!`);
                        responseText = retryText;
                    } else {
                        return { success: false, error: `Evolution Error (Retry sendImage): ${retryText}` };
                    }
                } else {
                    return { success: false, error: `Evolution Error (${response.status}): ${responseText}` };
                }
            } else {
                return { success: false, error: `Evolution Error (${response.status}): ${responseText}` };
            }
        }

        console.log(`[sendWhatsAppMessage] Response Body: ${responseText.substring(0, 500)}`);

        let data: any = {};
        try {
            data = JSON.parse(responseText);
        } catch (e) { }

        const remoteJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

        // Sync with Atendimento (Database updates)
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
                 SET last_message = $1, last_message_at = NOW(), status = 'PENDING', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3), last_message_source = $5
                 WHERE id = $4`,
                [message, userId, companyId, conversationId, source]
            );
        } else {
            const newConv = await pool.query(
                `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id, last_message_source) 
                 VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, NOW(), $7, $8) RETURNING id`,
                [remoteJid, cleanPhone, contactName || cleanPhone, evolution_instance, userId, message, companyId, source]
            );
            conversationId = newConv.rows[0].id;
        }

        const externalMessageId = data?.key?.id || data?.id || 'unknown';
        const insertedMsg = await pool.query(
            'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, media_url, message_type, campaign_id, follow_up_id, company_id, message_source, message_origin, sent_by_user_name) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            [conversationId, 'outbound', message, 'sent', externalMessageId, userId, mediaUrl || null, mediaType || 'text', campaignId || null, followUpId || null, companyId, source || 'evolution_api', source || 'evolution_api', userName || (campaignId ? 'Campanha' : (followUpId ? 'Follow-Up' : null))]
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
                agent_name: insertedMsg.rows[0].sent_by_user_name,
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
