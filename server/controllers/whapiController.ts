
import { Request, Response } from 'express';
import { pool } from '../db/index.js';
import {
    createChannel,
    getWhapiQrCode,
    ensureWebhookWhapi,
    sendWhapiMessage,
    getWhapiConnectionAttempt
} from '../services/whapiService.js';
import { processIncomingMessage } from './messageProcessor.js';
import { resolveCompanyByInstanceKey } from '../utils/evolutionUtils.js';

/**
 * Controller for Whapi interactions
 * Replicates the "flow" of Evolution but adapted for Whapi
 */

export const getWhapiQrCodeController = async (req: Request, res: Response) => {
    // Expected params: companyId, token (provider logic usually passes token)
    // Actually, user said: "Campos necessários: Whapi Token, Channel ID".
    // So the frontend should send "token" and maybe "channelId" in body or query?
    // Let's assume generic structure similar to Evolution: instanceKey is passed as query.
    // BUT for Whapi, we need the Token first. "instanceKey" will become "Channel ID" essentially.

    // Scenario: User clicks "Connect". They input Token.
    // If they input token, we should save it? Or use it to generate QR.

    const { companyId, token } = req.body; // Assuming POST for connection init due to sensitive token
    // OR GET /qrcode?companyId=1&token=... (less secure but follows pattern)
    // Let's support POST for security or Query if needed.

    const apiToken = token || req.query.token as string;
    const targetCompanyId = companyId || req.query.companyId;

    if (!apiToken || !targetCompanyId) {
        return res.status(400).json({ error: "Company ID and Whapi Token are required" });
    }

    try {
        // 1. Create/Get Channel (If creation needed) or Just Get QR
        // We assume token IS the API Token that allows acting on the channel (or account).

        // Actually, if we follow the flow:
        // A. Create/Verify Channel
        // B. Get QR

        // Let's try to get QR directly.
        const qrCode = await getWhapiQrCode(apiToken);

        if (!qrCode) {
            return res.status(500).json({ error: "Failed to fetch QR Code from Whapi. Check token." });
        }

        // Return QR
        // Also we might want to ensure the instance is recorded in DB as "whapi" provider.
        if (pool) {
            // Upsert into company_instances
            // What is the "instance_key"? For Whapi it is the Channel ID? 
            // We can fetch channel ID via /users/me
            const conn = await getWhapiConnectionAttempt(apiToken);
            // We don't have ID easily unless authenticated?
            // Let's use a hashed token or transient ID if strictly QR phase?
            // NO, we should probably have a persistent ID.
            // If user provided a "Channel ID", use it.
            // If not, we might need one.

            // Let's assume we update the company instance record if it exists or create one.
            // For now, just return QR. The frontend will poll connection status.
        }

        return res.json({
            qrcode: qrCode,
            type: 'whapi'
        });

    } catch (error: any) {
        console.error("[Whapi Controller] QR Error:", error);
        return res.status(500).json({ error: error.message });
    }
};

export const handleWhapiWebhook = async (req: Request, res: Response) => {
    // Whapi sends POST payload
    // We need to identify the instance. 
    // Usually Whapi webhook URL contains params or we look at the payload channel_id?
    // Payload usually has { channel_id: "...", messages: [...] }

    const body = req.body;

    // Whapi Structure check
    // "messages": [ ... ]
    // "channel_id": "..." (sometimes at root or inside objects?)
    // Documentation says root level "messages" array.
    // And "channel_id" might NOT be in body if strict webhook setting?
    // User configured webhook: /api/whapi/webhook?companyId=...&instanceId=...
    // Or we expect header?

    // Let's try to extract identification from BODY or QUERY (if set in webhook url)
    const queryInstance = req.query.instance as string;
    const queryCompanyId = req.query.companyId as string;

    console.log("[Whapi Webhook] Received payload");

    try {
        const messages = body.messages || [];
        // Loop messages
        for (const msg of messages) {
            // Map Whapi Message -> Internal Structure
            // internal: { key: { remoteJid, fromMe }, message: { ... }, pushName }

            const isFromMe = msg.from_me;
            const chatId = msg.chat_id; // "123123@s.whatsapp.net"
            const text = msg.text?.body;
            const type = msg.type; // "text", "image", etc.
            const senderName = msg.from_name;

            // Construct mock payload for processIncomingMessage
            const internalMsg = {
                key: {
                    remoteJid: chatId,
                    fromMe: isFromMe,
                    id: msg.id
                },
                pushName: senderName,
                messageType: type === 'text' ? 'conversation' : (type + 'Message'),
                message: {}
            };

            // Content Mapping
            if (type === 'text') {
                (internalMsg.message as any).conversation = text;
            } else if (type === 'image') {
                (internalMsg.message as any).imageMessage = {
                    caption: msg.caption,
                    url: msg.link // Whapi provides link?
                };
            }
            // Add other types as needed

            // Identification
            // If we have query params, use them.
            // If not, we rely on channel_id from body? Unreliable in standard docs sometimes.
            // Let's assume we set the webhook URL with instance info: /api/whapi/webhook/:instanceKey

            const instanceKey = req.params.instanceKey || queryInstance;

            if (instanceKey && pool) {
                // Resolve company
                const company = await resolveCompanyByInstanceKey(instanceKey);
                if (company) {
                    await processIncomingMessage(company.id, instanceKey, internalMsg);
                }
            }
        }

        return res.status(200).send('OK');
    } catch (e) {
        console.error(e);
        return res.status(500).send('Error');
    }
};

/**
 * Connect/Save Instance
 */
export const connectWhapiInstance = async (req: Request, res: Response) => {
    const { companyId, token, name } = req.body;

    if (!companyId || !token) return res.status(400).json({ error: "Missing fields" });

    try {
        // 1. Verify Connection
        const conn = await getWhapiConnectionAttempt(token);
        // If connected or loading, we proceed to save.

        // 2. Determine Channel ID (Use truncated token or validation result)
        // If authenticated, we get the ID.
        // If not, we might generate a handle.
        const instanceKey = name || `whapi_${Date.now()}`;

        // 3. Save to DB
        // provider = 'whapi'
        if (pool) {
            await pool.query(`
                INSERT INTO company_instances (company_id, name, instance_key, api_key, status, provider, whapi_token)
                VALUES ($1, $2, $3, $4, $5, 'whapi', $6)
                ON CONFLICT (instance_key, company_id) DO UPDATE SET
                    api_key = EXCLUDED.api_key,
                    whapi_token = EXCLUDED.whapi_token,
                    provider = 'whapi',
                    updated_at = NOW()
            `, [companyId, name, instanceKey, token, 'connecting', token]);

            // 4. Ensure Webhook immediately
            const protocol = req.protocol === 'http' ? 'http' : 'https'; // careful with proxy
            const host = req.get('host');
            const backendUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
            const webhookUrl = `${backendUrl}/api/whapi/webhook/${instanceKey}`;

            ensureWebhookWhapi(token, webhookUrl).catch(e => console.error(e));

            return res.json({ success: true, instanceKey });
        }
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
};
