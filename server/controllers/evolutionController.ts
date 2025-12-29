import { Request, Response } from "express";
import { pool } from "../db";

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
const getEvolutionConfig = async (user: any, source: string = 'unknown') => {
  // Default Global Config (SuperAdmin)
  let config = {
    url: process.env.EVOLUTION_API_URL,
    apikey: process.env.EVOLUTION_API_KEY,
    instance: "integrai"
  };

  // If user is not SuperAdmin and database is available, look for Company config
  if (user && user.role !== 'SUPERADMIN' && pool) {
    try {
      // Find company_id for this user
      const userRes = await pool.query('SELECT company_id FROM app_users WHERE id = $1', [user.id]);
      if (userRes.rows.length > 0 && userRes.rows[0].company_id) {
        const companyId = userRes.rows[0].company_id;
        const compRes = await pool.query('SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1', [companyId]);

        if (compRes.rows.length > 0) {
          const { evolution_instance, evolution_apikey } = compRes.rows[0];
          if (evolution_instance && evolution_apikey) {
            config.instance = evolution_instance;
            config.apikey = evolution_apikey;
          }
        }
      }
    } catch (e) {
      console.error("Error fetching company evolution config", e);
    }
  }

  // Log source to debug potential loops
  console.log(`[Evolution] Config accessed by [${source}] for instance: ${config.instance}`);

  return config;
};

export const getEvolutionQrCode = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'qrcode_connect');

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

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/instance/connect/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => undefined);
      return res.status(response.status).json({
        error: "Failed to fetch QR code from Evolution API",
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();

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
  const config = await getEvolutionConfig((req as any).user, 'disconnect');
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

export const getEvolutionConnectionState = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'status_poll');
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

export const sendEvolutionMessage = async (req: Request, res: Response) => {
  // ... existing sendEvolutionMessage code ...
  const config = await getEvolutionConfig((req as any).user, 'sendMessage');
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "Phone and message are required" });
    }

    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/message/sendText/${EVOLUTION_INSTANCE}`;

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
        textMessage: {
          text: message,
        },
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
        console.log(`[Evolution] Attempting to save sent message to DB for ${phone} (Instance: ${EVOLUTION_INSTANCE})`);
        // Basic normalization of remoteJid
        const remoteJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

        // Find or create conversation
        let conversationId: number;

        // CHECK INSTANCE
        const checkConv = await pool.query(
          'SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2',
          [remoteJid, EVOLUTION_INSTANCE]
        );

        if (checkConv.rows.length > 0) {
          conversationId = checkConv.rows[0].id;
        } else {
          const newConv = await pool.query(
            'INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance) VALUES ($1, $2, $3, $4) RETURNING id',
            [remoteJid, phone, phone, EVOLUTION_INSTANCE]
          );
          conversationId = newConv.rows[0].id;
        }

        // Insert message
        await pool.query(
          'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status) VALUES ($1, $2, $3, NOW(), $4)',
          [conversationId, 'outbound', message, 'sent']
        );
        console.log(`[Evolution] Saved message to DB successfully.`);

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

export const getEvolutionContacts = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'getContacts');
  const EVOLUTION_INSTANCE = config.instance;

  // Retrieve local contacts first
  try {
    const localContacts = await pool?.query(
      `SELECT * FROM whatsapp_contacts WHERE instance = $1 ORDER BY name ASC`,
      [EVOLUTION_INSTANCE]
    );
    return res.json(localContacts?.rows || []);
  } catch (error) {
    console.error("Error fetching local contacts:", error);
    return res.status(500).json({ error: "DB Error" });
  }
};

export const syncEvolutionContacts = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'syncContacts');
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return res.status(500).json({ error: "Evolution API not configured" });
  }

  try {
    // 1. Fetch from Evolution
    // 1. Fetch from Evolution
    // Try POST /chat/findContacts (common for V2 to sync/check DB)
    let url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/findContacts/${EVOLUTION_INSTANCE}`;
    console.log(`[Evolution] Syncing contacts from: ${url} (POST)`);

    let response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      console.warn(`[Evolution] POST /chat/findContacts failed (${response.status}). Trying fallback /contact/find...`);

      // Fallback: POST /contact/find (V1 or alternative)
      url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/contact/find/${EVOLUTION_INSTANCE}`;
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY
        },
        body: JSON.stringify({})
      });
    }

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[Evolution] Sync fallback failed: ${text}`);
      return res.status(response.status).json({ error: "Failed to fetch from Evolution (both endpoints failed)", details: text });
    }

    const data: any[] = await response.json();
    console.log(`[Evolution] Fetched ${Array.isArray(data) ? data.length : 0} contacts. Saving to DB...`);

    // 2. Upsert to Database
    if (pool && Array.isArray(data)) {
      for (const contact of data) {
        const jid = contact.id; // remoteJid
        const name = contact.name || contact.pushName || contact.id?.split('@')[0];
        const pushName = contact.pushName;
        const profilePicUser = contact.profilePictureUrl;

        if (!jid) continue;

        // Safe upsert
        await pool.query(`
                INSERT INTO whatsapp_contacts (jid, name, push_name, profile_pic_url, instance, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (jid, instance) 
                DO UPDATE SET 
                    name = EXCLUDED.name,
                    push_name = EXCLUDED.push_name,
                    profile_pic_url = EXCLUDED.profile_pic_url,
                    updated_at = NOW();
            `, [jid, name, pushName, profilePicUser, EVOLUTION_INSTANCE]);
      }
    }

    // 3. Return updated local list
    const localContacts = await pool?.query(
      `SELECT * FROM whatsapp_contacts WHERE instance = $1 ORDER BY name ASC`,
      [EVOLUTION_INSTANCE]
    );

    return res.json(localContacts?.rows || []);

  } catch (error: any) {
    console.error("Error syncing contacts:", error);
    return res.status(500).json({ error: "Sync failed", details: error.message });
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
          // 1. Upsert Conversation
          // We need to check by external_id AND instance
          // If it doesn't exist, create it.
          // Also update last_message stuff.

          // Helper: clean phone
          const phone = remoteJid.split('@')[0];

          const existing = await pool.query(
            `SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2`,
            [remoteJid, instance]
          );

          if (existing.rows.length > 0) {
            conversationId = existing.rows[0].id;
            // Update last message
            await pool.query(
              `UPDATE whatsapp_conversations SET 
                                last_message = $1, 
                                last_message_at = NOW(), 
                                unread_count = unread_count + $3
                             WHERE id = $2`,
              [content, conversationId, fromMe ? 0 : 1]
            );
          } else {
            // Create new
            const newConv = await pool.query(
              `INSERT INTO whatsapp_conversations 
                                (external_id, phone, contact_name, instance, last_message, last_message_at, unread_count)
                             VALUES ($1, $2, $3, $4, $5, NOW(), $6)
                             RETURNING id`,
              [remoteJid, phone, pushName || phone, instance, content, fromMe ? 0 : 1]
            );
            conversationId = newConv.rows[0].id;
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
