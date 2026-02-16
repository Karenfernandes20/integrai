import { Request, Response } from "express";
import { pool } from "../db/index.js";
import { logEvent } from "../logger.js";
import { normalizePhone, extractPhoneFromJid } from "../utils/phoneUtils.js";
import { sendInstagramMessage } from "../services/instagramService.js";

/**
 * Evolution API controller
 *
 * GET /api/evolution/qrcode
 *
 * Usa EVOLUTION_API_URL e EVOLUTION_API_KEY para chamar
 * GET {EVOLUTION_API_URL}/instance/connect/integrai
 * e retorna o QR Code (base64) para o frontend.
 */

// Helper to get Evolution Config based on User Context
const DEFAULT_URL = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
const GLOBAL_API_KEY = "5A44C72AAB33-42BD-968A-27EB8E14BE6F";

/**
 * STRICT Instance Resolver for SaaS Multi-tenant
 */
export async function resolveInstanceByCompany(companyId: number) {
  if (!companyId) {
    throw new Error("Company ID is required to resolve instance");
  }
  if (!pool) throw new Error("Database not configured");

  // 1. Check company_instances table for an active/open instance
  const instRes = await pool.query(
    'SELECT instance_key, api_key FROM company_instances WHERE company_id = $1 AND status = \'open\' LIMIT 1',
    [companyId]
  );

  if (instRes.rows.length > 0) {
    return {
      instance_key: instRes.rows[0].instance_key,
      api_key: instRes.rows[0].api_key
    };
  }

  // 2. Fallback to main company record
  const compRes = await pool.query(
    'SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1',
    [companyId]
  );

  if (compRes.rows.length > 0 && compRes.rows[0].evolution_instance) {
    return {
      instance_key: compRes.rows[0].evolution_instance,
      api_key: compRes.rows[0].evolution_apikey
    };
  }

  throw new Error(`No active instance found for company ${companyId}`);
}

export const getEvolutionConfig = async (user: any, source: string = 'unknown', targetCompanyId?: number | string, targetInstanceKey?: string) => {
  // Base configuration from env (fallback for URL/Key only)
  let config = {
    url: (process.env.EVOLUTION_API_URL || DEFAULT_URL).replace(/['"]/g, "").replace(/\/$/, ""),
    apikey: (process.env.EVOLUTION_API_KEY || GLOBAL_API_KEY).replace(/['"]/g, ""),
    instance: "", // NO DEFAULT INSTANCE
    company_id: null as number | null
  };

  if (!pool) return config;

  try {
    let resolvedCompanyId: number | null = null;
    if (targetCompanyId) {
      resolvedCompanyId = Number(targetCompanyId);
    } else if (user?.company_id) {
      resolvedCompanyId = Number(user.company_id);
    }

    if (!resolvedCompanyId) {
      console.warn(`[Evolution Config] Could not resolve company_id for source: ${source}`);
      return config;
    }

    config.company_id = resolvedCompanyId;

    // 1. Fetch Company Specific URL
    const urlRes = await pool.query('SELECT evolution_url FROM companies WHERE id = $1', [resolvedCompanyId]);
    if (urlRes.rows.length > 0 && urlRes.rows[0].evolution_url) {
      config.url = urlRes.rows[0].evolution_url.replace(/['"]/g, "").replace(/\/$/, "");
    }

    // 2. Resolve Instance
    if (targetInstanceKey) {
      // Find specific requested instance
      const instRes = await pool.query(
        'SELECT instance_key, api_key FROM company_instances WHERE instance_key = $1 AND company_id = $2',
        [targetInstanceKey, resolvedCompanyId]
      );
      if (instRes.rows.length > 0) {
        config.instance = instRes.rows[0].instance_key;
        if (instRes.rows[0].api_key && instRes.rows[0].api_key.length > 10) {
          config.apikey = instRes.rows[0].api_key;
        }
        return config;
      }
    }

    // Auto-resolve if not specified or not found in company_instances
    try {
      const resolved = await resolveInstanceByCompany(resolvedCompanyId);
      config.instance = resolved.instance_key;
      if (resolved.api_key && resolved.api_key.length > 10) {
        config.apikey = resolved.api_key;
      }
    } catch (e: any) {
      console.warn(`[Evolution Config] Auto-resolve failed for company ${resolvedCompanyId}: ${e.message}`);
      // If we can't resolve an instance, we should probably not return a half-baked config
      // But for backward compatibility we return what we have (url/apikey) and empty instance
    }

    if (!config.instance) {
      console.error(`[Evolution Config] CRITICAL: No instance resolved for company ${resolvedCompanyId} (Source: ${source})`);
    }

    return config;
  } catch (err: any) {
    console.error("[Evolution Config Error]", err);
    return config;
  }
};

export const resolveEvolutionConfig = async ({
  instanceKey,
  companyId,
  user,
  source = 'unknown'
}: {
  instanceKey?: string;
  companyId: number;
  user?: any;
  source?: string;
}) => {
  if (!companyId) {
    throw new Error('companyId is required to resolve evolution config');
  }

  return getEvolutionConfig(user || { company_id: companyId }, source, companyId, instanceKey);
};
const isUsableGroupTitle = (value?: string | null): boolean => {
  if (!value) return false;
  const name = String(value).trim();
  if (!name) return false;
  if (/@g\.us$/i.test(name)) return false;
  if (/@s\.whatsapp\.net$/i.test(name)) return false;
  if (/^\d{8,16}$/.test(name)) return false;
  return true;
};

const resolveStoredGroupTitle = async (
  companyId: number | null,
  remoteJid: string
): Promise<string | null> => {
  if (!pool || !companyId || !remoteJid) return null;
  try {
    const contactRes = await pool.query(
      `SELECT name, push_name
       FROM whatsapp_contacts
       WHERE company_id = $1
         AND (jid = $2 OR jid = REPLACE($2, '@g.us', '@s.whatsapp.net'))
       ORDER BY updated_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [companyId, remoteJid]
    );

    const contactName = contactRes.rows[0]?.name;
    const pushName = contactRes.rows[0]?.push_name;
    if (isUsableGroupTitle(contactName)) return String(contactName).trim();
    if (isUsableGroupTitle(pushName)) return String(pushName).trim();
  } catch (err) {
    console.warn("[Evolution] Failed to resolve stored group title:", err);
  }
  return null;
};

const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_SET",
  "MESSAGES_RECEIVE",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONNECTION_UPDATE",
  "TYPEING_START",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
  "PRESENCE_UPDATE"
];

const refreshLock = new Map<string, true>();

export const getEvolutionQrCode = async (req: Request, res: Response) => {
  const targetCompanyId = req.query.companyId as string;
  const targetInstanceKey = req.query.instanceKey as string;
  const config = await getEvolutionConfig((req as any).user, 'qrcode_connect', targetCompanyId, targetInstanceKey);

  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      return res.status(500).json({
        error: "Evolution API not configured for this context",
        missing: {
          url: !EVOLUTION_API_URL,
          key: !EVOLUTION_API_KEY,
          instance: !EVOLUTION_INSTANCE
        },
      });
    }

    // Prepare connection URL
    // SANITIZE INSTANCE NAME: Evolution API doesn't like spaces
    const sanitizedInstance = EVOLUTION_INSTANCE.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const connectUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/connect/${sanitizedInstance}`;
    console.log(`[Evolution] Fetching QR Code from: ${connectUrl}`);

    const response = await fetch(connectUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Evolution] QR Code Fetch Failed. Status: ${response.status}`, errorText.slice(0, 200));

      // Auto-Create Logic if 404
      if (response.status === 404) {
        console.log(`[Evolution] Instance ${sanitizedInstance} not found (404). Attempting to create it...`);

        const createUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/create`;
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // For creation, we try the provided key first (if user provided Global Key), then fallback
            apikey: EVOLUTION_API_KEY || process.env.EVOLUTION_API_KEY || GLOBAL_API_KEY
          },
          body: JSON.stringify({
            instanceName: sanitizedInstance,
            token: EVOLUTION_API_KEY, // Use the user-provided key as the instance token
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          })
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          console.log(`[Evolution] Instance ${EVOLUTION_INSTANCE} created successfully.`);

          // Return the data directly from creation as it usually mimics the connect response
          let qrCode = (createData.qrcode as string) || (createData.qr as string) || (createData.base64 as string) || (createData.code as string) || undefined;
          if (qrCode && !qrCode.startsWith('http') && !qrCode.startsWith('data:')) {
            qrCode = `data:image/png;base64,${qrCode}`;
          }

          // AUTO-REGISTER WEBHOOK immediately after creation
          try {
            let protocol = req.headers['x-forwarded-proto'] || req.protocol;
            let host = req.get('host');
            if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
              protocol = 'https';
            }
            const rawBackendUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
            const backendUrl = rawBackendUrl.replace(/\/$/, "");
            const webhookUrl = `${backendUrl}/api/evolution/webhook`;

            const wUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/set/${sanitizedInstance}`;
            fetch(wUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
              body: JSON.stringify({
                webhook: webhookUrl,
                enabled: true,
                webhook_by_events: false,
                events: WEBHOOK_EVENTS
              })
            }).catch(e => console.warn(`[Evolution Webhook Set Silent Fail]: ${e.message}`));
          } catch (e) { }

          return res.status(200).json({
            raw: createData,
            qrcode: qrCode,
            instance: sanitizedInstance,
            created_now: true
          });
        } else {
          const createErr = await createRes.text();
          console.error(`[Evolution] Failed to auto-create instance: ${createRes.status}`, createErr);
          // Return original 404 error details if creation failed
          return res.status(response.status).json({
            error: "Instance not found and auto-creation failed",
            details: createErr
          });
        }
      }

      console.error(`[Evolution] Error response from API: ${response.status}`, errorText);
      await logEvent({
        eventType: 'evolution_error',
        origin: 'evolution',
        status: 'error',
        message: `Erro ao gerar QR Code (${EVOLUTION_INSTANCE}): ${response.status}`,
        details: { status: response.status, body: errorText }
      });
      return res.status(response.status).json({
        error: "Evolution API error",
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    await logEvent({
      eventType: 'webhook_received', // Using a generic one or should use evolution_connect if existed
      origin: 'system',
      status: 'info',
      message: `QR Code solicitado para instância ${EVOLUTION_INSTANCE}`,
      details: { instance: EVOLUTION_INSTANCE }
    } as any);

    // AUTO-REGISTER WEBHOOK whenever we request a QR Code (to be sure)
    try {
      let protocol = req.headers['x-forwarded-proto'] || req.protocol;
      let host = req.get('host');
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        protocol = 'https';
      }
      const rawBackendUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
      const backendUrl = rawBackendUrl.replace(/\/$/, "");
      const webhookUrl = `${backendUrl}/api/evolution/webhook`;
      console.log(`[Evolution] Auto-registering Webhook for ${sanitizedInstance}: ${webhookUrl}`);

      const endpoints = [
        `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/set/${sanitizedInstance}`,
        `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/instance/${sanitizedInstance}`
      ];

      for (const wUrl of endpoints) {
        fetch(wUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            webhook: webhookUrl,
            enabled: true,
            webhook_by_events: false,
            events: WEBHOOK_EVENTS
          })
        }).catch(e => console.warn(`[Evolution Webhook Set Silent Fail]: ${e.message}`));
      }
    } catch (e) {
      console.warn("[Evolution] Webhook auto-registration failed silently", e);
    }

    console.log(`[Evolution Debug] Raw connect response for ${EVOLUTION_INSTANCE}:`, JSON.stringify(data, null, 2));

    // A API costuma retornar algo como { qrCode: "data:image/png;base64,..." } ou campos similares.
    let qrCode =
      (data.qrCode as string) ||
      (data.qrcode as string) ||
      (data.qr_code as string) ||
      (data.qr as string) ||
      (data.base64 as string) ||
      (data.code as string) ||
      (data.qr?.code as string) ||
      (data.qr?.base64 as string) ||
      undefined;

    // Se o QR Code vier sem o prefixo base64, adicionamos
    if (qrCode && !qrCode.startsWith('http') && !qrCode.startsWith('data:')) {
      qrCode = `data:image/png;base64,${qrCode}`;
    }

    return res.status(200).json({
      raw: data,
      qrcode: qrCode,
      instance: sanitizedInstance // Return instance name so frontend can show it
    });
  } catch (error: any) {
    console.error("Erro ao obter QR Code da Evolution API:", error);
    return res.status(500).json({
      error: "Internal server error while fetching Evolution QR code",
      details: error?.message || String(error),
      cause: error?.cause ? String(error.cause) : undefined
    });
  }
};

export const deleteEvolutionInstance = async (req: Request, res: Response) => {
  const targetCompanyId = req.query.companyId as string;
  const targetInstanceKey = req.query.instanceKey as string;
  const user = (req as any).user;

  try {
    console.log(`[Disconnect] Request for company ${targetCompanyId}, instance key "${targetInstanceKey}"`);

    // Fetch instance data directly first
    if (!pool) {
      return res.status(500).json({ error: "Database not configured" });
    }

    const instRes = await pool.query(
      'SELECT id, name, instance_key, api_key, company_id FROM company_instances WHERE instance_key = $1 AND company_id = $2',
      [targetInstanceKey, Number(targetCompanyId)]
    );

    console.log(`[Disconnect] Instance lookup result:`, instRes.rows);

    if (instRes.rows.length === 0) {
      return res.status(404).json({ error: `Instance "${targetInstanceKey}" not found for company ${targetCompanyId}` });
    }

    const instance = instRes.rows[0];
    console.log(`[Disconnect] Found instance:`, {
      id: instance.id,
      name: instance.name,
      api_key_exists: !!instance.api_key,
      api_key_length: instance.api_key?.length || 0
    });

    if (!instance.api_key || instance.api_key.length < 10) {
      return res.status(400).json({
        error: "Instance API Key not configured",
        details: `Instance "${instance.name}" (${instance.instance_key}) does not have a valid API Key configured`
      });
    }

    // Get company URL
    const companyRes = await pool.query('SELECT evolution_url FROM companies WHERE id = $1', [Number(targetCompanyId)]);
    let evolutionUrl = process.env.EVOLUTION_API_URL || "https://evolution.integrai.com.br";

    if (companyRes.rows.length > 0 && companyRes.rows[0].evolution_url) {
      evolutionUrl = companyRes.rows[0].evolution_url;
    }

    evolutionUrl = evolutionUrl.replace(/['"]/g, "").replace(/\/$/, "");

    const config = {
      url: evolutionUrl,
      apikey: instance.api_key,
      instance: instance.instance_key
    };

    console.log(`[Disconnect] Resolved config:`, {
      instance: config.instance,
      url: config.url,
      apikey_length: config.apikey.length
    });

    if (!config.url || !config.apikey) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    if (!config.instance) {
      return res.status(400).json({ error: "Instance name not found or invalid" });
    }

    const url = `${config.url}/instance/logout/${config.instance}`;
    console.log(`[Disconnect] Calling Evolution API: ${url}`);

    // Try with instance API key first
    let response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apikey,
      },
    });

    console.log(`[Disconnect] Evolution API response status: ${response.status}`);

    // If 401 Unauthorized, try with global API key as fallback
    if (response.status === 401) {
      console.log(`[Disconnect] Instance API Key unauthorized, trying with global key...`);

      const globalKey = process.env.EVOLUTION_API_KEY; // Assuming GLOBAL_API_KEY is process.env.EVOLUTION_API_KEY
      if (globalKey && globalKey !== config.apikey) {
        response = await fetch(url, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            apikey: globalKey,
          },
        });
        console.log(`[Disconnect] Global key attempt status: ${response.status}`);
      }
    }

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Disconnect] Instance ${config.instance} already disconnected (404)`);
        // Update DB status to disconnected
        await pool.query('UPDATE company_instances SET status = $1 WHERE id = $2', ['disconnected', instance.id]);
        return res.status(200).json({ message: "Instance was already disconnected", status: "success" });
      }

      const text = await response.text().catch(() => "No response body");
      console.error(`[Disconnect] Failed with status ${response.status}: ${text}`);

      let errorMessage = "Failed to disconnect instance from Evolution API";

      // Add specific message for 401
      if (response.status === 401) {
        errorMessage = "API Key não tem permissão para desconectar esta instância. Verifique se a API Key está correta.";
      } else {
        // Try to parse error details
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, use text directly if it's meaningful
          if (text && text.length > 0 && text.length < 200) {
            errorMessage = text;
          }
        }
      }

      return res.status(response.status).json({
        error: errorMessage,
        status: response.status,
        url: url,
        instance: config.instance
      });
    }

    const data = await response.json().catch(() => ({ success: true }));
    console.log(`[Disconnect] Success! Response:`, data);
    return res.status(200).json({ message: "Instance disconnected successfully", data });
  } catch (error: any) {
    console.error("[Disconnect] Error:", error);
    return res.status(500).json({
      error: "Internal server error while disconnecting instance",
      details: error?.message || String(error)
    });
  }
};

// ... existing imports

// ... existing imports
import { Readable } from 'stream';



export const getEvolutionConnectionState = async (req: Request, res: Response) => {
  const targetCompanyId = req.query.companyId as string;
  const targetInstanceKey = req.query.instanceKey as string;
  const config = await getEvolutionConfig((req as any).user, 'status_poll', targetCompanyId, targetInstanceKey);
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      // Silently fail or return unknown if not configured, to avoid spamming logs if just polling
      return res.json({ instance: EVOLUTION_INSTANCE, state: 'unknown' });
    }

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/connectionState/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
    });

    if (!response.ok) {
      // If 404, instance might not exist (created on connect)
      if (response.status === 404) {
        return res.json({ instance: EVOLUTION_INSTANCE, state: 'closed' });
      }
      return res.json({ instance: EVOLUTION_INSTANCE, state: 'unknown' });
    }

    const data = await response.json();
    // Evolution usually returns { instance: { state: 'open' | 'close' | 'connecting' ... } }
    const state = data?.instance?.state || data?.state;
    if (state && pool) {
      const lowerState = (state || '').toLowerCase();
      let status = 'disconnected';
      if (['open', 'connected', 'online'].includes(lowerState)) status = 'connected';
      else if (['connecting', 'pairing'].includes(lowerState)) status = 'connecting';

      pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', [status, EVOLUTION_INSTANCE])
        .catch(e => console.error('[Status Sync] Failed to update DB:', e));
    }
    return res.json(data);

  } catch (error: any) {
    // console.error("Error fetching connection state:", error); 
    // Suppress heavy logging for polling
    return res.json({ instance: EVOLUTION_INSTANCE, state: 'unknown' });
  }
};

