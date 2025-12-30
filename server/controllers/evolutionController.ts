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
  // If user is not SuperAdmin and database is available, look for Company config
  if (user && user.role !== 'SUPERADMIN' && pool) {
    try {
      // Create a timeout promise to prevent hanging on network issues
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB_TIMEOUT')), 3000)
      );

      // Find company_id for this user
      const userRes = await Promise.race([
        pool.query('SELECT company_id FROM app_users WHERE id = $1', [user.id]),
        timeoutPromise
      ]) as any;

      if (userRes && userRes.rows && userRes.rows.length > 0 && userRes.rows[0].company_id) {
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
    } catch (e: any) {
      if (e.message && (e.message.includes('ENETUNREACH') || e.code === 'ENETUNREACH' || e.message === 'DB_TIMEOUT')) {
        console.warn("[Evolution] Database unreachable or timed out. Falling back to default ENV config.");
      } else {
        console.error("Error fetching company evolution config:", e.message);
      }
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

    const { phone, message, text, to } = req.body;

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
            [remoteJid, safePhone, safePhone, EVOLUTION_INSTANCE]
          );
          conversationId = newConv.rows[0].id;
        }

        // Insert message
        await pool.query(
          'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status) VALUES ($1, $2, $3, NOW(), $4)',
          [conversationId, 'outbound', messageContent, 'sent']
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
    console.log(`[Evolution] Fetching local contacts for instance: ${EVOLUTION_INSTANCE}`);
    const localContacts = await pool?.query(
      `SELECT * FROM whatsapp_contacts WHERE instance = $1 ORDER BY name ASC`,
      [EVOLUTION_INSTANCE]
    );
    console.log(`[Evolution] Found ${localContacts?.rows?.length || 0} local contacts.`);
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

  console.log(`[Evolution] Sync requested. Instance: ${EVOLUTION_INSTANCE}, URL present: ${!!EVOLUTION_API_URL}, Key present: ${!!EVOLUTION_API_KEY}`);

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error("[Evolution] Config missing during sync.");
    return res.status(500).json({ error: "Evolution API not configured" });
  }

  try {
    // 1. Fetch from Evolution
    // Try POST /chat/findContacts (common for V2 to sync/check DB)
    let url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/findContacts/${EVOLUTION_INSTANCE}`;
    console.log(`[Evolution] Syncing contacts from primary: ${url} (POST)`);

    let response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      console.warn(`[Evolution] POST /chat/findContacts failed (${response.status} - ${response.statusText}). Trying fallback /contact/find...`);

      // Fallback: POST /contact/find (V1 or alternative)
      url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/contact/find/${EVOLUTION_INSTANCE}`;
      console.log(`[Evolution] Syncing contacts from fallback: ${url} (POST)`);

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
      console.error(`[Evolution] Sync fallback failed: Status ${response.status}. Body: ${text}`);
      return res.status(response.status).json({ error: "Failed to fetch from Evolution (both endpoints failed)", details: text });
    }

    const rawData = await response.json();

    // Normalize data: sometimes it comes as array, sometimes { data: [...] }, sometimes { contacts: [...] }
    let contactsList: any[] = [];
    if (Array.isArray(rawData)) {
      contactsList = rawData;
    } else if (rawData && Array.isArray(rawData.data)) {
      contactsList = rawData.data;
    } else if (rawData && Array.isArray(rawData.contacts)) {
      contactsList = rawData.contacts;
    } else if (rawData && Array.isArray(rawData.results)) {
      contactsList = rawData.results;
    } else {
      console.warn("[Evolution] Unexpected response format:", JSON.stringify(rawData).substring(0, 200) + "...");
    }

    console.log(`[Evolution] Fetched ${contactsList.length} contacts (from raw response type: ${Array.isArray(rawData) ? 'Array' : typeof rawData}). Saving to DB...`);

    // 2. Upsert to Database
    if (pool && contactsList.length > 0) {
      // CLEANUP: Remove previously saved contacts that are actually internal IDs (Cuids) or malformed
      // We delete any JID that does NOT match strictly numeric format '12345@s.whatsapp.net'
      try {
        await pool.query(`
              DELETE FROM whatsapp_contacts 
              WHERE instance = $1 
              AND jid !~ '^[0-9]+@s\\.whatsapp\\.net$'
          `, [EVOLUTION_INSTANCE]);
        console.log(`[Evolution] Cleaned up invalid contacts (non-numeric JIDs) for instance ${EVOLUTION_INSTANCE}`);
      } catch (cleanErr) {
        console.error("[Evolution] Cleanup error:", cleanErr);
      }

      let savedCount = 0;
      if (contactsList.length > 0) {
        // console.log("[Evolution Debug] First raw contact from API:", JSON.stringify(contactsList[0], null, 2));
      }

      for (const contact of contactsList) {
        // Find a valid numeric phone number
        let candidate = null;

        // Priority order: explicit number/phone field, then remoteJid, then id if numeric
        const potentialFields = [contact.number, contact.phone, contact.remoteJid, contact.id];

        for (const field of potentialFields) {
          if (typeof field === 'string' && field) {
            // Remove suffix if present to check the number part
            const clean = field.split('@')[0];

            // Strict check: must be digits only and reasonable length (10-15 chars)
            // This excludes random IDs like 'cmjiwzyki0884p74lakndv85j'
            if (/^\d+$/.test(clean) && clean.length >= 7 && clean.length <= 16) {
              candidate = clean;
              break;
            }
          }
        }

        if (!candidate) {
          // console.warn(`[Evolution Debug] Skipping contact, no valid phone found. ID: ${contact.id}`);
          continue;
        }

        // Construct normalized JID
        const jid = `${candidate}@s.whatsapp.net`;

        // Try to find the best name available
        const name = contact.name || contact.pushName || contact.notify || contact.verifiedName || candidate;
        const pushName = contact.pushName || contact.notify;
        const profilePicUser = contact.profilePictureUrl || contact.profilePicture;

        try {
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
                    `, [jid, name, pushName || null, profilePicUser || null, EVOLUTION_INSTANCE]);
          savedCount++;
        } catch (dbErr) {
          console.error(`[Evolution] DB Save error for ${jid}:`, dbErr);
        }
      }
      console.log(`[Evolution] Successfully saved/updated ${savedCount} valid contacts to DB.`);
    } else {
      if (!pool) console.error("[Evolution] Database pool is missing.");
      else console.log("[Evolution] No contacts to save.");
    }

    // 3. Return updated local list
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

export const getEvolutionContactsLive = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'getContactsLive');
  const EVOLUTION_API_URL = config.url;
  const EVOLUTION_API_KEY = config.apikey;
  const EVOLUTION_INSTANCE = config.instance;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return res.status(500).json({ error: "Evolution API not configured" });
  }

  try {
    // 1. Fetch from Evolution
    let url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/findContacts/${EVOLUTION_INSTANCE}`;
    console.log(`[Evolution] Live fetching contacts from: ${url}`);

    let response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      // Fallback
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
      return res.status(response.status).json({ error: "Failed to fetch from Evolution", details: text });
    }

    const rawData = await response.json();

    // Normalize
    let contactsList: any[] = [];
    if (Array.isArray(rawData)) contactsList = rawData;
    else if (rawData && Array.isArray(rawData.data)) contactsList = rawData.data;
    else if (rawData && Array.isArray(rawData.contacts)) contactsList = rawData.contacts;
    else if (rawData && Array.isArray(rawData.results)) contactsList = rawData.results;

    // Return mapped simple objects
    const mapped = contactsList.map(c => {
      const jid = c.id;
      // Basic clean
      const phone = jid ? jid.split('@')[0] : (c.phone || c.number || "");
      return {
        id: jid || phone,
        name: c.name || c.pushName || c.notify || phone,
        phone: phone,
        profile_pic_url: c.profilePictureUrl || c.profilePicture
      };
    }).filter(c => c.phone); // Filter empty phones

    return res.json(mapped);

  } catch (error: any) {
    console.error("Error fetching live contacts:", error);
    return res.status(500).json({ error: "Live fetch failed", details: error.message });
  }
};

