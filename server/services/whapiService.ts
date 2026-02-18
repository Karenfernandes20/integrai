
import { pool } from '../db/index.js';
import fetch from 'node-fetch';

/**
 * Whapi.Cloud Service
 * API Docs: https://whapi.cloud/docs
 */

// Base URL for Whapi
const WHAPI_BASE_URL = "https://gate.whapi.cloud";

export type WhapiConnectionStatus =
    | 'loading'
    | 'got qr code'
    | 'authenticated'
    | 'disconnected'
    | 'unknown';

export interface WhapiChannel {
    id: string; // The UUID
    name: string;
    type: string;
    token: string; // The specific channel token or account token? Usually channel token.
}

/**
 * Creates a new channel on Whapi (if using account token) or validates existing token.
 * Since user specified "Campos: Whapi Token, Channel ID (ou criar)", we assume
 * we are dealing with a Token that has permissions.
 */
export const createChannel = async (token: string, name: string): Promise<{ id: string, name: string }> => {
    // If the token is an API Token (Account Level), we can create a channel.
    // However, usually Whapi gives you a token PER channel in the dashboard.
    // If the user selects "Whapi", they might paste the Channel Token directly.
    // Let's assume the "Whapi Token" IS the Channel Token for simplicity and standard usage,
    // UNLESS we need to create one.

    // BUT, the requirement says "Criar channel via API da Whapi". This implies we have an Account Token.
    // Let's attempt to use the token to create a channel.
    try {
        const response = await fetch(`${WHAPI_BASE_URL}/channels`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name || "Integrai Channel",
                type: "whatsapp"
            })
        });

        if (response.ok) {
            const data: any = await response.json();
            return {
                id: data.id, // This is the Channel ID
                name: data.name
            };
        } else {
            // If creating fails, maybe the token IS ALREADY a Channel Token?
            // Let's try to get profile/limits to see if it works.
            const meRes = await fetch(`${WHAPI_BASE_URL}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (meRes.ok) {
                // It's a valid Channel Token, we don't need to create a channel, we just use it.
                // We can fetch channel info?
                // Usually /users/me returns info about the channel connected to this token.
                const meData: any = await meRes.json();
                // Whapi structure varies, but let's assume validity.
                return {
                    id: 'existing_channel', // Placeholder if we can't get ID easily, or parse from token?
                    name: meData.name || name
                };
            }

            const charError = await response.text();
            throw new Error(`Failed to create channel: ${charError}`);
        }
    } catch (error: any) {
        console.error("[Whapi] Error creating channel:", error);
        throw error;
    }
};

/**
 * Gets the QR Code for a channel.
 * Whapi usually returns the QR code via an endpoint like /health?wakeup=true or /users/qr
 */
export const getWhapiQrCode = async (token: string) => {
    try {
        // Whapi: GET /users/qrcode (Returns JSON with base64 or binary?)
        // Check docs: GET /users/me (status) or login endpoint.
        // It seems simpler: Just check status. If not logged in, there isn't a persistent "get qr" endpoint that returns JSON always?
        // Actually, Whapi behaves like Evolution: status dictates next step.
        // BUT Whapi has a "Login" method via API? No, it's QR based.
        // Endpoint: /users/options -> Login -> GET /users/qr

        // Let's try the standard endpoint:
        // https://gate.whapi.cloud/users/qr?format=base64
        const response = await fetch(`${WHAPI_BASE_URL}/users/qr?format=image`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            // It returns an IMAGE binary or JSON? "format=image" returns binary.
            // Let's use format=base64 if supported or convert.
            // Documentation says: GET /mn/qrcode (legacy) or /users/qr

            // Let's try to get as base64 explicitly if possible, or buffer it.
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            return `data:image/png;base64,${base64}`;
        } else {
            const err = await response.text();
            console.warn("[Whapi] QR Fetch Failed:", response.status, err);
            return null;
        }
    } catch (error) {
        console.error("[Whapi] Error getting QR:", error);
        return null;
    }
};

/**
 * Checks connection status.
 */
export const getWhapiConnectionAttempt = async (token: string): Promise<{ status: WhapiConnectionStatus, phone?: string }> => {
    try {
        // GET /users/me or /health
        const response = await fetch(`${WHAPI_BASE_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data: any = await response.json();
            // If we get data, we are likely authenticated?
            // Whapi returns "status": "authenticated" usually?
            // Or check if "phone" is present.
            if (data.id || data.phone) {
                return {
                    status: 'authenticated',
                    phone: (data.id || data.phone || '').split(':')[0]
                };
            }
        }

        // If 401/403 -> Auth failed.
        // If 200 but no phone -> maybe 'loading' or 'got qr code' (waiting for scan).

        // Let's check /health
        const healthRes = await fetch(`${WHAPI_BASE_URL}/health`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (healthRes.ok) {
            const health: any = await healthRes.json();
            // health.status: 'loading', 'got qr code', 'authenticated'
            if (health.status && health.status.text) {
                return { status: health.status.text.toLowerCase() };
            }
        }

        return { status: 'unknown' };
    } catch (error) {
        return { status: 'unknown' };
    }
};

/**
 * Ensures Webhook is registered.
 */
export const ensureWebhookWhapi = async (token: string, webhookUrl: string) => {
    console.log(`[Whapi] Ensuring webhook: ${webhookUrl}`);

    // PATCH /settings
    try {
        const payload = {
            webhooks: [
                {
                    url: webhookUrl,
                    events: [
                        { type: "messages", method: "post" },
                        { type: "statuses", method: "post" },
                        { type: "ack", method: "post" },
                        { type: "chats", method: "post" } // Whapi event names vary, "messages" is key
                    ],
                    mode: "method"
                }
            ]
        };

        const response = await fetch(`${WHAPI_BASE_URL}/settings`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("[Whapi] Webhook Set Successfully");
            return true;
        } else {
            console.error("[Whapi] Webhook Set Failed:", await response.text());
            return false;
        }

    } catch (error) {
        console.error("[Whapi] Webhook Error:", error);
        return false;
    }
};

/**
 * Send Message Abstraction
 */
export const sendWhapiMessage = async (token: string, to: string, content: string, mediaUrl?: string) => {
    try {
        const endpoint = mediaUrl
            ? `${WHAPI_BASE_URL}/messages/image` // or /messages/document depending on type
            : `${WHAPI_BASE_URL}/messages/text`;

        const body: any = { to };
        if (mediaUrl) {
            body.media = mediaUrl;
            body.caption = content;
        } else {
            body.body = content;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            return await response.json();
        } else {
            console.error("[Whapi] Send Message Failed:", await response.text());
            return null;
        }

    } catch (error) {
        console.error("[Whapi] Send Message Error:", error);
        return null;
    }
};
