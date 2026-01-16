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
        console.log(`[sendWhatsAppMessage] Sending to ${cleanPhone} via instance ${evolution_instance}. Media: ${mediaUrl ? 'YES' : 'NO'}`);

        let targetUrl = '';
        let headers: any = {
            'apikey': evolution_apikey
        };
        let bodyPayload: any = null;

        // === MEDIA FLOW (Multipart/Form-Data) ===
        if (mediaUrl) {
            targetUrl = `${baseUrl}/message/sendMedia/${evolution_instance}`;

            // Note: When using FormData with fetch in Node, consistent boundary handling is key.
            // Native global FormData works in Node 18+

            const formData = new FormData();
            formData.append('number', cleanPhone);
            formData.append('caption', message || ''); // Evolution expects 'caption'

            // Handling Valid Media Types
            const safeMediaType = mediaType?.toLowerCase() || 'image';
            formData.append('mediatype', safeMediaType);

            const isLocalUrl = mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1') || mediaUrl.startsWith('http://192.') || mediaUrl.startsWith('http://10.');
            const isRelative = !mediaUrl.startsWith('http');

            let fileBlob: Blob;
            let fileName = 'file';

            if (isLocalUrl || isRelative) {
                console.log(`[sendWhatsAppMessage] Local media detected. Reading from disk: ${mediaUrl}`);
                try {
                    // Extract filename
                    const urlPath = mediaUrl.split('?')[0];
                    fileName = path.basename(urlPath) || 'media_file';

                    const ups = path.join(__dirname, '../uploads');
                    const possibleLocalPath = path.join(ups, fileName);

                    if (!fs.existsSync(possibleLocalPath)) {
                        throw new Error(`File not found at ${possibleLocalPath}`);
                    }

                    const buffer = fs.readFileSync(possibleLocalPath);
                    // Determine mime type manually or default
                    const ext = path.extname(fileName).toLowerCase();
                    let mime = 'application/octet-stream';
                    if (['.jpg', '.jpeg'].includes(ext)) mime = 'image/jpeg';
                    else if (ext === '.png') mime = 'image/png';
                    else if (ext === '.webp') mime = 'image/webp';
                    else if (ext === '.mp4') mime = 'video/mp4';
                    else if (ext === '.pdf') mime = 'application/pdf';

                    fileBlob = new Blob([buffer], { type: mime });
                    console.log(`[sendWhatsAppMessage] File loaded: ${fileName} (${buffer.length} bytes, ${mime})`);

                } catch (readErr: any) {
                    console.error(`[sendWhatsAppMessage] Failed to read local file:`, readErr);
                    return { success: false, error: `Erro ao ler arquivo local: ${readErr.message}` };
                }
            } else {
                console.log(`[sendWhatsAppMessage] Remote media detected. Fetching: ${mediaUrl}`);
                try {
                    const mediaResp = await fetch(mediaUrl);
                    if (!mediaResp.ok) throw new Error(`Failed to fetch media: ${mediaResp.status}`);
                    fileBlob = await mediaResp.blob();
                    fileName = path.basename(mediaUrl.split('?')[0]) || 'downloaded_media';
                } catch (fetchErr: any) {
                    console.error(`[sendWhatsAppMessage] Failed to download remote file:`, fetchErr);
                    return { success: false, error: `Erro ao baixar mídia externa: ${fetchErr.message}` };
                }
            }

            // Append the file (3rd arg is filename)
            formData.append('media', fileBlob, fileName);

            bodyPayload = formData;

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
                text: message // Redundant but safe
            });
        }

        // 3. LOG PAYLOAD (Technical Log)
        console.log(`[sendWhatsAppMessage] POST ${targetUrl}`);
        if (mediaUrl) {
            console.log(`[sendWhatsAppMessage] Mode: MULTIPART/FORM-DATA`);
            // Cannot easily stringify FormData, logging keys presence
            // @ts-ignore
            if (bodyPayload && typeof bodyPayload.forEach === 'function') {
                // @ts-ignore
                bodyPayload.forEach((value, key) => {
                    if (key === 'media') console.log(`  ${key}: [Binary Blob]`);
                    else console.log(`  ${key}: ${value}`);
                });
            }
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

                    // Need to create new FormData or reuse? Fetch usually consumes body if it's a stream, but Blob-based FormData is reusable.
                    // Making a request again.
                    const retryResp = await fetch(retryUrl, { method: 'POST', headers, body: bodyPayload });
                    const retryText = await retryResp.text();

                    if (retryResp.ok) {
                        console.log(`[sendWhatsAppMessage] Retry with sendImage success!`);
                        responseText = retryText; // Update response text for success processing
                    } else {
                        // Retry failed
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

        const externalMessageId = data?.key?.id || data?.id || 'unknown';
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