import { checkLimit, incrementUsage } from '../services/limitService.js';

export const sendEvolutionMessage = async (req: Request, res: Response) => {
  const { companyId, instanceKey } = req.body;
  const config = await getEvolutionConfig((req as any).user, 'sendMessage', companyId, instanceKey);
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;
  const resolvedCompanyId = config.company_id;

  try {
    if (!resolvedCompanyId) {
      return res.status(403).json({ error: "Company context required for sending messages" });
    }

    if (!EVOLUTION_INSTANCE) {
      return res.status(400).json({ error: "No active WhatsApp instance found for this company" });
    }

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    // Limit Check
    if (resolvedCompanyId) {
      const allowed = await checkLimit(resolvedCompanyId, 'messages');
      if (!allowed) {
        console.warn(`[Evolution] Message limit reached for company ${resolvedCompanyId}`);
        return res.status(403).json({ error: 'Limite de mensagens atingido para este mês.' });
      }
    }

    const { phone, message, text, to, quoted, number, isGroup } = req.body;

    // Normalize fields (User asked for "text" but we support "message" too for backward compat, and "to" or "phone" or "number")
    let targetPhone = phone || to || number;
    const messageContent = text || message;

    if (!targetPhone || !messageContent) {
      return res.status(400).json({ error: "Phone (to) and text are required" });
    }

    if (typeof messageContent !== 'string' || messageContent.trim().length === 0) {
      return res.status(400).json({ error: "Message text cannot be empty" });
    }

    const explicitGroupFlag = isGroup === true || isGroup === 'true';
    const inferredGroup = explicitGroupFlag || (typeof targetPhone === 'string' && targetPhone.endsWith('@g.us'));

    // Determine Channel
    let channel = 'whatsapp';
    if (resolvedCompanyId && targetPhone && pool) {
      const convRes = await pool.query(
        'SELECT channel FROM whatsapp_conversations WHERE external_id = $1 AND company_id = $2',
        [targetPhone, resolvedCompanyId]
      );
      if (convRes.rows.length > 0) {
        channel = convRes.rows[0].channel || 'whatsapp';
      }
    }

    if (channel === 'instagram') {
      console.log(`[Instagram] Sending message to ${targetPhone} for company ${resolvedCompanyId}`);
      const igData = await sendInstagramMessage(resolvedCompanyId!, targetPhone, messageContent);

      // Persist Instagram message
      if (pool) {
        const user = (req as any).user;
        const convRes = await pool.query(
          'SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND company_id = $2',
          [targetPhone, resolvedCompanyId]
        );
        const conversationId = convRes.rows[0].id;

        const insertedMsg = await pool.query(
          `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, company_id, sent_by_user_id, sent_by_user_name, channel) 
           VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10) 
           RETURNING *`,
          [conversationId, 'outbound', messageContent, 'sent', igData.message_id || `ig-${Date.now()}`, user.id, resolvedCompanyId, user.id, user.full_name, 'instagram']
        );

        const resultPayload = {
          ...insertedMsg.rows[0],
          databaseId: insertedMsg.rows[0].id,
          conversationId,
          content: messageContent,
          direction: 'outbound',
          sent_at: insertedMsg.rows[0].sent_at,
          user_id: user.id,
          agent_name: user.full_name,
          phone: targetPhone,
          channel: 'instagram'
        };

        const io = req.app.get('io');
        if (io && resolvedCompanyId) {
          io.to(`company_${resolvedCompanyId}`).emit('message:received', resultPayload);
        }

        return res.status(200).json(resultPayload);
      }
      return res.status(200).json(igData);
    }

    // Ensure correct JID format for WhatsApp
    if (targetPhone && !targetPhone.includes('@')) {
      if (inferredGroup) {
        targetPhone = `${targetPhone}@g.us`;
      } else {
        targetPhone = `${targetPhone}@s.whatsapp.net`;
      }
    }

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendText/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: targetPhone,
        options: {
          delay: 1200,
          presence: "composing",
        },
        textMessage: {
          text: messageContent,
        },
        quoted: quoted, // Support for replying
        text: messageContent, // Fallback for some versions/endpoints requiring root text
        message: messageContent // Fallback for older versions
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => undefined);
      return res.status(response.status).json({
        error: "Failed to send message",
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();

    // Persist sent message to database immediately
    if (pool) {
      try {
        console.log(`[Evolution] Attempting to save sent message to DB for ${targetPhone} (Instance: ${EVOLUTION_INSTANCE})`);

        // Basic normalization of remoteJid
        const safePhone = targetPhone || "";
        const remoteJid = safePhone; // Already normalized above
        const messageIsGroup = remoteJid.endsWith('@g.us') || inferredGroup;
        const user = (req as any).user;
        const resolvedCompanyId = config.company_id;

        const conversationPhone = messageIsGroup ? remoteJid : safePhone;
        const resolvedGroupTitle = messageIsGroup
          ? (await resolveStoredGroupTitle(resolvedCompanyId, remoteJid)) || "Grupo"
          : null;

        // Find or create conversation
        let conversationId: number;

        // CHECK INSTANCE AND COMPANY isolation
        const checkConv = await pool.query(
          'SELECT id, status, user_id, is_group, group_name FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2 AND company_id = $3',
          [remoteJid, EVOLUTION_INSTANCE, resolvedCompanyId]
        );

        if (checkConv.rows.length > 0) {
          conversationId = checkConv.rows[0].id;
          // Update status to OPEN if it was PENDING/null, assign user if unassigned, and update last_message metadata
          await pool.query(
            `UPDATE whatsapp_conversations 
             SET last_message = $1, last_message_at = NOW(), status = 'OPEN', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3),
                 is_group = CASE WHEN $5 THEN true ELSE is_group END,
                 group_name = CASE
                   WHEN $5 THEN COALESCE(NULLIF(group_name, external_id), $6, group_name, 'Grupo')
                   ELSE group_name
                 END,
                 contact_name = CASE
                   WHEN $5 THEN COALESCE(NULLIF(contact_name, external_id), $6, contact_name, 'Grupo')
                   ELSE contact_name
                 END
             WHERE id = $4`,
            [messageContent, user.id, resolvedCompanyId, conversationId, messageIsGroup, resolvedGroupTitle]
          );
        } else {
          // Create new conversation as OPEN and assigned to the sender
          const newConv = await pool.query(
            `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id, is_group, group_name) 
             VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, NOW(), $7, $8, $9) RETURNING id`,
            [
              remoteJid,
              conversationPhone,
              messageIsGroup ? resolvedGroupTitle : conversationPhone,
              EVOLUTION_INSTANCE,
              user.id,
              messageContent,
              resolvedCompanyId,
              messageIsGroup,
              messageIsGroup ? resolvedGroupTitle : null
            ]
          );
          conversationId = newConv.rows[0].id;
        }

        const externalMessageId = data?.key?.id;

        // Insert message WITH USER_ID and company_id, handling race condition with webhook
        // If webhook inserted first (user_id=null), this will update it.
        const insertedMsg = await pool.query(
          `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, company_id, sent_by_user_id, sent_by_user_name) 
           VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9) 
           ON CONFLICT (external_id) DO UPDATE 
           SET user_id = EXCLUDED.user_id, company_id = EXCLUDED.company_id, 
               sent_by_user_id = EXCLUDED.sent_by_user_id, sent_by_user_name = EXCLUDED.sent_by_user_name 
           RETURNING *`,
          [conversationId, 'outbound', messageContent, 'sent', externalMessageId, user.id, resolvedCompanyId, user.id, user.full_name]
        );

        const row = insertedMsg.rows[0];
        console.log(`[Evolution] Saved/Updated message in DB with ID: ${row.id}.`);

        // Include the DB ID and external ID in the response so frontend can use them
        const resultPayload = {
          ...row,
          databaseId: row.id,
          conversationId: conversationId,
          content: messageContent,
          direction: 'outbound',
          sent_at: row.sent_at || new Date().toISOString(),
          user_id: user.id,
          agent_name: user.full_name,
          phone: conversationPhone,
          remoteJid: remoteJid,
          is_group: messageIsGroup,
          group_name: messageIsGroup ? resolvedGroupTitle : null
        };

        // Emit Socket to all users in the company
        const io = req.app.get('io');
        if (io && resolvedCompanyId) {
          const room = `company_${resolvedCompanyId}`;
          console.log(`[Evolution] Emitting system-sent message to room ${room}`);
          io.to(room).emit('message:received', resultPayload);
        }

        return res.status(200).json(resultPayload);

      } catch (dbError) {
        console.error("Failed to save sent message to DB:", dbError);
      }
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Erro ao enviar mensagem Evolution:", error);
    return res.status(500).json({
      error: "Internal server error while sending message",
      details: error?.message || String(error)
    });
  }
};

export const sendEvolutionMedia = async (req: Request, res: Response) => {
  const { companyId, instanceKey } = req.body;
  const config = await getEvolutionConfig((req as any).user, 'sendMedia', companyId, instanceKey);
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;
  const resolvedCompanyId = config.company_id;

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    // Limit Check
    if (resolvedCompanyId) {
      const allowed = await checkLimit(resolvedCompanyId, 'messages');
      if (!allowed) {
        return res.status(403).json({ error: 'Limite de mensagens atingido para este mês.' });
      }
    }

    const { phone, media, mediaType, caption, fileName, isGroup } = req.body;

    if (!phone || !media || !mediaType) {
      return res.status(400).json({ error: "Phone, media (base64/url) and mediaType are required" });
    }

    // Ensure media is stripped of 'data:image/png;base64,' prefix if Evolution requires raw base64?
    // Usually Evolution V2 takes full data URI or just base64. 
    // Safe bet: Pass as is, if it fails, try stripping.

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendMedia/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        options: {
          delay: 1200,
          presence: "composing",
        },
        mediaMessage: {
          mediatype: mediaType, // image, video, document, audio
          caption: caption || "",
          media: media, // Base64 or URL
          fileName: fileName,
          ptt: req.body.ptt || false
        }
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: "Failed to send media",
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();

    // Save to DB
    if (pool) {
      try {
        const user = (req as any).user;
        // resolvedCompanyId already defined at top of function
        const safePhone = phone || "";
        const explicitGroupFlag = isGroup === true || isGroup === 'true';
        const inferredGroup = explicitGroupFlag || (typeof safePhone === 'string' && safePhone.endsWith('@g.us'));
        const remoteJid = safePhone.includes('@')
          ? safePhone
          : (inferredGroup ? `${safePhone}@g.us` : `${safePhone}@s.whatsapp.net`);
        const messageIsGroup = remoteJid.endsWith('@g.us') || inferredGroup;
        const conversationPhone = messageIsGroup ? remoteJid : safePhone;
        const resolvedGroupTitle = messageIsGroup
          ? (await resolveStoredGroupTitle(resolvedCompanyId, remoteJid)) || "Grupo"
          : null;
        const content = caption || `[${mediaType}]`;

        // Find or create conversation
        let conversationId: number;
        const checkConv = await pool.query(
          'SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2 AND company_id = $3',
          [remoteJid, EVOLUTION_INSTANCE, resolvedCompanyId]
        );

        if (checkConv.rows.length > 0) {
          conversationId = checkConv.rows[0].id;
          await pool.query(
            `UPDATE whatsapp_conversations 
             SET last_message = $1, last_message_at = NOW(), status = 'OPEN', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3),
                 is_group = CASE WHEN $5 THEN true ELSE is_group END,
                 group_name = CASE
                   WHEN $5 THEN COALESCE(NULLIF(group_name, external_id), $6, group_name, 'Grupo')
                   ELSE group_name
                 END,
                 contact_name = CASE
                   WHEN $5 THEN COALESCE(NULLIF(contact_name, external_id), $6, contact_name, 'Grupo')
                   ELSE contact_name
                 END
             WHERE id = $4`,
            [content, user.id, resolvedCompanyId, conversationId, messageIsGroup, resolvedGroupTitle]
          );
        } else {
          const newConv = await pool.query(
            `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id, is_group, group_name) VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, NOW(), $7, $8, $9) RETURNING id`,
            [
              remoteJid,
              conversationPhone,
              messageIsGroup ? resolvedGroupTitle : conversationPhone,
              EVOLUTION_INSTANCE,
              user.id,
              content,
              resolvedCompanyId,
              messageIsGroup,
              messageIsGroup ? resolvedGroupTitle : null
            ]
          );
          conversationId = newConv.rows[0].id;
        }

        const externalMessageId = data?.key?.id;

        const insertedMsg = await pool.query(
          'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, message_type, media_url, company_id, sent_by_user_id, sent_by_user_name) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING RETURNING *',
          [conversationId, 'outbound', content, 'sent', externalMessageId, user.id, mediaType, (media.startsWith('http') ? media : null), resolvedCompanyId, user.id, user.full_name]
        );

        // Increment Usage
        if (resolvedCompanyId) {
          await incrementUsage(resolvedCompanyId, 'messages', 1);
        }

        const resultPayload = {
          ...insertedMsg.rows[0],
          id: insertedMsg.rows[0]?.id,
          databaseId: insertedMsg.rows[0]?.id,
          conversationId: conversationId,
          external_id: externalMessageId,
          content: content,
          direction: 'outbound',
          sent_at: new Date().toISOString(),
          user_id: user.id,
          agent_name: user.full_name,
          message_type: mediaType,
          media_url: media.startsWith('http') ? media : null,
          phone: conversationPhone,
          remoteJid: remoteJid,
          is_group: messageIsGroup,
          group_name: messageIsGroup ? resolvedGroupTitle : null
        };

        const io = req.app.get('io');
        if (io && resolvedCompanyId) {
          const room = `company_${resolvedCompanyId}`;
          io.to(room).emit('message:received', resultPayload);
        }

        return res.status(200).json(resultPayload);
      } catch (dbError: any) {
        console.error("Failed to save media message to DB:", dbError);
      }
    }

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("Error sending media:", error);
    return res.status(500).json({ error: "Internal Error", details: error.message });
  }
};


export const sendEvolutionReaction = async (req: Request, res: Response) => {
  const { companyId, messageId, emoji } = req.body;
  const config = await getEvolutionConfig((req as any).user, 'sendReaction', companyId);
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;
  const resolvedCompanyId = config.company_id;

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    if (!messageId) {
      return res.status(400).json({ error: "Message ID is required" });
    }

    if (!pool) return res.status(500).json({ error: "Database not configured" });

    // Fetch Message Details
    const msgRes = await pool.query(`
      SELECT m.id, m.external_id, m.direction, m.reactions, m.conversation_id, c.external_id as remote_jid 
      FROM whatsapp_messages m
      JOIN whatsapp_conversations c ON m.conversation_id = c.id
      WHERE m.id = $1 AND (m.company_id = $2 OR c.company_id = $2)
    `, [messageId, resolvedCompanyId]);

    if (msgRes.rows.length === 0) {
      return res.status(404).json({ error: "Message not found or permission denied" });
    }

    const msg = msgRes.rows[0];
    const fromMe = msg.direction === 'outbound';

    // Evolution v2 endpoint for reactions
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendReaction/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        reactionMessage: {
          key: {
            remoteJid: msg.remote_jid,
            fromMe: fromMe,
            id: msg.external_id
          },
          reaction: emoji || ""
        }
      }),
    });

    if (!response.ok) {
      // If Evolution fails, check if it's 404/etc but generally we want to know.
      const text = await response.text();
      console.error(`[Evolution Reaction] Failed: ${response.status} - ${text}`);
      return res.status(response.status).json({
        error: "Failed to send reaction",
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();

    // Optimistic DB Update
    let currentReactions = msg.reactions || [];
    if (!Array.isArray(currentReactions)) currentReactions = [];

    const reactorId = 'me';

    if (emoji) {
      currentReactions = currentReactions.filter((r: any) => r.senderId !== reactorId);
      currentReactions.push({
        emoji,
        senderId: reactorId,
        fromMe: true,
        timestamp: Date.now()
      });
    } else {
      currentReactions = currentReactions.filter((r: any) => r.senderId !== reactorId);
    }

    await pool.query('UPDATE whatsapp_messages SET reactions = $1 WHERE id = $2', [JSON.stringify(currentReactions), messageId]);

    // Emit Socket Update
    const io = req.app.get('io');
    if (io && resolvedCompanyId) {
      const room = `company_${resolvedCompanyId}`;
      const instanceRoom = `instance_${EVOLUTION_INSTANCE}`;

      const payload = {
        messageId: msg.id,
        externalId: msg.external_id,
        reactions: currentReactions,
        conversationId: msg.conversation_id
      };

      io.to(room).emit('message:reaction', payload);
      io.to(instanceRoom).emit('message:reaction', payload);
    }

    return res.json({ success: true, reactions: currentReactions });

  } catch (error: any) {
    console.error("Error sending reaction:", error);
    return res.status(500).json({ error: "Internal Error", details: error.message });
  }
};

export const getEvolutionContacts = async (req: Request, res: Response) => {
  const targetCompanyId = req.query.companyId as string;
  const config = await getEvolutionConfig((req as any).user, 'getContacts', targetCompanyId);
  const EVOLUTION_INSTANCE = config.instance;
  const user = (req as any).user;
  const companyId = user?.company_id;

  // Retrieve local contacts first
  try {
    const resolvedCompanyId = config.company_id;
    console.log(`[Evolution] Fetching local contacts for Company: ${resolvedCompanyId}`);

    if (!resolvedCompanyId) {
      return res.json([]);
    }

    let query = `SELECT *, split_part(jid, '@', 1) as phone FROM whatsapp_contacts WHERE company_id = $1`;
    const params: any[] = [resolvedCompanyId];

    query += ` ORDER BY name ASC`;

    const localContacts = await pool?.query(query, params);
    console.log(`[Evolution] Found ${localContacts?.rows?.length || 0} local contacts.`);
    return res.json(localContacts?.rows || []);
  } catch (error) {
    console.error("Error fetching local contacts, returning MOCK:", error);
    // MOCK DATA FALLBACK
    return res.json([
      { jid: '5511999999999@s.whatsapp.net', name: 'Contato Mock 1 (Offline)', phone: '5511999999999', profile_pic_url: null, instance: EVOLUTION_INSTANCE },
      { jid: '5511888888888@s.whatsapp.net', name: 'Contato Mock 2 (Offline)', phone: '5511888888888', profile_pic_url: null, instance: EVOLUTION_INSTANCE }
    ]);
  }
};

export const syncEvolutionContacts = async (req: Request, res: Response) => {
  const targetCompanyId = (req.query.companyId || req.body.companyId) as string;
  const specificInstanceKey = (req.query.instanceKey || req.body.instanceKey) as string;
  const user = (req as any).user;

  try {
    const resolvedCompanyId = user.role === 'SUPERADMIN' && targetCompanyId ? Number(targetCompanyId) : user.company_id;
    let instancesToProcess: string[] = [];

    // 1. Determine which instances to process
    if (specificInstanceKey) {
      instancesToProcess = [specificInstanceKey];
    } else {
      if (pool && resolvedCompanyId) {
        const resInst = await pool.query('SELECT instance_key FROM company_instances WHERE company_id = $1', [resolvedCompanyId]);
        if (resInst.rows.length > 0) {
          instancesToProcess = resInst.rows.map(r => r.instance_key);
        }
      }
      // Fallback: If no multi-instances found, try one pass with explicit undefined to trigger getEvolutionConfig default logic
      if (instancesToProcess.length === 0) {
        instancesToProcess = [undefined as any];
      }
    }

    console.log(`[Sync] Processing sync for company ${resolvedCompanyId}. Instances: ${instancesToProcess.join(', ') || 'Default'}`);

    let processedCount = 0;
    let errorDetails: string[] = [];

    const isLikelyDisplayName = (value: any, phoneDigits?: string) => {
      const name = String(value || '').trim();
      if (!name) return false;
      if (name.length < 2 || name.length > 60) return false;
      if (/\r|\n/.test(name)) return false;
      if (/https?:\/\//i.test(name)) return false;
      const normalizedPhone = String(phoneDigits || '').replace(/\D/g, '');
      const normalizedNameDigits = name.replace(/\D/g, '');
      if (normalizedPhone && normalizedNameDigits === normalizedPhone) return false;
      if (/^\[[^\]]+\]$/.test(name)) return false; // e.g. [Imagem]
      const wordCount = name.split(/\s+/).filter(Boolean).length;
      if (wordCount > 6 && name.length > 28) return false; // likely sentence
      return true;
    };

    // 2. Iterate and Sync
    for (const instKey of instancesToProcess) {
      try {
        const config = await getEvolutionConfig(user, 'syncContacts', targetCompanyId, instKey);
        const EVOLUTION_API_URL = config.url?.replace(/\/$/, "");
        const EVOLUTION_API_KEY = config.apikey?.trim();

        // Candidates: Sanitized (from config) AND Raw (from DB)
        // We use a Set to avoid duplicates
        const candidateInstances = new Set<string>();
        if (config.instance) candidateInstances.add(config.instance);
        if (instKey && instKey !== 'undefined') candidateInstances.add(instKey); // Raw from DB

        // Also try simple variations if needed (e.g. trimming)
        if (instKey) candidateInstances.add(instKey.trim());

        // CRITICAL: Fetch RAW instance names from DB to ensure case-sensitivity (Evolution API is case sensitive for instance names)
        // 1. From Company Main Settings
        try {
          if (pool) {
            if (resolvedCompanyId) {
              const rawComp = await pool.query('SELECT evolution_instance FROM companies WHERE id = $1', [resolvedCompanyId]);
              if (rawComp.rows.length > 0 && rawComp.rows[0].evolution_instance) {
                candidateInstances.add(rawComp.rows[0].evolution_instance);
              }
            }
            // 2. From Company Instances (if instKey looks like ID or just to be sure)
            if (instKey && instKey.startsWith('id:')) {
              const idPart = instKey.split(':')[1];
              const rawInst = await pool.query('SELECT instance_key FROM company_instances WHERE id = $1', [idPart]);
              if (rawInst.rows.length > 0 && rawInst.rows[0].instance_key) {
                candidateInstances.add(rawInst.rows[0].instance_key);
              }
            } else if (instKey && resolvedCompanyId) {
              // Try to find by insensitive match to get the RAW case
              const rawInst = await pool.query('SELECT instance_key FROM company_instances WHERE LOWER(instance_key) = LOWER($1) AND company_id = $2', [instKey, resolvedCompanyId]);
              if (rawInst.rows.length > 0) {
                candidateInstances.add(rawInst.rows[0].instance_key);
              }
            }
          }
        } catch (e) {
          console.warn("[Sync] Failed to fetch raw instance names:", e);
        }

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || candidateInstances.size === 0) {
          console.warn(`[Sync] Skipping instance ${instKey || 'Default'}: Config missing.`);
          continue;
        }

        console.log(`[Sync] Processing instance key variations: ${Array.from(candidateInstances).join(', ')}`);

        let contactsList: any[] = [];
        let success = false;
        let lastError = "";

        // Iterate over candidate instances (sanitized vs raw)
        for (const currentInstance of candidateInstances) {
          if (success) break;

          // --- Connection Check (Optional, per candidate) ---
          try {
            const checkUrl = `${EVOLUTION_API_URL}/instance/connectionState/${currentInstance}`;
            const checkRes = await fetch(checkUrl, {
              method: 'GET',
              headers: { "apikey": EVOLUTION_API_KEY }
            });
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              const state = (checkData?.instance?.state || checkData?.state || 'unknown');
              if (state !== 'open') {
                console.warn(`[Sync] Skipping candidate ${currentInstance} because it is not OPEN (State: ${state})`);
                // Don't error out immediately, other candidates might work
              }
            }
          } catch (e) { /* ignore check error */ }
          // ------------------------

          // Endpoints to try
          const endpoints = [
            { url: `${EVOLUTION_API_URL}/contact/find/${currentInstance}`, method: 'POST', body: { where: {} } }, // Primary V2
            { url: `${EVOLUTION_API_URL}/contact/fetchContacts/${currentInstance}`, method: 'GET' }, // V1/V2
            { url: `${EVOLUTION_API_URL}/chat/fetchContacts/${currentInstance}`, method: 'GET' }, // Chats
            { url: `${EVOLUTION_API_URL}/chat/fetchContacts/${currentInstance}`, method: 'POST', body: { where: {} } },
            { url: `${EVOLUTION_API_URL}/chat/findContacts/${currentInstance}`, method: 'POST', body: { where: {} } }
          ];

          for (const ep of endpoints) {
            try {
              console.log(`[Sync] Trying ${ep.method} to ${ep.url}`);
              const fetchOptions: any = {
                method: ep.method,
                headers: {
                  "Content-Type": "application/json",
                  "apikey": EVOLUTION_API_KEY,
                  "Authorization": `Bearer ${EVOLUTION_API_KEY}` // Try both
                }
              };
              if (ep.method === 'POST') {
                fetchOptions.body = JSON.stringify(ep.body || {});
              }

              const response = await fetch(ep.url, fetchOptions);
              const contentType = response.headers.get("content-type");

              if (response.ok && contentType && contentType.includes("application/json")) {
                const rawData = await response.json();
                // Handle various wrapper formats
                const list = Array.isArray(rawData) ? rawData : (rawData.data || rawData.contacts || rawData.results || []);

                if (Array.isArray(list) && list.length > 0) {
                  contactsList = list;
                  success = true;
                  console.log(`[Sync] Success via ${ep.url}. Items: ${contactsList.length}`);
                  break;
                } else {
                  // Empty list is technical success but maybe try other endpoints for more data?
                  // For now, if we get OK but empty, we might continue unless it's the only source.
                  // Let's accept it if it's an array.
                  if (Array.isArray(list)) {
                    contactsList = list;
                    // Don't break yet? No, if we found "empty" contacts maybe we should look elsewhere?
                    // But usually /contact/find is authoritative. 
                    // Let's break if we found ANY data, otherwise continue
                    // logic: if (list.length > 0) success=true; break;
                    // Modified:
                  }
                  lastError = "Empty list returned";
                }
              } else {
                const bodyText = await response.text().catch(() => "N/A");
                lastError = `Status ${response.status}`;
                // console.warn(`[Sync] Endpoint failed ${ep.url}: ${lastError}`);
              }
            } catch (err: any) {
              lastError = err.message;
            }
          }
        }

        if (!success && contactsList.length === 0) {
          errorDetails.push(`Instance ${instKey}: ${lastError}`);
          continue; // Try next instance
        }

        // Upsert Contacts Logic
        if (pool && contactsList.length > 0) {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const processedJids = new Set<string>();

            const existingContactsRes = await client.query(
              `SELECT jid, phone, name FROM whatsapp_contacts WHERE company_id = $1`,
              [resolvedCompanyId]
            );

            const existingByJid = new Map<string, string>();
            const existingByPhone = new Map<string, string>();
            for (const row of existingContactsRes.rows) {
              const rowName = String(row.name || '').trim();
              if (!rowName) continue;
              if (row.jid) existingByJid.set(String(row.jid), rowName);
              if (row.phone) existingByPhone.set(String(row.phone).replace(/\D/g, ''), rowName);
            }

            for (const contact of contactsList) {
              const rawId = contact.id || contact.remoteJid || contact.jid;
              if (!rawId || (contact.isGroup) || (typeof rawId === 'string' && rawId.endsWith('@g.us'))) {
                continue;
              }

              let candidate = null;
              const potentialFields = [contact.id, contact.remoteJid, contact.number, contact.phone];

              for (const field of potentialFields) {
                if (typeof field === 'string' && field) {
                  const cleaned = normalizePhone(field);
                  if (cleaned && cleaned.length >= 7) {
                    candidate = cleaned;
                    break;
                  }
                }
              }

              if (!candidate) continue;
              const jid = `${candidate}@s.whatsapp.net`;

              if (processedJids.has(jid)) continue;
              processedJids.add(jid);

              const candidateNames = [contact.name, contact.pushName, contact.notify, contact.verifiedName].map((n: any) => String(n || '').trim());
              const preferredIncomingName = candidateNames.find((n: string) => isLikelyDisplayName(n, candidate)) || '';
              const existingName = existingByJid.get(jid) || existingByPhone.get(candidate) || '';
              const finalName = preferredIncomingName || existingName || candidate;
              const pushName = contact.pushName || contact.notify;
              const profilePic = contact.profilePictureUrl || contact.profilePicture;

              // Use the instance name that SUCCEEDED (we don't track which one in look check, but we can default to instKey or first candidate)
              // Better to use instKey (DB key) for consistency
              const instanceToSave = instKey || config.instance;

              await client.query(`
                INSERT INTO whatsapp_contacts (jid, phone, name, push_name, profile_pic_url, instance, updated_at, company_id)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
                ON CONFLICT (jid, company_id) 
                DO UPDATE SET 
                  name = CASE
                    -- Only overwrite if current name is empty, null, or just equal to the phone
                    WHEN whatsapp_contacts.name IS NULL 
                         OR btrim(whatsapp_contacts.name) = '' 
                         OR whatsapp_contacts.name = whatsapp_contacts.phone 
                         OR whatsapp_contacts.name = whatsapp_contacts.jid
                    THEN CASE 
                         WHEN EXCLUDED.name IS NULL OR btrim(EXCLUDED.name) = '' THEN whatsapp_contacts.name
                         ELSE EXCLUDED.name
                      END
                    ELSE whatsapp_contacts.name
                  END,
                  push_name = EXCLUDED.push_name,
                  profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, whatsapp_contacts.profile_pic_url),
                  phone = EXCLUDED.phone,
                  instance = EXCLUDED.instance,
                  updated_at = NOW()
              `, [jid, candidate, finalName, pushName || null, profilePic || null, instanceToSave, resolvedCompanyId]);

            }

            await client.query(`
              UPDATE whatsapp_conversations c
              SET contact_name = wc.name
              FROM whatsapp_contacts wc
              WHERE c.company_id = $1
                AND wc.company_id = $1
                AND (c.is_group IS NULL OR c.is_group = false)
                AND wc.name IS NOT NULL
                AND btrim(wc.name) <> ''
                AND (
                  wc.jid = c.external_id
                  OR wc.jid = REPLACE(c.external_id, '@c.us', '@s.whatsapp.net')
                  OR regexp_replace(COALESCE(wc.phone, ''), '\\D', '', 'g') = regexp_replace(COALESCE(c.phone, split_part(c.external_id, '@', 1)), '\\D', '', 'g')
                )
            `, [resolvedCompanyId]);

            await client.query('COMMIT');
            processedCount++;
          } catch (dbErr) {
            await client.query('ROLLBACK');
            console.error(`[Sync] DB Error for ${instKey}:`, dbErr);
            errorDetails.push(`DB Error ${instKey}: ${(dbErr as any).message}`);
          } finally {
            client.release();
          }
        } else {
          processedCount++; // API success but 0 contacts is still "processed"
        }

      } catch (instError: any) {
        console.error(`[Sync] Error loop ${instKey}:`, instError);
        errorDetails.push(instError.message);
      }
    }

    if (processedCount === 0 && errorDetails.length > 0) {
      // JSON response for error
      return res.status(502).json({
        success: false,
        message: "Falha ao sincronizar contatos.",
        details: errorDetails.join(' | ')
      });
    }

    // Return Consolidated Contacts
    let localQuery = `SELECT * FROM whatsapp_contacts`;
    const localParams: any[] = [];

    // Filter by Company
    if (resolvedCompanyId) {
      localQuery += ` WHERE (company_id = $1 OR company_id IS NULL)`;
      localParams.push(resolvedCompanyId);
    } else {
      // Superadmin without company?
      localQuery += ` WHERE 1=1 `;
    }

    localQuery += ` ORDER BY name ASC`;
    const finalContacts = await pool?.query(localQuery, localParams);

    // Proactively trigger profile picture sync in background (fire and forget)
    // We don't await this to return the contact list immediately
    return res.json(finalContacts?.rows || []);

  } catch (error: any) {
    console.error("CRITICAL SYNC ERROR:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: "Erro interno no servidor de sincronização",
        details: error?.message
      });
    }
  }
};

