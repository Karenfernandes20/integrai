
import { Request, Response } from 'express';
import { pool } from '../db';
import { makeTwilioCall, generateVoiceToken, generateOutboundTwiML } from '../services/voiceService';

export const handleCallWebhook = async (body: any, instance: string, io: any) => {
    try {
        if (!pool) return;

        // Structure of Call Event from Evolution typically:
        // { type: 'CALL', data: { id: '...', from: '...', status: 'offer' | 'timeout' ... } }
        // Depending on version, it might be in data directly.

        const data = body.data || body;
        const externalId = data.id || `call-${Date.now()}`;
        const remoteJid = data.from || data.remoteJid;
        const status = data.status; // offer (ringing), timeout (missed), reject, accept, terminate
        const timestamp = new Date((data.date || Date.now() / 1000) * 1000);

        console.log(`[Call Webhook] Processing call from ${remoteJid}, status: ${status}`);

        // Find Company
        const compRes = await pool.query('SELECT id FROM companies WHERE evolution_instance = $1', [instance]);
        if (compRes.rows.length === 0) return;
        const companyId = compRes.rows[0].id;

        // Find Conversation
        const convRes = await pool.query('SELECT id, contact_name FROM whatsapp_conversations WHERE external_id = $1 AND company_id = $2', [remoteJid, companyId]);
        let conversationId = convRes.rows.length > 0 ? convRes.rows[0].id : null;
        let contactName = convRes.rows.length > 0 ? convRes.rows[0].contact_name : (data.pushName || remoteJid.split('@')[0]);

        // Insert or Update Call Record
        if (status === 'offer') {
            await pool.query(`
                INSERT INTO whatsapp_calls (company_id, conversation_id, remote_jid, contact_name, direction, status, start_time, external_id)
                VALUES ($1, $2, $3, $4, 'inbound', 'ringing', $5, $6)
             `, [companyId, conversationId, remoteJid, contactName, timestamp, externalId]);
        } else {
            // Update status if exists, else insert (e.g. if we missed the offer event)
            const existing = await pool.query('SELECT id FROM whatsapp_calls WHERE external_id = $1', [externalId]);
            if (existing.rows.length > 0) {
                await pool.query('UPDATE whatsapp_calls SET status = $1, end_time = CASE WHEN $1 IN (\'timeout\', \'reject\', \'terminate\') THEN NOW() ELSE end_time END WHERE external_id = $2', [status, externalId]);
            } else {
                await pool.query(`
                    INSERT INTO whatsapp_calls (company_id, conversation_id, remote_jid, contact_name, direction, status, start_time, end_time, external_id)
                    VALUES ($1, $2, $3, $4, 'inbound', $5, $6, NOW(), $7)
                 `, [companyId, conversationId, remoteJid, contactName, status, timestamp, externalId]);
            }
        }

        // Emit Socket Event
        if (io) {
            const room = `company_${companyId}`;
            io.to(room).emit('call:update', {
                externalId,
                remoteJid,
                contactName,
                status,
                direction: 'inbound',
                timestamp
            });
        }

    } catch (e) {
        console.error('[Call Webhook] Error:', e);
    }
};

export const getCalls = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        const user = (req as any).user;
        const companyId = user.company_id;

        const result = await pool.query(`
            SELECT * FROM whatsapp_calls 
            WHERE company_id = $1 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [companyId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching calls:', error);
        res.status(500).json({ error: 'Failed to fetch calls' });
    }
};

export const startOutboundCall = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { phone, contactName, conversationId } = req.body;
        const user = (req as any).user;
        const companyId = user.company_id;

        if (!phone) {
            return res.status(400).json({ error: 'Telefone é obrigatório' });
        }

        console.log(`[Outbound Call] Starting call to ${phone} from User ${user.id}`);

        // Initiate Call via Provider
        let callData;
        try {
            // Clean phone for provider if needed, assuming E.164
            const cleanPhone = phone.replace(/\D/g, '');
            // NOTE: Ideally should ensure it has country code. Assuming Brazil +55 for now if length matches?
            const formattedPhone = cleanPhone.length <= 11 ? `+55${cleanPhone}` : `+${cleanPhone}`;

            callData = await makeTwilioCall(formattedPhone);
        } catch (err: any) {
            console.error("Twilio Call Failed:", err.message);
            // Fallback: If provider fails (e.g. not configured), we return specific error
            if (err.message.includes("Twilio credentials not configured")) {
                return res.status(400).json({
                    error: "Provedor de Voz não configurado. Adicione as chaves API (Twilio) nas configurações.",
                    code: "PROVIDER_NOT_CONFIGURED"
                });
            }
            return res.status(500).json({ error: "Falha ao iniciar chamada: " + err.message });
        }

        // Record in DB
        const externalId = callData.sid;
        const status = callData.status || 'queued';

        await pool.query(`
            INSERT INTO whatsapp_calls (
                company_id, conversation_id, remote_jid, contact_name, direction, status, start_time, external_id, user_id, details
            ) VALUES ($1, $2, $3, $4, 'outbound', $5, NOW(), $6, $7, $8)
        `, [
            companyId,
            conversationId || null,
            phone,
            contactName || phone,
            status,
            externalId,
            user.id,
            JSON.stringify(callData)
        ]);

        res.json({ success: true, callId: externalId, status });

    } catch (error: any) {
        console.error('Error starting outbound call:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getVoiceToken = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        // Unique identity for the client
        const identity = `user_${user.id}`;
        const token = generateVoiceToken(identity);
        res.json({ token, identity });
    } catch (e: any) {
        // Handle config missing
        if (e.message.includes("Twilio credentials not configured") || e.message.includes("Missing Twilio")) {
            return res.status(400).json({
                error: "Provedor de Voz não configurado.",
                code: "PROVIDER_NOT_CONFIGURED"
            });
        }
        res.status(500).json({ error: e.message });
    }
};

export const getVoiceTwiML = async (req: Request, res: Response) => {
    try {
        const { To } = req.body; // Twilio POSTs parameters
        if (!To) {
            res.type('text/xml').send('<Response><Say>Invalid Number</Say></Response>');
            return;
        }
        const twiml = generateOutboundTwiML(To);
        res.type('text/xml');
        res.send(twiml);
    } catch (e) {
        console.error("TwiML Error", e);
        res.status(500).send("Error");
    }
};