export const createEvolutionContact = async (req: Request, res: Response) => {
  const config = await getEvolutionConfig((req as any).user, 'createContact');
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

    // Insert into DB
    await pool.query(`
          INSERT INTO whatsapp_contacts (jid, name, instance, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (jid, instance) 
          DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      `, [jid, name, EVOLUTION_INSTANCE]);

    return res.status(201).json({
      id: jid,
      name,
      phone: cleanPhone,
      jid
    });

  } catch (error: any) {
    console.error("Error creating contact:", error);
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

  // As we don't store external WAMID yet, we only delete locally.
  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    await pool.query('DELETE FROM whatsapp_messages WHERE id = $1', [messageId]);

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

    await pool.query('UPDATE whatsapp_messages SET content = $1 WHERE id = $2', [content, messageId]);

    return res.json({ status: "updated", id: messageId, content });
  } catch (error) {
    console.error("Error updating message:", error);
    return res.status(500).json({ error: "Failed to update" });
  }
};

export const updateEvolutionContact = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    await pool.query(
      'UPDATE whatsapp_contacts SET name = $1 WHERE id = $2',
      [name, id]
    );

    return res.json({ status: "updated", id, name });

  } catch (error) {
    console.error("Error updating contact:", error);
    return res.status(500).json({ error: "Failed to update contact" });
  }
};

export const deleteEvolutionContact = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!pool) return res.status(500).json({ error: "DB not configured" });

    await pool.query('DELETE FROM whatsapp_contacts WHERE id = $1', [id]);

    return res.json({ status: "deleted", id });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return res.status(500).json({ error: "Failed to delete contact" });
  }
};