export const syncEvolutionGroups = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: "Database not configured" });

    const user = (req as any).user;
    const companyId = req.query.companyId || user.company_id;
    const resolvedCompanyId = Number(companyId);

    // Get instances for this company
    const instancesRes = await pool.query(
      "SELECT instance_key, api_key FROM company_instances WHERE company_id = $1 AND status = 'open'",
      [resolvedCompanyId]
    );

    if (instancesRes.rows.length === 0) {
      // Fallback: check the company table for legacy primary instance
      const companyRes = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1', [resolvedCompanyId]);
      if (companyRes.rows[0]?.evolution_instance) {
        instancesRes.rows.push({
          instance_key: companyRes.rows[0].evolution_instance,
          api_key: companyRes.rows[0].evolution_apikey
        });
      } else {
        return res.status(404).json({ error: "Nenhuma instância ativa encontrada para esta empresa" });
      }
    }

    // Get Evolution URL
    const companyRes = await pool.query('SELECT evolution_url FROM companies WHERE id = $1', [resolvedCompanyId]);
    const evolutionUrl = companyRes.rows[0]?.evolution_url || process.env.EVOLUTION_API_URL;

    if (!evolutionUrl) {
      return res.status(500).json({ error: "Evolution API URL não configurada" });
    }

    let totalSynced = 0;
    const errorDetails: string[] = [];

    for (const inst of instancesRes.rows) {
      const { instance_key, api_key } = inst;
      if (!instance_key) continue;

      try {
        console.log(`[SyncGroups] Fetching groups for instance ${instance_key}`);
        const url = `${evolutionUrl.replace(/\/$/, '')}/group/fetchAllGroups/${instance_key}?getParticipants=false`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': api_key || process.env.EVOLUTION_API_KEY || ''
          }
        });

        if (response.ok) {
          const rawGroups = await response.json();
          // Evolution sometimes returns groups in a 'data' property or directly as array
          const groupsList = Array.isArray(rawGroups) ? rawGroups : (rawGroups.data || []);

          if (Array.isArray(groupsList)) {
            for (const group of groupsList) {
              const jid = group.id || group.remoteJid || group.jid;
              const name = group.subject || group.name || group.title;
              const pic = group.profilePictureUrl || group.pic || group.picture;

              if (!jid || !jid.endsWith('@g.us')) continue;

              // Upsert into whatsapp_conversations
              // We use a combination of external_id and company_id for the match if possible
              // but the schema only has external_id as UNIQUE currently.
              await pool.query(`
                INSERT INTO whatsapp_conversations (
                    external_id, phone, contact_name, group_name, group_subject, group_last_sync, is_group, instance, company_id, profile_pic_url, updated_at, status, channel
                ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, NOW(), 'PENDING', 'whatsapp')
                ON CONFLICT (external_id) 
                DO UPDATE SET 
                    group_name = EXCLUDED.group_name,
                    group_subject = COALESCE(EXCLUDED.group_subject, whatsapp_conversations.group_subject),
                    group_last_sync = CASE WHEN EXCLUDED.group_subject IS NOT NULL THEN NOW() ELSE whatsapp_conversations.group_last_sync END,
                    contact_name = EXCLUDED.contact_name,
                    is_group = true,
                    profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, whatsapp_conversations.profile_pic_url),
                    instance = COALESCE(whatsapp_conversations.instance, EXCLUDED.instance),
                    channel = COALESCE(whatsapp_conversations.channel, 'whatsapp'),
                    updated_at = NOW()
                WHERE whatsapp_conversations.company_id = EXCLUDED.company_id
              `, [jid, jid, name, name, name, name ? new Date() : null, instance_key, resolvedCompanyId, pic]);
              totalSynced++;
            }
          }
        } else {
          const errText = await response.text();
          console.warn(`[SyncGroups] Failed to fetch groups for ${instance_key}: ${response.status} - ${errText}`);
          errorDetails.push(`Instância ${instance_key}: ${response.status}`);
        }
      } catch (err: any) {
        console.error(`[SyncGroups] Error for instance ${instance_key}:`, err);
        errorDetails.push(`Instância ${instance_key}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `${totalSynced} grupos sincronizados com sucesso.`,
      count: totalSynced,
      errors: errorDetails.length > 0 ? errorDetails : undefined
    });

  } catch (error: any) {
    console.error("[SyncGroups] Critical error:", error);
    res.status(500).json({ error: "Erro interno no servidor ao sincronizar grupos" });
  }
};







export const getEvolutionContactsLive = async (req: Request, res: Response) => {
  const targetCompanyId = req.query.companyId as string;
  const config = await getEvolutionConfig((req as any).user, 'getContactsLive', targetCompanyId);
  const EVOLUTION_API_URL = config.url.replace(/\/$/, "");
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return res.status(500).json({ error: "Evolution API not configured" });
  }

  try {
    const endpoints = [
      `${EVOLUTION_API_URL}/chat/findContacts/${EVOLUTION_INSTANCE}`,
      `${EVOLUTION_API_URL}/chat/fetchContacts/${EVOLUTION_INSTANCE}`,
      `${EVOLUTION_API_URL}/contact/find/${EVOLUTION_INSTANCE}`,
      `${EVOLUTION_API_URL}/contact/fetchContacts/${EVOLUTION_INSTANCE}`
    ];

    let contactsList: any[] = [];
    let success = false;
    let lastError = "";

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({})
        });

        if (response.ok) {
          const rawData = await response.json();
          contactsList = Array.isArray(rawData) ? rawData : (rawData.data || rawData.contacts || rawData.results || []);
          success = true;
          break;
        } else {
          lastError = await response.text();
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (!success) {
      return res.status(502).json({ error: "Live fetch failed from all endpoints", details: lastError });
    }

    // Return mapped simple objects with database caching for pictures
    const mapped = await Promise.all(contactsList.map(async (c) => {
      const jid = c.id || c.remoteJid || c.jid;
      const phone = extractPhoneFromJid(jid) || normalizePhone(c.phone || c.number || "");
      let profile_pic_url = c.profilePictureUrl || c.profilePicture;

      // If API didn't return a pic, try to find it in our local DB
      if (!profile_pic_url && pool && phone) {
        try {
          const dbCheck = await pool.query(
            "SELECT profile_pic_url FROM whatsapp_contacts WHERE (phone = $1 OR jid = $2) AND company_id = $3 LIMIT 1",
            [phone, jid, config.company_id]
          );
          if (dbCheck.rows.length > 0 && dbCheck.rows[0].profile_pic_url) {
            profile_pic_url = dbCheck.rows[0].profile_pic_url;
          }
        } catch (e) { /* ignore cache miss */ }
      }

      return {
        id: jid || phone,
        name: c.name || c.pushName || c.notify || phone,
        phone: phone,
        profile_pic_url: profile_pic_url
      };
    }));

    const filtered = mapped.filter(c => c.phone && c.phone.length >= 7);
    return res.json(filtered);

  } catch (error: any) {
    console.error("Error fetching live contacts:", error);
    return res.status(500).json({ error: "Live fetch failed", details: error.message });
  }
};

export const createEvolutionContact = async (req: Request, res: Response) => {
  const { companyId: reqCompanyId } = req.body; // Renamed to avoid conflict with user?.company_id
  try {
    const config = await getEvolutionConfig((req as any).user, 'createContact', reqCompanyId);
    const EVOLUTION_INSTANCE = config.instance;

    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and Phone are required" });
    }

    // Validate phone format
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: "Telefone inválido. Use formato com DDD." });
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      if (!pool) return res.status(500).json({ error: "Database not configured" });

      const user = (req as any).user;
      const companyId = user?.company_id || reqCompanyId;

      // Insert into DB and RETURNING *
      const insertRes = await pool.query(`
          INSERT INTO whatsapp_contacts (jid, phone, name, instance, updated_at, company_id)
          VALUES ($1, $2, $3, $4, NOW(), $5)
          ON CONFLICT (jid, company_id) 
          DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(), phone = EXCLUDED.phone, instance = EXCLUDED.instance
          RETURNING *
      `, [jid, cleanPhone, name, EVOLUTION_INSTANCE, companyId]);

      const row = insertRes.rows[0];

      // --- PROPAGATION LOGIC ---
      // 1. Update Conversations
      await pool.query(
        'UPDATE whatsapp_conversations SET contact_name = $1 WHERE (phone = $2 OR external_id = $3) AND company_id = $4',
        [name, cleanPhone, jid, companyId]
      );

      // 2. Update CRM Leads
      await pool.query(
        'UPDATE crm_leads SET name = $1 WHERE phone = $2 AND company_id = $3',
        [name, cleanPhone, companyId]
      );

      // 3. Emit Socket Events
      const io = req.app.get('io');
      if (io && companyId) {
        io.to(`company_${companyId}`).emit('contact:update', {
          id: row.id,
          phone: cleanPhone,
          name: name,
          jid: jid,
          companyId: companyId
        });

        // Also force conversation update for relevant chats
        const convRes = await pool.query(
          'SELECT id FROM whatsapp_conversations WHERE (phone = $1 OR external_id = $2) AND company_id = $3',
          [cleanPhone, jid, companyId]
        );
        for (const cRow of convRes.rows) {
          io.to(`company_${companyId}`).emit('conversation:update', {
            id: cRow.id,
            contact_name: name
          });
        }
      }

      return res.status(201).json({
        id: row.id, // Important: Return DB ID
        name: row.name,
        phone: row.phone,
        jid: row.jid
      });

    } catch (error: any) {
      console.error("Error creating contact inner:", error);
      throw error;
    }
  } catch (error: any) {
    console.error("Error creating contact outer:", error);
    return res.status(500).json({ error: "Failed to create contact" });
  }
};

// ... (previous code)

// Handle Evolution Webhooks
export const handleEvolutionWebhook = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    // console.log("[Evolution] Webhook received:", JSON.stringify(body, null, 2));

    const { type, data, instance } = body;

    // Resolve Company ID from Instance
    let resolvedCompanyId: number | null = null;
    if (instance && pool) {
      const ciRes = await pool.query('SELECT company_id FROM company_instances WHERE instance_key = $1', [instance]);
      if (ciRes.rows.length > 0) {
        resolvedCompanyId = ciRes.rows[0].company_id;
      } else {
        const cRes = await pool.query('SELECT id FROM companies WHERE evolution_instance = $1', [instance]);
        if (cRes.rows.length > 0) resolvedCompanyId = cRes.rows[0].id;
      }
    }

    // V2 structure compatibility: sometimes data is inside 'data' or top level depending on event
    // Typical V2 TEXT_MESSAGE: type: "MESSAGES_UPSERT", data: { messages: [...] } OR directly messages: [...]

    // We focus on MESSAGES_UPSERT or MESSAGES_UPDATE
    // Check event type
    const eventType = type || body.event;

    if (eventType === "CONNECTION_UPDATE") {
      const state = data?.state || body.state;
      // Evolution v2 number is usually in data.number or body.number, format "5511999999999:1"
      const rawNumber = data?.number || body.number;
      const cleanNumber = rawNumber ? rawNumber.split(':')[0] : null;

      if (instance && pool) {
        await pool.query(
          'UPDATE company_instances SET status = $1, phone = COALESCE($2, phone) WHERE instance_key = $3',
          [state === 'open' ? 'connected' : (state || 'disconnected'), cleanNumber, instance]
        );
        console.log(`[Webhook] Instance ${instance} connection status updated to ${state} (${cleanNumber})`);
      }
    }

    if (eventType === "MESSAGES_UPSERT") {
      const messages = data?.messages || body.messages || []; // V2 usually sends array

      for (const msg of messages) {
        if (!msg.key) continue;

        const remoteJid = msg.key.remoteJid;
        const fromMe = msg.key.fromMe;
        const id = msg.key.id;
        const pushName = msg.pushName;
        const messageType = msg.messageType || Object.keys(msg.message)[0];

        // Extract content
        let content = "";
        if (messageType === 'conversation') content = msg.message.conversation;
        else if (messageType === 'extendedTextMessage') content = msg.message.extendedTextMessage.text;
        else if (messageType === 'imageMessage') content = msg.message.imageMessage.caption || "[Imagem]";
        else if (messageType === 'audioMessage') content = "[Áudio]";
        else if (messageType === 'videoMessage') content = "[Vídeo]";
        else content = JSON.stringify(msg.message); // Fallback

        // Ignore status updates
        if (remoteJid === "status@broadcast") continue;

        // Ensure Conversation Exists
        let conversationId: number | null = null;

        if (pool) {
          // Helper: clean phone
          const phone = remoteJid.split('@')[0];

          // 0. Resolve Contact Name from Saved Contacts
          // Priority: Saved Name > PushName > Phone
          let finalContactName = pushName || phone;
          let isSavedContact = false;

          try {
            const savedContactRes = await pool.query(
              "SELECT name FROM whatsapp_contacts WHERE jid = $1 OR phone = $2 LIMIT 1",
              [remoteJid, phone]
            );
            if (savedContactRes.rows.length > 0) {
              finalContactName = savedContactRes.rows[0].name;
              isSavedContact = true;
            }
          } catch (err) {
            console.error("Error looking up saved contact:", err);
          }

          // 1. Upsert Conversation
          // We need to check by external_id AND instance
          const existing = await pool.query(
            `SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2`,
            [remoteJid, instance]
          );

          if (existing.rows.length > 0) {
            conversationId = existing.rows[0].id;
            // Update last message AND contact_name (to keep it in sync with saved contacts)
            await pool.query(
              `UPDATE whatsapp_conversations SET 
                                last_message = $1, 
                                last_message_at = NOW(), 
                                unread_count = unread_count + $3,
                                contact_name = $4
                             WHERE id = $2`,
              [content, conversationId, fromMe ? 0 : 1, finalContactName]
            );
          } else {
            // Create new
            const newConv = await pool.query(
              `INSERT INTO whatsapp_conversations 
                                (external_id, phone, contact_name, instance, last_message, last_message_at, unread_count, company_id)
                             VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
                             RETURNING id`,
              [remoteJid, phone, finalContactName, instance, content, fromMe ? 0 : 1, resolvedCompanyId]
            );
            conversationId = newConv.rows[0].id;

            // --- CRM INTEGRATION: Auto-create Lead ---
            // Condition: 
            // 1. Message is INBOUND (from user)
            // 2. Contact is NOT SAVED in whatsapp_contacts (isSavedContact === false)
            if (!fromMe && !isSavedContact) {
              try {
                const leadStageRes = await pool.query(
                  "SELECT id FROM crm_stages WHERE name = 'Leads' AND company_id = $1 LIMIT 1",
                  [resolvedCompanyId]
                );

                if (leadStageRes.rows.length > 0) {
                  const leadsStageId = leadStageRes.rows[0].id;

                  // Check if lead exists by phone AND company
                  const checkLead = await pool.query(
                    "SELECT id FROM crm_leads WHERE phone = $1 AND company_id = $2",
                    [phone, resolvedCompanyId]
                  );

                  if (checkLead.rows.length === 0) {
                    console.log(`[CRM] Auto-creating lead for UNSAVED contact ${phone}`);
                    await pool.query(
                      `INSERT INTO crm_leads (name, phone, stage_id, origin, company_id, instance, created_at, updated_at)
                                 VALUES ($1, $2, $3, 'WhatsApp', $4, $5, NOW(), NOW())
                                 ON CONFLICT (phone, company_id) DO NOTHING`,
                      [pushName || phone, phone, leadsStageId, resolvedCompanyId, instance]

                    );
                  }
                } else {
                  console.warn("[CRM] 'Leads' stage not found. Skipping auto-lead creation.");
                }
              } catch (crmError) {
                console.error("[CRM] Error auto-creating lead:", crmError);
              }
            }
            // -----------------------------------------
          }

          // 2. Insert Message
          // Check for duplicates first? (id is unique usually but let's trust uniqueness of id is not guaranteed globally unless we constrain it)
          // Actually let's assume valid new message.
          await pool.query(
            `INSERT INTO whatsapp_messages 
                            (conversation_id, direction, content, sent_at, status, message_type)
                         VALUES ($1, $2, $3, NOW(), $4, $5)`,
            [conversationId, fromMe ? 'outbound' : 'inbound', content, 'received', messageType]
          );

          // 3. Emit Socket Event
          const io = req.app.get('io');
          if (io) {
            // Payload expected by frontend:
            // { conversation_id, phone, contact_name, content, sent_at, direction, id, ... }

            io.emit("message:received", {
              id: Date.now(), // Temp ID for socket
              conversation_id: conversationId,
              platform: "whatsapp",
              direction: fromMe ? "outbound" : "inbound",
              content: content,
              status: "received",
              sent_at: new Date(),
              phone: phone, // Frontend uses phone to match conversation (using the clean phone variable)
              contact_name: pushName || remoteJid,
              remoteJid: remoteJid,
              instance: instance
            });
          }
        }
      }
    }

    return res.status(200).send("OK");
  } catch (e) {
    console.error("Error processing webhook:", e);
    return res.status(500).send("Error");
  }
};


export const editEvolutionMessage = async (req: Request, res: Response) => {
  const { conversationId, messageId } = req.params;
  const { content } = req.body;

  if (!content) return res.status(400).json({ error: "Content is required" });

  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    // 1. Get message info from DB (external_id and remoteJid)
    const msgQuery = await pool.query(`
      SELECT m.external_id, c.external_id as remote_jid, m.direction
      FROM whatsapp_messages m
      JOIN whatsapp_conversations c ON m.conversation_id = c.id
      WHERE m.id = $1
    `, [messageId]);

    if (msgQuery.rows.length === 0) {
      // If it's a temp ID or just not found, we can try to update by ID if it's numeric
      if (!isNaN(Number(messageId))) {
        await pool.query('UPDATE whatsapp_messages SET content = $1 WHERE id = $2', [content, messageId]);
        return res.json({ status: "updated_local_only", id: messageId });
      }
      return res.status(404).json({ error: "Message not found" });
    }

    const { external_id, remote_jid, direction } = msgQuery.rows[0];

    // Only allow editing outbound messages via API
    if (direction === 'outbound' && external_id) {
      const config = await getEvolutionConfig((req as any).user, 'editMessage');
      const EVOLUTION_API_URL = config.url;
      const EVOLUTION_API_KEY = config.apikey;
      const EVOLUTION_INSTANCE = config.instance;

      if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
        const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/updateMessage/${EVOLUTION_INSTANCE}`;

        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            number: remote_jid.split('@')[0],
            key: {
              remoteJid: remote_jid,
              fromMe: true,
              id: external_id
            },
            text: content
          })
        });
      }
    }

    // 2. Update local DB
    await pool.query('UPDATE whatsapp_messages SET content = $1 WHERE id = $2', [content, messageId]);

    return res.json({ status: "updated", id: messageId, content });
  } catch (error) {
    console.error("Error updating message:", error);
    return res.status(500).json({ error: "Failed to update" });
  }
};

