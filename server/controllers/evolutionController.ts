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

export const getEvolutionConfig = async (user: any, source: string = 'unknown', targetCompanyId?: number | string) => {
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
      const compRes = await pool.query('SELECT name, evolution_instance, evolution_apikey FROM companies WHERE id = $1', [resolvedCompanyId]);
      if (compRes.rows.length > 0) {
        const { name, evolution_instance, evolution_apikey } = compRes.rows[0];
        if (evolution_instance && evolution_apikey) {
          config.instance = evolution_instance;
          config.apikey = evolution_apikey;
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
  const config = await getEvolutionConfig((req as any).user, 'qrcode_connect', targetCompanyId);

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
  const config = await getEvolutionConfig((req as any).user, 'disconnect', targetCompanyId);
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
      // Se der erro 404, pode ser que já esteja desconectado, então tratamos como sucesso ou erro leve
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
    console.error("Erro ao desconectar instância Evolution:", error);
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
  const config = await getEvolutionConfig((req as any).user, 'status_poll', targetCompanyId);
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
    return res.json(data);

  } catch (error) {
    // console.error("Error fetching connection state:", error); 
    // Suppress heavy logging for polling
    return res.json({ instance: EVOLUTION_INSTANCE, state: 'unknown' });
  }
};

import { checkLimit, incrementUsage } from '../services/limitService';

export const sendEvolutionMessage = async (req: Request, res: Response) => {
  const { companyId } = req.body;
  const config = await getEvolutionConfig((req as any).user, 'sendMessage', companyId);
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
        return res.status(403).json({ error: 'Limite de mensagens atingido para este mês.' });
      }
    }

    const { phone, message, text, to, quoted } = req.body;

    // Normalize fields (User asked for "text" but we support "message" too for backward compat, and "to" or "phone")
    const targetPhone = phone || to;
    const messageContent = text || message;

    if (!targetPhone || !messageContent) {
      return res.status(400).json({ error: "Phone (to) and text are required" });
    }

    if (typeof messageContent !== 'string' || messageContent.trim().length === 0) {
      return res.status(400).json({ error: "Message text cannot be empty" });
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
        const remoteJid = safePhone.includes('@') ? safePhone : `${safePhone}@s.whatsapp.net`;

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
  const { companyId } = req.body;
  const config = await getEvolutionConfig((req as any).user, 'sendMedia', companyId);
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
          fileName: fileName
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
    console.log(`[Evolution] Fetching local contacts for instance: ${EVOLUTION_INSTANCE} (Company: ${resolvedCompanyId})`);

    let query = `SELECT *, split_part(jid, '@', 1) as phone FROM whatsapp_contacts WHERE (instance = $1 OR company_id = $2)`;
    const params: any[] = [EVOLUTION_INSTANCE, resolvedCompanyId];

    if (user.role !== 'SUPERADMIN' || resolvedCompanyId) {
      query += ` AND company_id = $2`;
    }

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
  try {
    const config = await getEvolutionConfig((req as any).user, 'syncContacts', targetCompanyId);
    const EVOLUTION_API_URL = config.url.replace(/\/$/, "");
    const EVOLUTION_API_KEY = config.apikey;
    const EVOLUTION_INSTANCE = config.instance;

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    // 1. Fetch from Evolution with multiple fallbacks
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
        console.log(`[Sync] Trying endpoint: ${url}`);
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({})
        });

        if (response.ok) {
          const rawData = await response.json();
          contactsList = Array.isArray(rawData) ? rawData : (rawData.data || rawData.contacts || rawData.results || []);
          console.log(`[Sync] Success with ${url}. Found ${contactsList.length} contacts.`);
          success = true;
          break;
        } else {
          lastError = await response.text();
          console.warn(`[Sync] Endpoint ${url} failed with status ${response.status}: ${lastError.substring(0, 100)}`);
        }
      } catch (err: any) {
        lastError = err.message;
        console.warn(`[Sync] Error calling ${url}: ${err.message}`);
      }
    }

    if (!success) {
      return res.status(502).json({
        error: "Failed to fetch contacts from any known Evolution API endpoint",
        details: lastError
      });
    }

    if (pool && contactsList.length > 0) {
      const user = (req as any).user;
      const companyId = config.company_id || user?.company_id;

      console.log(`[Sync] Processing ${contactsList.length} contacts for company ${companyId}...`);

      // Use a transaction for better performance
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Cleanup invalid or potentially old formats that don't match our normalization
        // (We are more permissive now with what stays in DB, but we keep the instance cleanup)
        // await client.query(`DELETE FROM whatsapp_contacts WHERE instance = $1 AND jid !~ '^[0-9]+@s\\.whatsapp\\.net$'`, [EVOLUTION_INSTANCE]);

        for (const contact of contactsList) {
          let candidate = null;
          // Use id/remoteJid first as they are more reliable in Evolution API
          const potentialFields = [contact.id, contact.remoteJid, contact.number, contact.phone];

          for (const field of potentialFields) {
            if (typeof field === 'string' && field) {
              // Extract CLEAN phone: remove JID suffix AND any device suffixes like :1
              const clean = field.split('@')[0].split(':')[0];
              if (/^\d+$/.test(clean) && clean.length >= 7 && clean.length <= 16) {
                candidate = clean;
                break;
              }
            }
          }

          if (!candidate) continue;

          const jid = `${candidate}@s.whatsapp.net`;
          const name = contact.name || contact.pushName || contact.notify || contact.verifiedName || candidate;
          const pushName = contact.pushName || contact.notify;
          const profilePic = contact.profilePictureUrl || contact.profilePicture;

          await client.query(`
            INSERT INTO whatsapp_contacts (jid, name, push_name, profile_pic_url, instance, updated_at, company_id)
            VALUES ($1, $2, $3, $4, $5, NOW(), $6)
            ON CONFLICT (jid, instance) 
            DO UPDATE SET 
              name = EXCLUDED.name,
              push_name = EXCLUDED.push_name,
              profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, whatsapp_contacts.profile_pic_url),
              updated_at = NOW(),
              company_id = COALESCE(whatsapp_contacts.company_id, EXCLUDED.company_id)
          `, [jid, name, pushName || null, profilePic || null, EVOLUTION_INSTANCE, companyId]);
        }

        await client.query('COMMIT');
        console.log(`[Sync] Finished database update for ${contactsList.length} contacts.`);
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    }

    // Return the updated list to frontend
    const user = (req as any).user;
    const companyId = config.company_id || user?.company_id;
    let localQuery = `SELECT * FROM whatsapp_contacts WHERE instance = $1`;
    const localParams = [EVOLUTION_INSTANCE];

    if (user.role !== 'SUPERADMIN' || companyId) {
      localQuery += ` AND (company_id = $2 OR company_id IS NULL)`;
      localParams.push(companyId);
    }
    localQuery += ` ORDER BY name ASC`;
    const finalContacts = await pool?.query(localQuery, localParams);

    return res.json(finalContacts?.rows || []);

  } catch (error: any) {
    console.error("Error syncing contacts:", error);
    return res.status(500).json({ error: "Sync failed during processing", details: error.message });
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
          INSERT INTO whatsapp_contacts (jid, name, instance, updated_at, company_id)
          VALUES ($1, $2, $3, NOW(), $4)
          ON CONFLICT (jid, instance) 
          DO UPDATE SET name = EXCLUDED.name, updated_at = NOW(), company_id = COALESCE(whatsapp_contacts.company_id, EXCLUDED.company_id)
      `, [jid, name, EVOLUTION_INSTANCE, companyId]);

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

    // V2 structure compatibility: sometimes data is inside 'data' or top level depending on event
    // Typical V2 TEXT_MESSAGE: type: "MESSAGES_UPSERT", data: { messages: [...] } OR directly messages: [...]

    // We focus on MESSAGES_UPSERT or MESSAGES_UPDATE
    // Check event type
    const eventType = type || body.event;

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
                                (external_id, phone, contact_name, instance, last_message, last_message_at, unread_count)
                             VALUES ($1, $2, $3, $4, $5, NOW(), $6)
                             RETURNING id`,
              [remoteJid, phone, finalContactName, instance, content, fromMe ? 0 : 1]
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
                      `INSERT INTO crm_leads (name, phone, stage_id, origin, created_at, updated_at)
                                 VALUES ($1, $2, $3, 'WhatsApp', NOW(), NOW())`,
                      [pushName || phone, phone, leadsStageId]
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

export const deleteEvolutionMessage = async (req: Request, res: Response) => {
  const { conversationId, messageId } = req.params;

  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    console.log(`[Delete] Request to delete message ${messageId} in conversation ${conversationId}`);

    // 1. Get message info for API deletion
    const msgQuery = await pool.query(`
      SELECT m.external_id, c.external_id as remote_jid, m.direction
      FROM whatsapp_messages m
      JOIN whatsapp_conversations c ON m.conversation_id = c.id
      WHERE m.id = $1
    `, [messageId]);

    if (msgQuery.rows.length > 0) {
      const { external_id, remote_jid, direction } = msgQuery.rows[0];
      console.log(`[Delete] Found message in DB. Direction: ${direction}, ExternalID: ${external_id}`);

      if (external_id) {
        const config = await getEvolutionConfig((req as any).user, 'deleteMessage');
        const EVOLUTION_API_URL = config.url;
        const EVOLUTION_API_KEY = config.apikey;
        const EVOLUTION_INSTANCE = config.instance;

        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
          const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/deleteMessage/${EVOLUTION_INSTANCE}`;

          // Determine if we delete for everyone (only for outbound)
          const deleteForEveryone = direction === 'outbound';

          console.log(`[Delete] Calling Evolution API: ${url} (Everyone: ${deleteForEveryone})`);

          const evoRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify({
              number: remote_jid.split('@')[0],
              key: {
                remoteJid: remote_jid,
                fromMe: direction === 'outbound',
                id: external_id
              },
              everyone: deleteForEveryone
            })
          });

          if (!evoRes.ok) {
            const errText = await evoRes.text();
            console.error(`[Delete] Evolution API Error (${evoRes.status}):`, errText);
            // We continue to delete locally anyway
          } else {
            console.log(`[Delete] Evolution API success.`);
          }
        } else {
          console.warn(`[Delete] Evolution API not configured for this user/action.`);
        }
      } else {
        console.warn(`[Delete] Message has no external_id (too old or not tracked). Deleting only local historical record.`);
      }
    } else {
      console.warn(`[Delete] Message ${messageId} not found in DB.`);
    }

    // 2. Delete locally
    await pool.query('DELETE FROM whatsapp_messages WHERE id = $1', [messageId]);
    console.log(`[Delete] Message ${messageId} removed from local DB.`);

    return res.json({ status: "deleted", id: messageId });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ error: "Failed to delete" });
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
export const deleteMessage = async (req: Request, res: Response) => {
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
      await pool.query('DELETE FROM whatsapp_messages WHERE external_id = $1', [messageId]);
    }

    return res.json(data);

  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ error: "Internal Server Error" });
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
      comp.name as company_name
      FROM whatsapp_conversations c
      LEFT JOIN companies comp ON c.company_id = comp.id
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
             u.full_name as user_name
      FROM whatsapp_messages m
      JOIN whatsapp_conversations c ON m.conversation_id = c.id
      LEFT JOIN app_users u ON m.user_id = u.id
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
