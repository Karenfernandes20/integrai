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
    const url = `${EVOLUTION_API_URL.replace(/\/$/, "")}/chat/findContacts/${EVOLUTION_INSTANCE}`;
    console.log(`[Evolution] Syncing contacts from: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[Evolution] Sync failed: ${text}`);
      return res.status(response.status).json({ error: "Failed to fetch from Evolution", details: text });
    }

    const data: any[] = await response.json();
    console.log(`[Evolution] Fetched ${data.length} contacts. Saving to DB...`);

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