export const updateEvolutionContact = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, companyId } = req.body;
  const user = (req as any).user;

  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    const resolvedCompanyId = user.role === 'SUPERADMIN' ? companyId : user.company_id;

    // UPDATE with RETURNING to get phone and confirm update
    const updateRes = await pool.query(
      'UPDATE whatsapp_contacts SET name = $1 WHERE id = $2 AND company_id = $3 RETURNING *',
      [name, id, resolvedCompanyId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: "Contact not found or access denied" });
    }

    const updatedContact = updateRes.rows[0];
    const { phone, jid } = updatedContact;

    // --- PROPAGATION LOGIC ---

    // 1. Update Conversations (any conversation with this phone)
    await pool.query(
      'UPDATE whatsapp_conversations SET contact_name = $1 WHERE (phone = $2 OR external_id = $3) AND company_id = $4',
      [name, phone, jid, resolvedCompanyId]
    );

    // 2. Update CRM Leads (any lead with this phone)
    await pool.query(
      'UPDATE crm_leads SET name = $1 WHERE phone = $2 AND company_id = $3',
      [name, phone, resolvedCompanyId]
    );

    // 3. Emit Socket Events to refresh UI
    const io = req.app.get('io');
    if (io) {
      // Emit contact update
      io.to(`company_${resolvedCompanyId}`).emit('contact:update', {
        id: updatedContact.id,
        phone: phone,
        name: name,
        jid: jid,
        companyId: resolvedCompanyId
      });

      // Also force conversation update so the chat list updates without full reload
      const convRes = await pool.query(
        'SELECT id FROM whatsapp_conversations WHERE (phone = $1 OR external_id = $2) AND company_id = $3',
        [phone, jid, resolvedCompanyId]
      );
      for (const cRow of convRes.rows) {
        io.to(`company_${resolvedCompanyId}`).emit('conversation:update', {
          id: cRow.id,
          contact_name: name
        });
      }
    }

    return res.json({ status: "updated", id, name, phone });

  } catch (error) {
    console.error("Error updating contact:", error);
    return res.status(500).json({ error: "Failed to update contact" });
  }
};

