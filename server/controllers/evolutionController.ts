import { Request, Response } from "express";
import { pool } from "../db";
import { logEvent } from "../logger";

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

export const getEvolutionConfig = async (user: any, source: string = 'unknown', targetCompanyId?: number | string, targetInstanceKey?: string) => {
  // Base configuration from env (fallback)
  let config = {
    url: (process.env.EVOLUTION_API_URL || DEFAULT_URL).replace(/['"]/g, "").replace(/\/$/, ""),
    apikey: (process.env.EVOLUTION_API_KEY || "").replace(/['"]/g, ""),
    instance: "integrai", // Default instance for Integrai
    company_id: null as number | null
  };

  if (!pool) return config;

  try {
    const role = (user?.role || '').toUpperCase();
    const isMasterUser = role === 'SUPERADMIN';
    let resolvedCompanyId: number | null = null;

    if (targetCompanyId) {
      resolvedCompanyId = Number(targetCompanyId);
    } else if (user?.company_id) {
      resolvedCompanyId = Number(user.company_id);
    }

    if (resolvedCompanyId) {
      // 1. If strict instance requested, try to find it
      if (targetInstanceKey) {
        const instRes = await pool.query('SELECT instance_key, api_key FROM company_instances WHERE instance_key = $1 AND company_id = $2', [targetInstanceKey, resolvedCompanyId]);
        if (instRes.rows.length > 0) {
          const row = instRes.rows[0];
          config.instance = row.instance_key;
          config.apikey = row.api_key || config.apikey;
          config.company_id = resolvedCompanyId;
          console.log(`[Evolution Config] RESOLVED SPECIFIC INSTANCE: ${config.instance} for Company ${resolvedCompanyId}`);
          return config;
        }
      }

      // 2. Fallback to main company config
      const compRes = await pool.query('SELECT name, evolution_instance, evolution_apikey FROM companies WHERE id = $1', [resolvedCompanyId]);
      if (compRes.rows.length > 0) {
        const { name, evolution_instance, evolution_apikey } = compRes.rows[0];

        // If targetInstanceKey was requested but failed the instance check above, check if it matches the MAIN instance
        if (targetInstanceKey && evolution_instance !== targetInstanceKey) {
          console.warn(`[Evolution Config] Requested instance ${targetInstanceKey} not found for company ${resolvedCompanyId}. Falling back to main: ${evolution_instance}`);
          // Proceed to use main, or should we error? Proceeding as fallback.
        }

        if (evolution_instance) {
          config.instance = evolution_instance;
          config.apikey = evolution_apikey || config.apikey;
          config.company_id = resolvedCompanyId;
          console.log(`[Evolution Config] RESOLVED PER-COMPANY: ${name} (${resolvedCompanyId}) -> Instance: ${config.instance}`);
        } else {
          console.warn(`[Evolution Config] Company ${resolvedCompanyId} found but MISSING instance or apikey in DB. Using defaults.`);
        }
      } else {
        console.warn(`[Evolution Config] Company ID ${resolvedCompanyId} NOT FOUND in database.`);
      }
    } else if (isMasterUser) {
      // Superadmin without company context: fallback to Integrai (usually ID 1)
      const masterRes = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = 1 LIMIT 1');
      if (masterRes.rows.length > 0) {
        config.instance = masterRes.rows[0].evolution_instance || "integrai";
        config.apikey = masterRes.rows[0].evolution_apikey || config.apikey;
        config.company_id = 1;
        console.log(`[Evolution Config] MASTER FALLBACK (ID:1) -> Instance: ${config.instance}`);
      }
    }

  } catch (e: any) {
    console.error("[Evolution Config Erro]:", e.message);
  }

  // Final validation log (masking key)
  const maskedKey = config.apikey ? `***${config.apikey.slice(-4)}` : 'MISSING';
  console.log(`[Evolution Debug] [Source: ${source}] Final Config: Instance=${config.instance}, Key=${maskedKey}, CompanyId=${config.company_id}`);

  return config;
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
    const connectUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/connect/${EVOLUTION_INSTANCE}`;
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
      // Auto-Create Logic if 404
      if (response.status === 404 && (errorText.includes("does not exist") || errorText.includes("not found"))) {
        console.log(`[Evolution] Instance ${EVOLUTION_INSTANCE} not found. Attempting to create it...`);

        const createUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/create`;
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            instanceName: EVOLUTION_INSTANCE,
            token: "", // Empty token usually defaults to random or global
            qrcode: true // Return QR immediately
          })
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          console.log(`[Evolution] Instance ${EVOLUTION_INSTANCE} created successfully.`);

          // Return the data directly from creation as it usually mimics the connect response
          const qrCode = (createData.qrcode as string) || (createData.qr as string) || undefined;

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

            const wUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/set/${EVOLUTION_INSTANCE}`;
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
            instance: EVOLUTION_INSTANCE,
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
      message: `QR Code solicitado para instÃ¢ncia ${EVOLUTION_INSTANCE}`,
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
      console.log(`[Evolution] Auto-registering Webhook for ${EVOLUTION_INSTANCE}: ${webhookUrl}`);

      const endpoints = [
        `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/set/${EVOLUTION_INSTANCE}`,
        `${EVOLUTION_API_URL.replace(/\/$/, "")}/webhook/instance/${EVOLUTION_INSTANCE}`
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

    // A API costuma retornar algo como { qrCode: "data:image/png;base64,..." } ou campos similares.
    const qrCode =
      (data.qrCode as string) ||
      (data.qrcode as string) ||
      (data.qr_code as string) ||
      (data.qr as string) ||
      (data.base64 as string) ||
      undefined;

    return res.status(200).json({
      raw: data,
      qrcode: qrCode,
      instance: EVOLUTION_INSTANCE // Return instance name so frontend can show it
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
  const config = await getEvolutionConfig((req as any).user, 'disconnect', targetCompanyId, targetInstanceKey);
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/logout/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
    });

    if (!response.ok) {
      // Se der erro 404, pode ser que jÃ¡ esteja desconectado, entÃ£o tratamos como sucesso ou erro leve
      if (response.status === 404) {
        return res.status(200).json({ message: "Instance was already disconnected" });
      }

      const text = await response.text().catch(() => undefined);
      return res.status(response.status).json({
        error: "Failed to disconnect instance",
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Erro ao desconectar instÃ¢ncia Evolution:", error);
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

  } catch (error) {
    // console.error("Error fetching connection state:", error); 
    // Suppress heavy logging for polling
    return res.json({ instance: EVOLUTION_INSTANCE, state: 'unknown' });
  }
};

import { checkLimit, incrementUsage } from '../services/limitService';

export const sendEvolutionMessage = async (req: Request, res: Response) => {
  const { companyId, instanceKey } = req.body;
  const config = await getEvolutionConfig((req as any).user, 'sendMessage', companyId, instanceKey);
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
        console.warn(`[Evolution] Message limit reached for company ${resolvedCompanyId}`);
        return res.status(403).json({ error: 'Limite de mensagens atingido para este mÃªs.' });
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

    // Ensure correct JID format
    if (targetPhone && !targetPhone.includes('@')) {
      if (isGroup) {
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

        // Find or create conversation
        let conversationId: number;

        const user = (req as any).user;
        const resolvedCompanyId = config.company_id;

        // CHECK INSTANCE AND COMPANY isolation
        const checkConv = await pool.query(
          'SELECT id, status, user_id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2 AND company_id = $3',
          [remoteJid, EVOLUTION_INSTANCE, resolvedCompanyId]
        );

        if (checkConv.rows.length > 0) {
          conversationId = checkConv.rows[0].id;
          // Update status to OPEN if it was PENDING/null, assign user if unassigned, and update last_message metadata
          await pool.query(
            `UPDATE whatsapp_conversations 
             SET last_message = $1, last_message_at = NOW(), status = 'OPEN', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3)
             WHERE id = $4`,
            [messageContent, user.id, resolvedCompanyId, conversationId]
          );
        } else {
          // Create new conversation as OPEN and assigned to the sender
          const newConv = await pool.query(
            `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id) 
             VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, NOW(), $7) RETURNING id`,
            [remoteJid, safePhone, safePhone, EVOLUTION_INSTANCE, user.id, messageContent, resolvedCompanyId]
          );
          conversationId = newConv.rows[0].id;
        }

        const externalMessageId = data?.key?.id;

        // Insert message WITH USER_ID and company_id, handling race condition with webhook
        // If webhook inserted first (user_id=null), this will update it.
        const insertedMsg = await pool.query(
          `INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, company_id) 
           VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7) 
           ON CONFLICT (external_id) DO UPDATE 
           SET user_id = EXCLUDED.user_id, company_id = EXCLUDED.company_id 
           RETURNING *`,
          [conversationId, 'outbound', messageContent, 'sent', externalMessageId, user.id, resolvedCompanyId]
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
          phone: safePhone,
          remoteJid: remoteJid
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
        return res.status(403).json({ error: 'Limite de mensagens atingido para este mÃªs.' });
      }
    }

    const { phone, media, mediaType, caption, fileName } = req.body;

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
        const remoteJid = safePhone.includes('@') ? safePhone : `${safePhone}@s.whatsapp.net`;
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
            `UPDATE whatsapp_conversations SET last_message = $1, last_message_at = NOW(), status = 'OPEN', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3) WHERE id = $4`,
            [content, user.id, resolvedCompanyId, conversationId]
          );
        } else {
          const newConv = await pool.query(
            `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id) VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, NOW(), $7) RETURNING id`,
            [remoteJid, safePhone, safePhone, EVOLUTION_INSTANCE, user.id, content, resolvedCompanyId]
          );
          conversationId = newConv.rows[0].id;
        }

        const externalMessageId = data?.key?.id;

        const insertedMsg = await pool.query(
          'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, message_type, media_url, company_id) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING RETURNING *',
          [conversationId, 'outbound', content, 'sent', externalMessageId, user.id, mediaType, (media.startsWith('http') ? media : null), resolvedCompanyId]
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
          phone: safePhone,
          remoteJid: remoteJid
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

    // 2. Iterate and Sync
    for (const instKey of instancesToProcess) {
      try {
        const config = await getEvolutionConfig(user, 'syncContacts', targetCompanyId, instKey);
        const EVOLUTION_API_URL = config.url?.replace(/\/$/, "");
        const EVOLUTION_API_KEY = config.apikey?.trim();
        const EVOLUTION_INSTANCE = config.instance;

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
          console.warn(`[Sync] Skipping instance ${instKey || 'Default'}: Config missing.`);
          continue;
        }

        // --- Connection Check ---
        try {
          const checkUrl = `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`;
          const checkRes = await fetch(checkUrl, {
            method: 'GET',
            headers: { "apikey": EVOLUTION_API_KEY }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            const state = (checkData?.instance?.state || checkData?.state || 'unknown');
            if (state !== 'open') {
              console.warn(`[Sync] Skipping instance ${EVOLUTION_INSTANCE} because it is not OPEN (State: ${state})`);
              errorDetails.push(`Instance ${EVOLUTION_INSTANCE} is ${state}`);
              continue;
            }
          }
        } catch (connErr) {
          console.warn(`[Sync] Failed to check connection for ${EVOLUTION_INSTANCE}:`, connErr);
          // We proceed anyway in case the check failed but API works, but log it
        }
        // ------------------------

        console.log(`[Sync] Instance: ${EVOLUTION_INSTANCE} (Key: ***${EVOLUTION_API_KEY.slice(-4)})`);

        // Endpoints to try
        const endpoints = [
          { url: `${EVOLUTION_API_URL}/chat/fetchContacts/${EVOLUTION_INSTANCE}`, method: 'GET' },
          { url: `${EVOLUTION_API_URL}/chat/fetchContacts/${EVOLUTION_INSTANCE}`, method: 'POST', body: { where: {} } },
          { url: `${EVOLUTION_API_URL}/contact/fetchContacts/${EVOLUTION_INSTANCE}`, method: 'GET' },
          { url: `${EVOLUTION_API_URL}/contact/find/${EVOLUTION_INSTANCE}`, method: 'POST', body: { where: {} } },
          { url: `${EVOLUTION_API_URL}/chat/findContacts/${EVOLUTION_INSTANCE}`, method: 'POST', body: { where: {} } }
        ];

        let contactsList: any[] = [];
        let success = false;
        let lastError = "";

        for (const ep of endpoints) {
          try {
            console.log(`[Sync] Trying ${ep.method} to ${ep.url}`);
            const fetchOptions: any = {
              method: ep.method,
              headers: {
                "Content-Type": "application/json",
                "apikey": EVOLUTION_API_KEY
              }
            };
            if (ep.method === 'POST') {
              fetchOptions.body = JSON.stringify(ep.body || {});
            }

            const response = await fetch(ep.url, fetchOptions);

            const contentType = response.headers.get("content-type");
            if (response.ok && contentType && contentType.includes("application/json")) {
              const rawData = await response.json();
              contactsList = Array.isArray(rawData) ? rawData : (rawData.data || rawData.contacts || rawData.results || []);
              success = true;
              console.log(`[Sync] Success via ${ep.url} (${ep.method}). Items: ${contactsList.length}`);
              break;
            } else {
              const bodyText = await response.text().catch(() => "N/A");
              lastError = `Status ${response.status} | Body: ${bodyText.substring(0, 50)}`;
              console.warn(`[Sync] Endpoint failed ${ep.url} (${ep.method}): ${lastError}`);
            }
          } catch (err: any) {
            lastError = err.message;
            console.warn(`[Sync] Error calling ${ep.url}: ${err.message}`);
          }
        }

        if (!success) {
          errorDetails.push(`Instance ${EVOLUTION_INSTANCE}: ${lastError}`);
          continue; // Try next instance
        }

        // Upsert Contacts Logic
        if (pool && contactsList.length > 0) {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const processedJids = new Set<string>();

            for (const contact of contactsList) {
              const rawId = contact.id || contact.remoteJid || contact.jid;
              if (!rawId || contact.isGroup || rawId.endsWith('@g.us')) {
                continue;
              }

              let candidate = null;
              const potentialFields = [contact.id, contact.remoteJid, contact.number, contact.phone];

              for (const field of potentialFields) {
                if (typeof field === 'string' && field) {
                  const clean = field.split('@')[0].split(':')[0];
                  if (/^\d+$/.test(clean) && clean.length >= 7 && clean.length <= 16) {
                    candidate = clean;
                    break;
                  }
                }
              }

              if (!candidate) continue;
              const jid = `${candidate}@s.whatsapp.net`;

              if (processedJids.has(jid)) continue;
              processedJids.add(jid);

              const name = contact.name || contact.pushName || contact.notify || contact.verifiedName || candidate;
              const pushName = contact.pushName || contact.notify;
              const profilePic = contact.profilePictureUrl || contact.profilePicture;

              await client.query(`
                INSERT INTO whatsapp_contacts (jid, phone, name, push_name, profile_pic_url, instance, updated_at, company_id)
                VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
                ON CONFLICT (jid, company_id) 
                DO UPDATE SET 
                  name = EXCLUDED.name,
                  push_name = EXCLUDED.push_name,
                  profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, whatsapp_contacts.profile_pic_url),
                  phone = EXCLUDED.phone,
                  instance = EXCLUDED.instance,
                  updated_at = NOW()
              `, [jid, candidate, name, pushName || null, profilePic || null, EVOLUTION_INSTANCE, resolvedCompanyId]);
            }
            await client.query('COMMIT');
            processedCount++;
          } catch (dbErr) {
            await client.query('ROLLBACK');
            console.error(`[Sync] DB Error for ${EVOLUTION_INSTANCE}:`, dbErr);
            errorDetails.push(`DB Error ${EVOLUTION_INSTANCE}: ${(dbErr as any).message}`);
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

    return res.json(finalContacts?.rows || []);

  } catch (error: any) {
    console.error("CRITICAL SYNC ERROR:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: "Erro interno no servidor de sincronizaÃ§Ã£o",
        details: error?.message
      });
    }
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

    // Return mapped simple objects
    const mapped = contactsList.map(c => {
      const jid = c.id || c.remoteJid || c.jid;
      // Basic clean: handle suffixes like :1
      const phone = jid ? jid.split('@')[0].split(':')[0] : (c.phone || c.number || "");
      return {
        id: jid || phone,
        name: c.name || c.pushName || c.notify || phone,
        phone: phone,
        profile_pic_url: c.profilePictureUrl || c.profilePicture
      };
    }).filter(c => c.phone && /^\d+$/.test(c.phone)); // Filter valid numeric phones

    return res.json(mapped);

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

    // Validate phone format - remove non-digits
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      if (!pool) return res.status(500).json({ error: "Database not configured" });

      const user = (req as any).user;
      const companyId = user?.company_id;

      // Insert into DB
      await pool.query(`
          INSERT INTO whatsapp_contacts (jid, phone, name, instance, updated_at, company_id)
          VALUES ($1, $2, $3, $4, NOW(), $5)
          ON CONFLICT (jid, company_id) 
          DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(), phone = EXCLUDED.phone, instance = EXCLUDED.instance
      `, [jid, cleanPhone, name, EVOLUTION_INSTANCE, companyId]);

      return res.status(201).json({
        id: jid,
        name,
        phone: cleanPhone,
        jid
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
        else if (messageType === 'audioMessage') content = "[Ãudio]";
        else if (messageType === 'videoMessage') content = "[VÃ­deo]";
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
                // Find 'Leads' stage ID
                const leadStageRes = await pool.query("SELECT id FROM crm_stages WHERE name = 'Leads' LIMIT 1");

                if (leadStageRes.rows.length > 0) {
                  const leadsStageId = leadStageRes.rows[0].id;

                  // Check if lead exists by phone
                  const checkLead = await pool.query("SELECT id FROM crm_leads WHERE phone = $1", [phone]);

                  if (checkLead.rows.length === 0) {
                    console.log(`[CRM] Auto-creating lead for UNSAVED contact ${phone}`);
                    await pool.query(
                      `INSERT INTO crm_leads (name, phone, stage_id, origin, company_id, instance, created_at, updated_at)
                                 VALUES ($1, $2, $3, 'WhatsApp', $4, $5, NOW(), NOW())`,
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

    await pool.query(
      'UPDATE whatsapp_contacts SET name = $1 WHERE id = $2 AND company_id = $3',
      [name, id, resolvedCompanyId]
    );

    return res.json({ status: "updated", id, name });

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
    if (message_type === 'image') res.setHeader('Content-Type', 'image/jpeg');
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

    // Fetch conversations without profile pics
    let query = "SELECT external_id, phone FROM whatsapp_conversations WHERE (profile_pic_url IS NULL OR profile_pic_url = '') AND instance = $1";
    const params = [EVOLUTION_INSTANCE];

    if (user.role !== 'SUPERADMIN' || companyId) {
      query += " AND (company_id = $2 OR company_id IS NULL)";
      params.push(companyId);
    }

    const { rows } = await pool.query(query, params);

    let count = 0;
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

    // Process in background and return immediate status if there are many, or wait if few
    res.json({ success: true, message: `Syncing ${rows.length} profile pictures in background...`, totalFound: rows.length });

    // Process in background
    (async () => {
      for (const conv of rows) {
        try {
          const phone = conv.external_id || conv.phone;
          const response = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${EVOLUTION_INSTANCE}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
            body: JSON.stringify({ number: phone })
          });

          if (response.ok) {
            const data = await response.json();
            const picUrl = data.profilePictureUrl || data.url;
            if (picUrl) {
              await Promise.all([
                pool.query("UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE external_id = $2 AND instance = $3", [picUrl, conv.external_id, EVOLUTION_INSTANCE]),
                pool.query("UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE jid = $2 AND instance = $3", [picUrl, conv.external_id, EVOLUTION_INSTANCE])
              ]);
              count++;
            }
          }
          // Small delay to be polite to the API
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Error syncing pic for ${conv.external_id}:`, err);
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
    const config = await getEvolutionConfig(user, 'refreshMetadata');
    const { url: EVOLUTION_API_URL, apikey: EVOLUTION_API_KEY, instance: EVOLUTION_INSTANCE } = config;

    // 1. Get Conversation
    const convRes = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = $1', [conversationId]);
    if (convRes.rows.length === 0) return res.status(404).json({ error: "Conversation not found" });
    const conv = convRes.rows[0];
    const remoteJid = conv.external_id;

    // 2. Fetch Group Metadata if Group
    let updatedName = conv.contact_name;
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

      console.log(`[Refresh] Fetching Group Info for ${groupJid} (Original: ${remoteJid}) on Instance: ${targetInstance}`);
      const groupUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/group/findGroup/${targetInstance}?groupJid=${groupJid}`;
      const gRes = await fetch(groupUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY || "" }
      });

      let nameFound = false;
      if (gRes.ok) {
        const gData = await gRes.json();
        const subject = gData.subject || gData.name;
        if (subject) {
          updatedName = subject;
          await pool.query('UPDATE whatsapp_conversations SET contact_name = $1, group_name = $1 WHERE id = $2', [subject, conversationId]);
          console.log(`[Refresh] Updated group name: ${subject}`);
          nameFound = true;
        }
      } else {
        console.warn(`[Refresh] Failed to fetch group info: ${gRes.status}`);
      }

      // Fallback: Fetch all groups if direct fetch failed
      if (!nameFound) {
        console.log(`[Refresh] Fallback: Fetching ALL groups to find ${groupJid} on Instance: ${targetInstance}`);
        try {
          const allGroupsUrl = `${EVOLUTION_API_URL.replace(/\/$/, "")}/group/fetchAllGroups/${targetInstance}?getParticipants=false`;
          const allRes = await fetch(allGroupsUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY || "" }
          });
          if (allRes.ok) {
            const allData = await allRes.json();
            // Find the group with matching JID
            const match = allData.find((g: any) => g.id === groupJid || g.id === remoteJid);
            if (match && (match.subject || match.name)) {
              const subject = match.subject || match.name;
              updatedName = subject;
              await pool.query('UPDATE whatsapp_conversations SET contact_name = $1, group_name = $1 WHERE id = $2', [subject, conversationId]);
              console.log(`[Refresh] Fallback success! Updated group name: ${subject}`);
            }
          }
        } catch (e) {
          console.error("[Refresh] Fallback error:", e);
        }
      }
    }

    // 3. Fetch Profile Picture (Always try)
    console.log(`[Refresh] Fetching Profile Pic for ${remoteJid}`);
    // Endpoint might be /chat/fetchProfilePictureUrl or similar. Code uses that elsewhere.
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
        await pool.query('UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE id = $2', [url, conversationId]);
        // Also update contacts if not group
        if (!conv.is_group) {
          await pool.query('UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE jid = $2 AND instance = $3', [url, remoteJid, EVOLUTION_INSTANCE]);
        }
        console.log(`[Refresh] Updated profile pic: ${url}`);
      }
    } else {
      console.warn(`[Refresh] Failed to fetch pic: ${picRes.status}`);
    }

    // 4. Emit update
    const io = req.app.get('io');
    if (io && user.company_id) {
      io.to(`company_${user.company_id}`).emit('conversation:update', {
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
    return res.status(500).json({ error: "ConfiguraÃ§Ã£o da Evolution API ausente." });
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

    // Tentamos os dois endpoints possÃ­veis dependendo da versÃ£o (v1/v2)
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

    // Se for um ID numÃ©rico, apaga direto
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
    return res.status(500).json({ error: "ConfiguraÃ§Ã£o da Evolution API ausente." });
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
 
 / /   . . .   ( i m p o r t s   r e m a i n   t h e   s a m e ,   e n s u r e   g e t E v o l u t i o n C o n f i g ,   p o o l   a r e   i m p o r t e d )  
  
 / * *  
   *   E n d p o i n t   G L O B A L   U N I F I C A D O   p a r a   S t a t u s   d o   W h a t s A p p  
   *   G E T   / a p i / s y s t e m / w h a t s a p p / s t a t u s  
   *    
   *   R e g r a   d e   O u r o :  
   *   1 .   R e s o l v e   a   i n s t Ã ¢ n c i a   a t i v a   ( p r i o r i z a   C O N N E C T E D / O P E N   n o   b a n c o ) .  
   *   2 .   V a l i d a   o   s t a t u s   e m   t e m p o   r e a l   n a   E v o l u t i o n   A P I .  
   *   3 .   A t u a l i z a   o   b a n c o   s e   h o u v e r   d i v e r g Ã ª n c i a .  
   *   4 .   R e t o r n a   o   s t a t u s   F I N A L   p a r a   o   f r o n t e n d   ( D a s h b o a r d / Q R ) .  
   * /  
 e x p o r t   c o n s t   g e t S y s t e m W h a t s a p p S t a t u s   =   a s y n c   ( r e q :   R e q u e s t ,   r e s :   R e s p o n s e )   = >   {  
         t r y   {  
                 c o n s t   u s e r   =   ( r e q   a s   a n y ) . u s e r ;  
                 c o n s t   c o m p a n y I d   =   u s e r . c o m p a n y _ i d ;  
  
                 i f   ( ! c o m p a n y I d   & &   u s e r . r o l e   ! = =   ' S U P E R A D M I N ' )   {  
                         r e t u r n   r e s . s t a t u s ( 4 0 0 ) . j s o n ( {   s t a t u s :   ' d i s c o n n e c t e d ' ,   r e a s o n :   ' n o _ c o m p a n y '   } ) ;  
                 }  
  
                 l e t   t a r g e t I n s t a n c e :   a n y   =   n u l l ;  
                 l e t   c o n f i g :   a n y   =   n u l l ;  
  
                 / /   1 .   R E S O L U Ã ! Ã ’O   D E   I N S T Ã  N C I A   ( A   m e s m a   l Ã ³ g i c a   r o b u s t a   d o   C R M )  
                 i f   ( u s e r . r o l e   = = =   ' S U P E R A D M I N '   & &   ! c o m p a n y I d )   {  
                         / /   S u p e r A d m i n   G l o b a l  
                         c o n s t   s e t t i n g s R e s   =   a w a i t   p o o l ! . q u e r y ( " S E L E C T   v a l u e - > > ' i n s t a n c e _ i d '   a s   i d   F R O M   s y s t e m _ s e t t i n g s   W H E R E   k e y   =   ' i n t e g r a i _ o f f i c i a l _ i n s t a n c e ' " ) ;  
                         i f   ( s e t t i n g s R e s . r o w s . l e n g t h   >   0   & &   s e t t i n g s R e s . r o w s [ 0 ] . i d )   {  
                                 c o n s t   i n s t R e s   =   a w a i t   p o o l ! . q u e r y ( " S E L E C T   *   F R O M   c o m p a n y _ i n s t a n c e s   W H E R E   i d   =   $ 1 " ,   [ s e t t i n g s R e s . r o w s [ 0 ] . i d ] ) ;  
                                 t a r g e t I n s t a n c e   =   i n s t R e s . r o w s [ 0 ] ;  
                         }  
                 }   e l s e   {  
                         / /   B u s c a   T O D A S   a s   i n s t Ã ¢ n c i a s  
                         c o n s t   a l l I n s t a n c e s R e s   =   a w a i t   p o o l ! . q u e r y (  
                                 " S E L E C T   *   F R O M   c o m p a n y _ i n s t a n c e s   W H E R E   c o m p a n y _ i d   =   $ 1   O R D E R   B Y   u p d a t e d _ a t   D E S C " ,  
                                 [ c o m p a n y I d ]  
                         ) ;  
  
                         i f   ( a l l I n s t a n c e s R e s . r o w s . l e n g t h   >   0 )   {  
                                 / /   P r i o r i z a :   1 .   O P E N / C O N N E C T E D ,   2 .   C O N N E C T I N G ,   3 .   R e c e n t e  
                                 c o n s t   i n s t a n c e s   =   a l l I n s t a n c e s R e s . r o w s ;  
                                 t a r g e t I n s t a n c e   =   i n s t a n c e s . f i n d ( ( i :   a n y )   = >   i . s t a t u s   & &   [ ' o p e n ' ,   ' c o n n e c t e d ' ,   ' o n l i n e ' ] . i n c l u d e s ( i . s t a t u s . t o L o w e r C a s e ( ) ) ) ;  
  
                                 i f   ( ! t a r g e t I n s t a n c e )   {  
                                         t a r g e t I n s t a n c e   =   i n s t a n c e s . f i n d ( ( i :   a n y )   = >   i . s t a t u s   & &   [ ' c o n n e c t i n g ' ,   ' q r c o d e ' ] . i n c l u d e s ( i . s t a t u s . t o L o w e r C a s e ( ) ) ) ;  
                                 }  
                                 i f   ( ! t a r g e t I n s t a n c e )   {  
                                         t a r g e t I n s t a n c e   =   i n s t a n c e s [ 0 ] ;   / /   F a l l b a c k   p a r a   a   m a i s   r e c e n t e  
                                 }  
                         }  
                 }  
  
                 / /   S e   n e n h u m a   i n s t Ã ¢ n c i a   e x i s t i r   n o   b a n c o  
                 i f   ( ! t a r g e t I n s t a n c e )   {  
                         r e t u r n   r e s . j s o n ( {  
                                 s t a t u s :   ' d i s c o n n e c t e d ' ,  
                                 m e s s a g e :   ' N e n h u m a   i n s t Ã ¢ n c i a   c o n f i g u r a d a . ' ,  
                                 i n s t a n c e :   n u l l  
                         } ) ;  
                 }  
  
                 / /   2 .   B U S C A   C O N F I G U R A Ã ! Ã ’O   D A   E V O L U T I O N   ( U R L / K E Y )  
                 c o n f i g   =   a w a i t   g e t E v o l u t i o n C o n f i g ( u s e r ,   ' s y s t e m _ s t a t u s ' ,   c o m p a n y I d ,   t a r g e t I n s t a n c e . i n s t a n c e _ k e y ) ;  
                 c o n s t   {   u r l ,   a p i k e y ,   i n s t a n c e   }   =   c o n f i g ;  
  
                 / /   3 .   V A L I D A Ã ! Ã ’O   L I V E   N A   A P I   ( S o u r c e   o f   T r u t h )  
                 i f   ( ! u r l   | |   ! a p i k e y )   {  
                         r e t u r n   r e s . j s o n ( {  
                                 s t a t u s :   ' d i s c o n n e c t e d ' ,  
                                 m e s s a g e :   ' A P I   n Ã £ o   c o n f i g u r a d a ' ,  
                                 i n s t a n c e :   i n s t a n c e  
                         } ) ;  
                 }  
  
                 c o n s t   f e t c h U r l   =   ` $ { u r l . r e p l a c e ( / \ / $ / ,   " " ) } / i n s t a n c e / c o n n e c t i o n S t a t e / $ { i n s t a n c e } ` ;  
                 c o n s o l e . l o g ( ` [ S y s t e m S t a t u s ]   C h e c k i n g   L i v e   S t a t u s   f o r   $ { i n s t a n c e } . . . ` ) ;  
  
                 t r y   {  
                         c o n s t   r e s p o n s e   =   a w a i t   f e t c h ( f e t c h U r l ,   {  
                                 m e t h o d :   " G E T " ,  
                                 h e a d e r s :   {   " a p i k e y " :   a p i k e y   }  
                         } ) ;  
  
                         i f   ( ! r e s p o n s e . o k )   {  
                                 / /   S e   d e r   4 0 4 ,   a   i n s t Ã ¢ n c i a   n Ã £ o   e x i s t e   n a   E v o l u t i o n   ( d e l e t a d a   o u   n u n c a   c r i a d a )   - >   D i s c o n n e c t e d  
                                 i f   ( r e s p o n s e . s t a t u s   = = =   4 0 4 )   {  
                                         a w a i t   p o o l ! . q u e r y ( " U P D A T E   c o m p a n y _ i n s t a n c e s   S E T   s t a t u s   =   ' d i s c o n n e c t e d '   W H E R E   i n s t a n c e _ k e y   =   $ 1 " ,   [ i n s t a n c e ] ) ;  
                                         r e t u r n   r e s . j s o n ( {   s t a t u s :   ' d i s c o n n e c t e d ' ,   m e s s a g e :   ' I n s t Ã ¢ n c i a   n Ã £ o   e n c o n t r a d a   n a   A P I ' ,   i n s t a n c e   } ) ;  
                                 }  
                                 r e t u r n   r e s . j s o n ( {   s t a t u s :   ' d i s c o n n e c t e d ' ,   m e s s a g e :   ` E r r o   A P I :   $ { r e s p o n s e . s t a t u s } ` ,   i n s t a n c e   } ) ;  
                         }  
  
                         c o n s t   d a t a   =   a w a i t   r e s p o n s e . j s o n ( ) ;  
                         c o n s t   r a w S t a t e   =   d a t a ? . i n s t a n c e ? . s t a t e   | |   d a t a ? . s t a t e   | |   ' u n k n o w n ' ;  
                         c o n s t   s t a t e   =   S t r i n g ( r a w S t a t e ) . t o L o w e r C a s e ( ) ;  
  
                         / /   M a p e a m e n t o   O f i c i a l   d e   S t a t u s  
                         l e t   f i n a l S t a t u s   =   ' d i s c o n n e c t e d ' ;  
                         i f   ( [ ' o p e n ' ,   ' c o n n e c t e d ' ,   ' o n l i n e ' ] . i n c l u d e s ( s t a t e ) )   f i n a l S t a t u s   =   ' c o n n e c t e d ' ;  
                         e l s e   i f   ( [ ' c o n n e c t i n g ' ,   ' p a i r i n g ' ] . i n c l u d e s ( s t a t e ) )   f i n a l S t a t u s   =   ' c o n n e c t i n g ' ;  
  
                         / /   4 .   A T U A L I Z A   O   B A N C O   S E   H O U V E R   M U D A N Ã ! A   ( S e l f - H e a l i n g )  
                         i f   ( t a r g e t I n s t a n c e . s t a t u s   ! = =   f i n a l S t a t u s )   {  
                                 c o n s o l e . l o g ( ` [ S y s t e m S t a t u s ]   U p d a t i n g   D B   f o r   $ { i n s t a n c e } :   $ { t a r g e t I n s t a n c e . s t a t u s }   - >   $ { f i n a l S t a t u s } ` ) ;  
                                 a w a i t   p o o l ! . q u e r y ( " U P D A T E   c o m p a n y _ i n s t a n c e s   S E T   s t a t u s   =   $ 1 ,   u p d a t e d _ a t   =   N O W ( )   W H E R E   i n s t a n c e _ k e y   =   $ 2 " ,   [ f i n a l S t a t u s ,   i n s t a n c e ] ) ;  
                         }  
  
                         r e t u r n   r e s . j s o n ( {  
                                 s t a t u s :   f i n a l S t a t u s ,  
                                 s t a t e :   s t a t e ,   / /   R a w   s t a t e   f o r   d e b u g  
                                 i n s t a n c e :   i n s t a n c e ,  
                                 p h o n e :   t a r g e t I n s t a n c e . p h o n e ,  
                                 n a m e :   t a r g e t I n s t a n c e . i n s t a n c e _ k e y  
                         } ) ;  
  
                 }   c a t c h   ( e r r o r :   a n y )   {  
                         c o n s o l e . e r r o r ( ` [ S y s t e m S t a t u s ]   F e t c h   E r r o r :   $ { e r r o r . m e s s a g e } ` ) ;  
                         r e t u r n   r e s . j s o n ( {   s t a t u s :   ' d i s c o n n e c t e d ' ,   e r r o r :   e r r o r . m e s s a g e ,   i n s t a n c e   } ) ;  
                 }  
  
         }   c a t c h   ( e r r :   a n y )   {  
                 c o n s o l e . e r r o r ( ` [ S y s t e m S t a t u s ]   C r i t i c a l   E r r o r :   $ { e r r . m e s s a g e } ` ) ;  
                 r e s . s t a t u s ( 5 0 0 ) . j s o n ( {   e r r o r :   ' I n t e r n a l   S e r v e r   E r r o r '   } ) ;  
         }  
 } ;  
 