export const deleteEvolutionContact = async (req: Request, res: Response) => {
  const { id } = req.params;
  const companyId = req.query.companyId as string;
  const user = (req as any).user;

  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    const resolvedCompanyId = user.role === 'SUPERADMIN' ? companyId : user.company_id;

    await pool.query('DELETE FROM whatsapp_contacts WHERE id = $1 AND company_id = $2', [id, resolvedCompanyId]);

    return res.json({ status: "deleted", id });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return res.status(500).json({ error: "Failed to delete contact" });
  }
};

export const getEvolutionMedia = async (req: Request, res: Response) => {
  const { messageId } = req.params;
  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    // 1. Get message details
    const msgQuery = await pool.query(
      "SELECT external_id, direction, conversation_id, message_type FROM whatsapp_messages WHERE id = $1",
      [messageId]
    );
    if (msgQuery.rows.length === 0) return res.status(404).send("Message not found");

    const { external_id, direction, conversation_id, message_type } = msgQuery.rows[0];

    // 2. Get instance from conversation
    const convQuery = await pool.query("SELECT instance, phone, external_id as remote_jid FROM whatsapp_conversations WHERE id = $1", [conversation_id]);
    if (convQuery.rows.length === 0) return res.status(404).send("Conversation not found");

    const { instance, remote_jid } = convQuery.rows[0];

    // 3. Config
    const config = await getEvolutionConfig((req as any).user, 'getMedia');
    const EVOLUTION_API_URL = config.url;
    const EVOLUTION_API_KEY = config.apikey;

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return res.status(500).send("Evolution not configured");

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/getBase64FromMediaMessage/${instance}`;

    const payload = {
      message: {
        key: {
          id: external_id,
          fromMe: direction === 'outbound',
          remoteJid: remote_jid
        }
      },
      convertToMp4: false
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`[Media Proxy] Evolution Error ${response.status}:`, await response.text());
      return res.status(response.status).send("Failed to fetch media from provider");
    }

    const data = await response.json();

    if (!data.base64) return res.status(404).send("Media content not found");

    const imgBuffer = Buffer.from(data.base64, 'base64');

    // Set content type based on message type if possible
    if (message_type === 'image' || message_type === 'sticker' || message_type === 'stickerMessage') res.setHeader('Content-Type', 'image/webp');
    else if (message_type === 'audio') res.setHeader('Content-Type', 'audio/mp3'); // or ogg
    else if (message_type === 'video') res.setHeader('Content-Type', 'video/mp4');
    else res.setHeader('Content-Type', 'application/octet-stream');

    return res.send(imgBuffer);

  } catch (error) {
    console.error("Media proxy error:", error);
    return res.status(500).send("Internal Server Error");
  }
};

export const getEvolutionProfilePic = async (req: Request, res: Response) => {
  const { phone } = req.params;
  const targetCompanyId = req.query.companyId as string;
  try {
    const config = await getEvolutionConfig((req as any).user, 'getProfilePic', targetCompanyId);
    const EVOLUTION_API_URL = config.url;
    const EVOLUTION_API_KEY = config.apikey;
    const EVOLUTION_INSTANCE = config.instance;

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return res.status(500).json({ error: "Config missing" });

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/fetchProfilePictureUrl/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
      body: JSON.stringify({ number: phone })
    });

    if (!response.ok) return res.status(404).send("Pic not found");

    const data = await response.json();
    const picUrl = data.profilePictureUrl;

    if (picUrl && pool) {
      // Update DB cache for contacts and conversations (handles both people and groups)
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      const resolvedCompanyId = config.company_id;
      await Promise.all([
        pool.query("UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE (jid = $2 OR phone = $3) AND company_id = $4", [picUrl, jid, phone, resolvedCompanyId]),
        pool.query("UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE (external_id = $2 OR phone = $3) AND company_id = $4", [picUrl, jid, phone, resolvedCompanyId])
      ]);
    }

    return res.json({ url: picUrl });

  } catch (error) {
    console.error("Profile pic error:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
};

export const syncAllProfilePics = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'syncAllProfilePics');
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return res.status(500).json({ error: "Config missing" });

  try {
    if (!pool) return res.status(500).send("DB not configured");

    const user = (req as any).user;
    const companyId = user?.company_id;

    // Fetch both conversations and contacts without profile pics for the current instance/company
    let query = `
      SELECT DISTINCT jid_or_phone, external_id, phone, is_group 
      FROM (
        SELECT external_id as jid_or_phone, external_id, phone, is_group FROM whatsapp_conversations 
        WHERE (profile_pic_url IS NULL OR profile_pic_url = '') AND instance = $1 AND company_id = $2
        UNION
        SELECT jid as jid_or_phone, jid as external_id, phone, false as is_group FROM whatsapp_contacts 
        WHERE (profile_pic_url IS NULL OR profile_pic_url = '') AND instance = $1 AND company_id = $2
      ) sub
    `;
    const params = [EVOLUTION_INSTANCE, companyId];

    const { rows } = await pool.query(query, params);

    let count = 0;
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

    // Process in background and return immediate status
    res.json({ success: true, message: `Sincronizando ${rows.length} fotos de perfil em segundo plano...`, totalFound: rows.length });

    // Process in background
    (async () => {
      console.log(`[SyncPics] Starting sync for ${rows.length} items on instance ${EVOLUTION_INSTANCE}`);
      for (const item of rows) {
        try {
          const target = item.jid_or_phone || item.external_id || item.phone;
          if (!target) continue;

          console.log(`[SyncPics] Fetching pic for ${target}...`);
          const response = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${EVOLUTION_INSTANCE}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
            body: JSON.stringify({ number: target })
          });

          if (response.ok) {
            const data = await response.json();
            let picUrl = data.profilePictureUrl || data.url;

            // Fallback for groups if fetchProfilePictureUrl didn't return a URL
            if (!picUrl && item.is_group) {
              console.log(`[SyncPics] Fallback to findGroup for group ${target}`);
              const gRes = await fetch(`${baseUrl}/group/findGroup/${EVOLUTION_INSTANCE}?groupJid=${target}`, {
                headers: { "apikey": EVOLUTION_API_KEY }
              });
              if (gRes.ok) {
                const gData = await gRes.json();
                picUrl = gData.profilePictureUrl || gData.pic || gData.picture;
              }
            }

            if (picUrl) {
              await Promise.all([
                pool.query("UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE (external_id = $2 OR phone = $3) AND company_id = $4", [picUrl, item.external_id, item.phone, companyId]),
                pool.query("UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE (jid = $2 OR phone = $3) AND company_id = $4", [picUrl, item.external_id, item.phone, companyId])
              ]);
              count++;
              console.log(`[SyncPics] ✅ Updated pic for ${target}`);
            } else {
              console.log(`[SyncPics] ℹ️ No pic found for ${target}`);
            }
          } else {
            console.warn(`[SyncPics] ⚠️ API returned ${response.status} for ${target}`);
          }
          // Small delay to be polite to the API and avoid being flagged
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (err) {
          console.error(`[SyncPics] Error syncing pic for ${item.jid_or_phone}:`, err);
        }
      }
      console.log(`[SyncPics] Completed. Synced ${count} out of ${rows.length}.`);
    })().catch(e => console.error("[SyncPics BG Error]:", e));

  } catch (error) {
    console.error("Sync all pics error:", error);
    if (!res.headersSent) return res.status(500).json({ error: "Internal Error" });
  }
};

export const refreshConversationMetadata = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: "Database not configured" });

    const { conversationId } = req.params;
    const user = (req as any).user;
    const targetCompanyId = (req.query.companyId as string) || (user?.company_id ? String(user.company_id) : undefined);
    const config = await getEvolutionConfig(user, 'refresh_conversation_metadata', targetCompanyId);
    const { url: EVOLUTION_API_URL, apikey: EVOLUTION_API_KEY, instance: EVOLUTION_INSTANCE } = config;

    // 1. Get Conversation
    let convRes;
    if (!isNaN(Number(conversationId)) && !String(conversationId).includes('@')) {
      convRes = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = $1', [conversationId]);
    } else {
      // It is likely a JID
      convRes = await pool.query('SELECT * FROM whatsapp_conversations WHERE external_id = $1', [conversationId]);
    }

    if (convRes.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });
    const conv = convRes.rows[0];
    const remoteJid = conv.external_id;
    const conversationPK = conv.id;
    const companyId = Number(conv.company_id || user?.company_id || config?.company_id || 0);

    const lockKey = `${companyId || 'unknown'}:${remoteJid || conversationPK}`;
    if (refreshLock.has(lockKey)) {
      return res.json({ status: "skipped", reason: "refresh_locked", id: conversationId });
    }
    refreshLock.set(lockKey, true);
    setTimeout(() => {
      refreshLock.delete(lockKey);
    }, 10000);

    if (conv.is_group && !companyId) {
      console.warn('[Refresh] Missing company_id for group metadata refresh. Skipping metadata refresh.');
      return res.json({ status: "skipped", reason: "missing_company_id", id: conversationId });
    }

    if (!config || !config.url || !config.apikey || !config.company_id) {
      console.warn('[Refresh] Invalid evolution config. Skipping metadata refresh.');
      return res.json({ status: "skipped", reason: "invalid_config", id: conversationId });
    }

    const evolutionClient = {
      get: async (path: string) => {
        const targetUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}${path.startsWith('/') ? path : `/${path}`}`;
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY || '' }
        });

        if (!response.ok) {
          const errorText = await response.text();
          const err: any = new Error(`Evolution GET failed with status ${response.status}`);
          err.status = response.status;
          err.body = errorText;
          throw err;
        }

        return response.json();
      }
    };

    if (!evolutionClient) {
      console.warn('[Refresh] Evolution client not initialized. Skipping metadata refresh.');
      return res.json({ status: "skipped", reason: "missing_client", id: conversationId });
    }

    // 2. Fetch Group Metadata if Group
    let updatedName = conv.group_subject || conv.group_name || conv.contact_name;
    let updatedPic = conv.profile_pic_url;

    if (conv.is_group) {
      let groupJid = remoteJid;
      // aggressively fix JID domain for groups
      if (groupJid) {
        if (groupJid.includes('@s.whatsapp.net')) {
          groupJid = groupJid.replace('@s.whatsapp.net', '@g.us');
        } else if (!groupJid.includes('@')) {
          groupJid = `${groupJid}@g.us`;
        }
      }

      const targetInstance = conv.instance || EVOLUTION_INSTANCE;
      const hasRecentSync = conv.group_last_sync && (Date.now() - new Date(conv.group_last_sync).getTime()) < 24 * 60 * 60 * 1000;

      if (hasRecentSync && conv.group_subject) {
        return res.json({
          success: true,
          message: 'Group metadata is up-to-date.',
          contact_name: conv.group_subject,
          group_name: conv.group_subject,
          pic: updatedPic,
          conversation_id: conversationPK
        });
      }

      console.log(`[Refresh] Fetching Group Info for ${groupJid} (Original: ${remoteJid}) on Instance: ${targetInstance}`);
      let groupInfo: any = null;
      try {
        groupInfo = await evolutionClient.get(`/group/findGroup/${targetInstance}?groupJid=${encodeURIComponent(groupJid)}`);
      } catch (error: any) {
        console.warn('[Refresh] Failed to fetch group info:', error?.message);
      }

      if (!groupInfo) {
        console.warn('[Refresh] Group info não encontrado. Mantendo dados atuais.');
      } else {
        const subject = groupInfo?.subject || groupInfo?.name;

        if (subject) {
          updatedName = subject;
          await pool.query('UPDATE whatsapp_conversations SET contact_name = $1, group_name = $1, group_subject = $1, group_last_sync = NOW() WHERE id = $2', [subject, conversationId]);
          console.log(`[Refresh] Updated group name: ${subject}`);
        }

        const pic = groupInfo.profilePictureUrl || groupInfo.pic || groupInfo.picture;
        if (pic && !updatedPic) {
          updatedPic = pic;
          await pool.query('UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE id = $2', [pic, conversationId]);
          console.log(`[Refresh] Updated group pic from metadata: ${pic}`);
        }
      }
    }

    // 3. Fetch Profile Picture (Only when needed)
    if (conv.profile_pic_url) {
      console.log('[Refresh] Já possui foto. Pulando fetch.');
    } else {
      try {
        console.log(`[Refresh] Fetching Profile Pic for ${remoteJid}`);
        const picUrlEndpoint = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/fetchProfilePictureUrl/${EVOLUTION_INSTANCE}`;
        const picRes = await fetch(picUrlEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY || "" },
          body: JSON.stringify({ number: remoteJid })
        });

        if (picRes.ok) {
          const pData = await picRes.json();
          const url = pData.profilePictureUrl || pData.url;
          if (url) {
            updatedPic = url;
            await pool.query('UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE id = $2', [url, conversationPK]);
            if (!conv.is_group) {
              await pool.query('UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE jid = $2 AND company_id = $3', [url, remoteJid, companyId]);
            }
            console.log(`[Refresh] Updated profile pic: ${url}`);
          }
        } else {
          console.warn(`[Refresh] Failed to fetch pic: ${picRes.status}`);
        }
      } catch (picError) {
        console.warn('[Refresh] Failed to fetch profile picture. Continuing without blocking main flow.', picError);
      }
    }

    // 4. Emit update
    const io = req.app.get('io');
    if (io && companyId) {
      io.to(`company_${companyId}`).emit('conversation:update', {
        id: conversationId,
        contact_name: updatedName,
        group_name: updatedName,
        profile_pic_url: updatedPic
      });
    }

    return res.json({ status: "success", name: updatedName, pic: updatedPic });

  } catch (e: any) {
    console.error("Error refreshing metadata:", e);
    return res.status(500).json({ error: "Internal Error", details: e.message });
  }
};

export const setEvolutionWebhook = async (req: Request, res: Response) => {
  const targetCompanyId = req.query.companyId as string;
  const config = await getEvolutionConfig((req as any).user, 'set_webhook', targetCompanyId);
  const { url: EVOLUTION_API_URL, apikey: EVOLUTION_API_KEY, instance: EVOLUTION_INSTANCE } = config;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return res.status(500).json({ error: "Configuração da Evolution API ausente." });
  }

  try {
    let protocol = req.headers['x-forwarded-proto'] || req.protocol;
    let host = req.get('host');

    // Force https if not on localhost
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      protocol = 'https';
    }

    const rawBackendUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
    const backendUrl = rawBackendUrl.replace(/\/$/, "");
    const webhookUrl = `${backendUrl}/api/evolution/webhook`;

    console.log(`[Webhook] Registering webhook for instance ${EVOLUTION_INSTANCE} to ${webhookUrl}`);

    // Tentamos os dois endpoints possíveis dependendo da versão (v1/v2)
    const endpoints = [
      `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/set/${EVOLUTION_INSTANCE}`,
      `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/instance/${EVOLUTION_INSTANCE}`
    ];

    let lastError = null;
    let success = false;
    let responseData = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            webhook: webhookUrl,
            enabled: true,
            webhook_by_events: false,
            events: WEBHOOK_EVENTS
          })
        });

        if (response.ok) {
          success = true;
          responseData = await response.json();
          console.log(`[Webhook] SUCCESS registering webhook via ${url}`);
          break;
        } else {
          lastError = await response.text();
          console.error(`[Webhook] FAILED registering webhook via ${url}. Status: ${response.status}, Error: ${lastError}`);
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!success) {
      return res.status(500).json({
        error: "Falha ao registrar webhook na Evolution API.",
        details: lastError,
        webhookUrl
      });
    }

    return res.json({
      success: true,
      webhookUrl,
      instance: EVOLUTION_INSTANCE,
      data: responseData
    });
  } catch (error: any) {
    console.error("Error setting webhook:", error);
    return res.status(500).json({ error: "Erro interno ao configurar webhook.", details: error.message });
  }
};
// (Function moved or deleted to avoid duplication)
export const deleteEvolutionMessage = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'deleteMessage');
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  try {
    const { messageId, remoteJid } = req.body;

    if (!messageId || !remoteJid) {
      return res.status(400).json({ error: "messageId and remoteJid are required" });
    }

    // Evolution API Endpoint for Deleting for Everyone
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/message/deleteMessageForEveryone/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY || ""
      },
      body: JSON.stringify({
        messageId: messageId,
        remoteJid: remoteJid
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Evolution Delete Error:", text);
      return res.status(response.status).json({ error: "Failed to delete message", detail: text });
    }

    const data = await response.json();

    // Remove from local DB
    if (pool) {
      await pool.query('DELETE FROM whatsapp_messages WHERE external_id = $1 OR id = $2', [messageId, isNaN(Number(messageId)) ? -1 : Number(messageId)]);
    }

    return res.json(data);

  } catch (error) {
    console.error("Error deleting message for everyone:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    // Se for um ID numérico, apaga direto
    if (!isNaN(Number(id))) {
      await pool.query('DELETE FROM whatsapp_messages WHERE id = $1', [id]);
    } else {
      // Se for external_id
      await pool.query('DELETE FROM whatsapp_messages WHERE external_id = $1', [id]);
    }

    return res.json({ status: "deleted", id });
  } catch (error) {
    console.error("Error deleting message for me:", error);
    return res.status(500).json({ error: "Failed to delete message" });
  }
};

export const getEvolutionWebhook = async (req: Request, res: Response) => {
  const targetCompanyId = req.query.companyId as string;
  const config = await getEvolutionConfig((req as any).user, 'get_webhook', targetCompanyId);
  const { url: EVOLUTION_API_URL, apikey: EVOLUTION_API_KEY, instance: EVOLUTION_INSTANCE } = config;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return res.status(500).json({ error: "Configuração da Evolution API ausente." });
  }

  try {
    let protocol = req.headers['x-forwarded-proto'] || req.protocol;
    let host = req.get('host');
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      protocol = 'https';
    }
    const rawBackendUrl = process.env.BACKEND_URL || `${protocol}://${host}`;
    const calculatedWebhookUrl = `${rawBackendUrl.replace(/\/$/, "")}/api/evolution/webhook`;

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/find/${EVOLUTION_INSTANCE}`;
    console.log(`[Webhook] Checking webhook for instance ${EVOLUTION_INSTANCE} at ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Webhook] Failed to get webhook. Status: ${response.status}, Error: ${errorText}`);
      return res.status(response.status).json({
        error: "Falha ao buscar webhook",
        details: errorText,
        instance: EVOLUTION_INSTANCE,
        calculatedWebhookUrl
      });
    }

    const data = await response.json();
    return res.json({
      instance: EVOLUTION_INSTANCE,
      currentWebhookInEvolution: data,
      calculatedWebhookUrl,
      match: data[0]?.url === calculatedWebhookUrl || data?.url === calculatedWebhookUrl
    });

  } catch (error: any) {
    console.error("Error getting webhook:", error);
    return res.status(500).json({ error: "Erro interno ao buscar webhook.", details: error.message });
  }
};

export const searchEverything = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { q, companyId: targetCompanyId } = req.query;
    if (!q) return res.json({ conversations: [], messages: [] });

    const user = (req as any).user;
    const companyId = targetCompanyId || user?.company_id;

    const searchTerm = `%${q}%`;

    // 1. Search Conversations (by name, phone or group name)
    let convQuery = `
      SELECT c.*, 
      (SELECT content FROM whatsapp_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message,
      (SELECT sender_name FROM whatsapp_messages WHERE conversation_id = c.id AND sender_name IS NOT NULL LIMIT 1) as last_sender_name,
      comp.name as company_name,
      COALESCE(ci.name, c.instance) as instance_friendly_name
      FROM whatsapp_conversations c
      LEFT JOIN companies comp ON c.company_id = comp.id
      LEFT JOIN company_instances ci ON c.instance = ci.instance_key
      WHERE (c.contact_name ILIKE $1 OR c.phone ILIKE $1 OR c.group_name ILIKE $1)
    `;
    const convParams: any[] = [searchTerm];

    if (user.role !== 'SUPERADMIN' || companyId) {
      convQuery += ` AND c.company_id = $2`;
      convParams.push(companyId);
    }

    convQuery += ` ORDER BY c.last_message_at DESC NULLS LAST LIMIT 20`;

    // 2. Search Message Content
    let msgQuery = `
      SELECT m.*, 
             c.contact_name, 
             c.phone as chat_phone, 
             c.is_group, 
             c.group_name,
             u.full_name as user_name,
             COALESCE(ci.name, c.instance) as instance_friendly_name
      FROM whatsapp_messages m
      JOIN whatsapp_conversations c ON m.conversation_id = c.id
      LEFT JOIN app_users u ON m.user_id = u.id
      LEFT JOIN company_instances ci ON c.instance = ci.instance_key
      WHERE m.content ILIKE $1
    `;
    const msgParams: any[] = [searchTerm];

    if (user.role !== 'SUPERADMIN' || companyId) {
      msgQuery += ` AND c.company_id = $2`;
      msgParams.push(companyId);
    }

    msgQuery += ` ORDER BY m.sent_at DESC LIMIT 30`;

    const [convRes, msgRes] = await Promise.all([
      pool.query(convQuery, convParams),
      pool.query(msgQuery, msgParams)
    ]);

    res.json({
      conversations: convRes.rows,
      messages: msgRes.rows
    });

  } catch (error) {
    console.error('[searchEverything] Error:', error);
    res.status(500).json({ error: 'Failed to perform search' });
  }
};

// ... (imports remain the same, ensure getEvolutionConfig, pool are imported)

/**
 * Endpoint GLOBAL UNIFICADO para Status do WhatsApp
 * GET /api/system/whatsapp/status
 * 
 * Regra de Ouro:
 * 1. Resolve a instância ativa (prioriza CONNECTED/OPEN no banco).
 * 2. Valida o status em tempo real na Evolution API.
 * 3. Atualiza o banco se houver divergência.
 * 4. Retorna o status FINAL para o frontend (Dashboard/QR).
 */
export const getSystemWhatsappStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const companyId = user.company_id;

    if (!companyId && user.role !== 'SUPERADMIN') {
      return res.status(400).json({ status: 'disconnected', reason: 'no_company' });
    }

    let targetInstance: any = null;
    let config: any = null;

    // 1. RESOLUÇÃO DE INSTÂNCIA (A mesma lógica robusta do CRM)
    if (user.role === 'SUPERADMIN' && !companyId) {
      // SuperAdmin Global
      const settingsRes = await pool!.query("SELECT value->>'instance_id' as id FROM system_settings WHERE key = 'integrai_official_instance'");
      if (settingsRes.rows.length > 0 && settingsRes.rows[0].id) {
        const instRes = await pool!.query("SELECT * FROM company_instances WHERE id = $1", [settingsRes.rows[0].id]);
        targetInstance = instRes.rows[0];
      }
    } else {
      // Busca TODAS as instâncias
      const allInstancesRes = await pool!.query(
        "SELECT * FROM company_instances WHERE company_id = $1 ORDER BY updated_at DESC",
        [companyId]
      );

      if (allInstancesRes.rows.length > 0) {
        // Prioriza: 1. OPEN/CONNECTED, 2. CONNECTING, 3. Recente
        const instances = allInstancesRes.rows;
        targetInstance = instances.find((i: any) => i.status && ['open', 'connected', 'online'].includes(i.status.toLowerCase()));

        if (!targetInstance) {
          targetInstance = instances.find((i: any) => i.status && ['connecting', 'qrcode'].includes(i.status.toLowerCase()));
        }
        if (!targetInstance) {
          targetInstance = instances[0]; // Fallback para a mais recente
        }
      }
    }

    // Se nenhuma instância existir no banco, verificamos o legado e tentamos migrar
    if (!targetInstance) {
      // Fallback Legado: Verificar tabela companies
      if (companyId) {
        const legacyRes = await pool!.query("SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1", [companyId]);
        if (legacyRes.rows.length > 0 && legacyRes.rows[0].evolution_instance) {
          const legacyInstanceName = legacyRes.rows[0].evolution_instance;
          console.log(`[SystemStatus] Checking Legacy Instance for Migration: ${legacyInstanceName}`);

          // Cria um objeto temporário para validação
          targetInstance = {
            instance_key: legacyInstanceName,
            status: 'unknown',
            phone: 'Migrating...',
            is_legacy_check: true // Flag para saber que precisamos criar depois
          };
        }
      }

      if (!targetInstance) {
        return res.json({
          status: 'disconnected',
          message: 'Nenhuma instância configurada.',
          instance: null
        });
      }
    }

    // 2. BUSCA CONFIGURAÇÃO DA EVOLUTION (URL/KEY)
    config = await getEvolutionConfig(user, 'system_status', companyId, targetInstance.instance_key);
    const { url, apikey, instance } = config;

    // 3. VALIDAÇÃO LIVE NA API (Source of Truth)
    if (!url || !apikey) {
      return res.json({
        status: 'disconnected',
        message: 'API não configurada',
        instance: instance
      });
    }

    const fetchUrl = `${url.replace(/\/$/, "")}/instance/connectionState/${instance}`;
    console.log(`[SystemStatus] Checking Live Status for ${instance}...`);

    try {
      const response = await fetch(fetchUrl, {
        method: "GET",
        headers: { "apikey": apikey }
      });

      if (!response.ok) {
        // Se der 404, a instância não existe na Evolution (deletada ou nunca criada) -> Disconnected
        if (response.status === 404) {
          await pool!.query("UPDATE company_instances SET status = 'disconnected' WHERE instance_key = $1", [instance]);
          return res.json({ status: 'disconnected', message: 'Instância não encontrada na API', instance });
        }
        return res.json({ status: 'disconnected', message: `Erro API: ${response.status}`, instance });
      }

      const data = await response.json();
      const rawState = data?.instance?.state || data?.state || 'unknown';
      const state = String(rawState).toLowerCase();

      // Mapeamento Oficial de Status
      let finalStatus = 'disconnected';
      if (['open', 'connected', 'online'].includes(state)) finalStatus = 'connected';
      else if (['connecting', 'pairing'].includes(state)) finalStatus = 'connecting';

      // 4. ATUALIZA O BANCO SE HOUVER MUDANÇA (Self-Healing & Migration)
      if (finalStatus !== 'disconnected' || targetInstance.status !== finalStatus) {
        if (targetInstance.is_legacy_check && finalStatus === 'connected') {
          // MIGRATION: Insert logic
          console.log(`[SystemStatus] MIGRATING Legacy Instance ${instance} to company_instances...`);
          await pool!.query(
            `INSERT INTO company_instances (company_id, instance_key, api_key, status, phone, created_at, updated_at)
                  VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                  ON CONFLICT (instance_key) DO UPDATE SET status = $4`,
            [companyId, instance, apikey, finalStatus, 'Importado']
          );
        } else if (!targetInstance.is_legacy_check && targetInstance.status !== finalStatus) {
          // UPDATE Logic
          console.log(`[SystemStatus] Updating DB for ${instance}: ${targetInstance.status} -> ${finalStatus}`);
          await pool!.query("UPDATE company_instances SET status = $1 WHERE instance_key = $2", [finalStatus, instance]);
        }
      }

      return res.json({
        status: finalStatus,
        state: state, // Raw state for debug
        instance: instance,
        phone: targetInstance.phone,
        name: targetInstance.instance_key
      });

    } catch (error: any) {
      console.error(`[SystemStatus] Fetch Error: ${error.message}`);
      return res.json({ status: 'disconnected', error: error.message, instance });
    }

  } catch (err: any) {
    console.error(`[SystemStatus] Critical Error: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
