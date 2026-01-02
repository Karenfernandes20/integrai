import { Request, Response } from 'express';
import { pool } from '../db';

// Create Campaign
export const createCampaign = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;

        const {
            name,
            message_template,
            scheduled_at,
            start_time,
            end_time,
            delay_min,
            delay_max,
            contacts // [{phone, name, variables}]
        } = req.body;

        // Validation
        if (!name || !message_template) {
            return res.status(400).json({ error: 'Name and message template are required' });
        }

        // Create campaign
        const campaignResult = await pool.query(
            `INSERT INTO whatsapp_campaigns 
            (name, message_template, company_id, user_id, scheduled_at, start_time, end_time, delay_min, delay_max, total_contacts, status, media_url, media_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [
                name,
                message_template,
                companyId,
                user.id,
                scheduled_at || null,
                start_time || '00:00',
                end_time || '23:59',
                delay_min || 5,
                delay_max || 15,
                contacts?.length || 0,
                scheduled_at ? 'scheduled' : 'draft',
                req.body.media_url || null,
                req.body.media_type || null
            ]
        );

        const campaign = campaignResult.rows[0];

        // Insert contacts
        if (contacts && contacts.length > 0) {
            const contactValues = contacts.map((c: any) =>
                `(${campaign.id}, '${c.phone}', '${c.name || ''}', '${JSON.stringify(c.variables || {})}')`
            ).join(',');

            await pool.query(`
                INSERT INTO whatsapp_campaign_contacts (campaign_id, phone, name, variables)
                VALUES ${contactValues}
            `);
        }

        res.json(campaign);
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
    }
};

// Get All Campaigns
export const getCampaigns = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;

        let query = 'SELECT * FROM whatsapp_campaigns WHERE 1=1';
        const params: any[] = [];

        if (user.role !== 'SUPERADMIN') {
            query += ' AND company_id = $1';
            params.push(companyId);
        } else if (companyId) {
            query += ' AND company_id = $1';
            params.push(companyId);
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
};

// Get Campaign by ID with contacts
export const getCampaignById = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;

        const campaignResult = await pool.query(
            'SELECT * FROM whatsapp_campaigns WHERE id = $1',
            [id]
        );

        if (campaignResult.rows.length === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const contactsResult = await pool.query(
            'SELECT * FROM whatsapp_campaign_contacts WHERE campaign_id = $1 ORDER BY created_at ASC',
            [id]
        );

        res.json({
            ...campaignResult.rows[0],
            contacts: contactsResult.rows
        });
    } catch (error) {
        console.error('Error fetching campaign:', error);
        res.status(500).json({ error: 'Failed to fetch campaign' });
    }
};

// Start Campaign
export const startCampaign = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;

        await pool.query(
            `UPDATE whatsapp_campaigns SET status = 'running', updated_at = NOW() WHERE id = $1`,
            [id]
        );

        // Trigger background job to send messages
        const io = req.app.get('io');
        processCampaign(parseInt(id), io);

        res.json({ message: 'Campaign started' });
    } catch (error) {
        console.error('Error starting campaign:', error);
        res.status(500).json({ error: 'Failed to start campaign' });
    }
};

// Pause Campaign
export const pauseCampaign = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;

        await pool.query(
            `UPDATE whatsapp_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1`,
            [id]
        );

        res.json({ message: 'Campaign paused' });
    } catch (error) {
        console.error('Error pausing campaign:', error);
        res.status(500).json({ error: 'Failed to pause campaign' });
    }
};

// Update Campaign
export const updateCampaign = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const {
            name,
            message_template,
            scheduled_at,
            start_time,
            end_time,
            delay_min,
            delay_max,
            contacts // Optional: replace contacts
        } = req.body;

        const campaignResult = await pool.query(
            `UPDATE whatsapp_campaigns 
             SET name = COALESCE($1, name),
                 message_template = COALESCE($2, message_template),
                 scheduled_at = $3,
                 start_time = COALESCE($4, start_time),
                 end_time = COALESCE($5, end_time),
                 delay_min = COALESCE($6, delay_min),
                 delay_max = COALESCE($7, delay_max),
                 media_url = $8,
                 media_type = $9,
                 updated_at = NOW()
             WHERE id = $10
             RETURNING *`,
            [
                name,
                message_template,
                scheduled_at || null,
                start_time,
                end_time,
                delay_min,
                delay_max,
                req.body.media_url || null,
                req.body.media_type || null,
                id
            ]
        );

        if (campaignResult.rows.length === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = campaignResult.rows[0];

        // If contacts are provided, replace them (only if campaign is not completed/running probably?)
        // For now, let's allow replacing contacts if provided
        if (contacts && Array.isArray(contacts)) {
            // Delete old contacts
            await pool.query('DELETE FROM whatsapp_campaign_contacts WHERE campaign_id = $1', [id]);

            // Insert new contacts
            if (contacts.length > 0) {
                const contactValues = contacts.map((c: any) =>
                    `(${id}, '${c.phone}', '${c.name || ''}', '${JSON.stringify(c.variables || {})}')`
                ).join(',');

                await pool.query(`
                    INSERT INTO whatsapp_campaign_contacts (campaign_id, phone, name, variables)
                    VALUES ${contactValues}
                `);

                // Update total_contacts count
                await pool.query(
                    'UPDATE whatsapp_campaigns SET total_contacts = $1 WHERE id = $2',
                    [contacts.length, id]
                );
            }
        }

        res.json(campaign);
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
    }
};

// Delete Campaign

// Delete Campaign
export const deleteCampaign = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;

        await pool.query('DELETE FROM whatsapp_campaigns WHERE id = $1', [id]);

        res.json({ message: 'Campaign deleted' });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
    }
};

const activeProcesses = new Set<number>();

// Helper to get minutes from "HH:MM"
function getMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

// Background process to send messages
async function processCampaign(campaignId: number, io?: any) {
    if (activeProcesses.has(campaignId)) {
        console.log(`[Campaign ${campaignId}] Already being processed in this instance.`);
        return;
    }

    activeProcesses.add(campaignId);
    console.log(`[Campaign ${campaignId}] Starting/Resuming processing...`);

    try {
        if (!pool) {
            console.error(`[Campaign ${campaignId}] Database connection failed.`);
            return;
        }

        const campaignResult = await pool.query(
            'SELECT * FROM whatsapp_campaigns WHERE id = $1',
            [campaignId]
        );

        if (campaignResult.rows.length === 0) {
            console.warn(`[Campaign ${campaignId}] Not found in DB.`);
            return;
        }

        const campaign = campaignResult.rows[0];

        // Ensure status is running
        if (campaign.status === 'paused' || campaign.status === 'completed' || campaign.status === 'cancelled') {
            console.log(`[Campaign ${campaignId}] Status is ${campaign.status}, skipping.`);
            return;
        }

        // Get pending contacts
        const contactsResult = await pool.query(
            `SELECT * FROM whatsapp_campaign_contacts 
             WHERE campaign_id = $1 AND status = 'pending' 
             ORDER BY id ASC`,
            [campaignId]
        );

        const contacts = contactsResult.rows;

        console.log(`[Campaign ${campaignId}] Found ${contacts.length} pending contacts for campaign "${campaign.name}".`);

        if (contacts.length === 0) {
            await pool.query(
                `UPDATE whatsapp_campaigns 
                 SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
                 WHERE id = $1`,
                [campaignId]
            );
            console.log(`[Campaign ${campaignId}] Completed (no pending contacts).`);
            return;
        }

        // Processing loop
        for (const contact of contacts) {
            try {
                // Re-check status every iteration
                const statusCheck = await pool.query(
                    'SELECT status FROM whatsapp_campaigns WHERE id = $1',
                    [campaignId]
                );

                const currentStatus = statusCheck.rows[0]?.status;
                if (currentStatus !== 'running') {
                    console.log(`[Campaign ${campaignId}] Loop stopped because status is ${currentStatus}`);
                    return; // Exit process
                }

                // Time window check
                const now = new Date();
                const brazilTimeStr = now.toLocaleTimeString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                const currentMinutes = getMinutes(brazilTimeStr);
                const startMinutes = getMinutes(campaign.start_time || '00:00');
                const endMinutes = getMinutes(campaign.end_time || '23:59');

                if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
                    console.log(`[Campaign ${campaignId}] Outside window (${campaign.start_time}-${campaign.end_time}). Current: ${brazilTimeStr}. Waiting for window...`);
                    // Instead of busy wait, we'll terminate the process for now and let the scheduler restart it later
                    // This is cleaner for memory/threads
                    return;
                }

                // Replace variables
                let message = campaign.message_template;
                const variables = (typeof contact.variables === 'string' ? JSON.parse(contact.variables) : contact.variables) || {};

                if (contact.name) variables.nome = contact.name;
                if (contact.phone) variables.telefone = contact.phone;

                Object.keys(variables).forEach(key => {
                    const val = variables[key] !== null && variables[key] !== undefined ? String(variables[key]) : "";
                    message = message.replace(new RegExp(`{${key}}`, 'gi'), val);
                });

                console.log(`[Campaign ${campaignId}] Sending to ${contact.phone}...`);

                const success = await sendWhatsAppMessage(
                    campaign.company_id,
                    contact.phone,
                    message,
                    contact.name,
                    campaign.user_id,
                    io,
                    campaign.media_url,
                    campaign.media_type
                );

                if (success) {
                    await pool.query(
                        `UPDATE whatsapp_campaign_contacts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
                        [contact.id]
                    );

                    await pool.query(
                        `UPDATE whatsapp_campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
                        [campaignId]
                    );
                } else {
                    await pool.query(
                        `UPDATE whatsapp_campaign_contacts SET status = 'failed', error_message = 'Evolution API failed' WHERE id = $1`,
                        [contact.id]
                    );

                    await pool.query(
                        `UPDATE whatsapp_campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
                        [campaignId]
                    );
                }

                // Random delay between messages
                const delayMs = (Math.random() * (campaign.delay_max - campaign.delay_min) + parseInt(campaign.delay_min || 5)) * 1000;
                await new Promise(r => setTimeout(r, delayMs));

            } catch (err: any) {
                console.error(`[Campaign ${campaignId}] Error on contact ${contact.phone}:`, err.message);
                await pool.query(
                    `UPDATE whatsapp_campaign_contacts SET status = 'failed', error_message = $1 WHERE id = $2`,
                    [err.message, contact.id]
                );
            }
        }

        // Final check
        const remaining = await pool.query(
            "SELECT count(*) as count FROM whatsapp_campaign_contacts WHERE campaign_id = $1 AND status = 'pending'",
            [campaignId]
        );

        if (parseInt(remaining.rows[0].count) === 0) {
            await pool.query(
                `UPDATE whatsapp_campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [campaignId]
            );
            console.log(`[Campaign ${campaignId}] Finished processing all contacts.`);
        }

    } catch (error: any) {
        console.error(`[Campaign ${campaignId}] Fatal error:`, error.message);
    } finally {
        activeProcesses.delete(campaignId);
    }
}

// Scheduler to check for pending campaigns
export const checkAndStartScheduledCampaigns = async (io?: any) => {
    try {
        if (!pool) return;

        // Find due campaigns OR running campaigns that are not being processed (interrupted)
        const result = await pool.query(
            `SELECT id, name, status FROM whatsapp_campaigns 
             WHERE (status = 'scheduled' AND (scheduled_at <= NOW() OR scheduled_at IS NULL))
                OR (status = 'running')`
        );

        for (const row of result.rows) {
            // If it was scheduled, mark as running first
            if (row.status === 'scheduled') {
                console.log(`[Scheduler] Starting scheduled campaign: ${row.name} (ID: ${row.id})`);
                await pool.query(
                    "UPDATE whatsapp_campaigns SET status = 'running', updated_at = NOW() WHERE id = $1",
                    [row.id]
                );
            }

            // Only start if not already in memory
            if (!activeProcesses.has(row.id)) {
                processCampaign(row.id, io);
            }
        }
    } catch (error) {
        console.error("Error checking scheduled campaigns:", error);
    }
};

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(
    companyId: number | null,
    phone: string,
    message: string,
    contactName?: string,
    userId?: number | null,
    io?: any,
    mediaUrl?: string | null,
    mediaType?: string | null
): Promise<boolean> {
    try {
        if (!pool) return false;

        let evolution_instance = "integrai";
        let evolution_apikey = process.env.EVOLUTION_API_KEY;

        // Try to get specific config
        if (companyId) {
            const companyResult = await pool.query(
                'SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1',
                [companyId]
            );
            if (companyResult.rows.length > 0) {
                const row = companyResult.rows[0];
                if (row.evolution_instance) evolution_instance = row.evolution_instance;
                if (row.evolution_apikey) evolution_apikey = row.evolution_apikey;
            }
        }

        // Final fallback if still no api key (Try company 1)
        if (!evolution_apikey) {
            const res = await pool.query('SELECT evolution_apikey FROM companies WHERE id = 1 LIMIT 1');
            if (res.rows.length > 0) evolution_apikey = res.rows[0].evolution_apikey;
        }

        if (!evolution_apikey) {
            console.error(`[sendWhatsAppMessage] No API Key found for campaign.`);
            return false;
        }

        const EVOLUTION_API_BASE = (process.env.EVOLUTION_API_URL || 'https://freelasdekaren-evolution-api.nhvvzr.easypanel.host').replace(/\/$/, "");

        let cleanPhone = phone.replace(/\D/g, '');
        // Ensure Brazil CC if looks like standard number
        if (cleanPhone.length === 10 || (cleanPhone.length === 11 && cleanPhone[0] !== '0')) {
            cleanPhone = '55' + cleanPhone;
        }

        const isMedia = !!mediaUrl && !!mediaType;
        const endpoint = isMedia ? 'sendMedia' : 'sendText';
        const targetUrl = `${EVOLUTION_API_BASE}/message/${endpoint}/${evolution_instance}`;

        console.log(`[sendWhatsAppMessage] POST ${targetUrl} | Target: ${cleanPhone} | Type: ${isMedia ? mediaType : 'text'}`);

        let payload: any = {
            number: cleanPhone,
            options: {
                delay: 1200,
                presence: "composing",
                linkPreview: false
            }
        };

        if (isMedia) {
            payload.mediaMessage = {
                mediatype: mediaType,
                caption: message, // Caption is the text message
                media: mediaUrl
            };
            // Evolution v2 might expect 'fileName' for documents, optional for others
            if (mediaType === 'document') {
                payload.mediaMessage.fileName = mediaUrl!.split('/').pop() || 'document.pdf';
            }
        } else {
            payload.textMessage = { text: message };
            payload.text = message; // backward compat
        }

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolution_apikey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[sendWhatsAppMessage] Failed: ${response.status} - ${errText}`);
            return false;
        }

        const data = await response.json();

        // SYNC WITH ATENDIMENTO (OPEN status as requested)
        if (pool) {
            try {
                const remoteJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
                let conversationId: number;

                // Find or create conversation
                const checkConv = await pool.query(
                    'SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND instance = $2',
                    [remoteJid, evolution_instance]
                );

                if (checkConv.rows.length > 0) {
                    conversationId = checkConv.rows[0].id;
                    await pool.query(
                        `UPDATE whatsapp_conversations 
                         SET last_message = $1, last_message_at = NOW(), status = 'OPEN', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3)
                         WHERE id = $4`,
                        [message, userId, companyId, conversationId]
                    );
                } else {
                    // Create new conversation
                    const newConv = await pool.query(
                        `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id) 
                         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, NOW(), $7) RETURNING id`,
                        [remoteJid, cleanPhone, contactName || cleanPhone, evolution_instance, userId, message, companyId]
                    );
                    conversationId = newConv.rows[0].id;
                }

                const externalMessageId = data?.key?.id;

                // Insert message
                // Note: We should probably store media_url if it's a media message
                const insertedMsg = await pool.query(
                    'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, media_url, message_type) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8) RETURNING id',
                    [conversationId, 'outbound', message, 'sent', externalMessageId, userId, mediaUrl || null, mediaType || 'text']
                );

                // Socket Emit
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
                        agent_name: "(Campanha)",
                        media_url: mediaUrl,
                        message_type: mediaType || 'text'
                    };
                    io.to(`company_${companyId}`).emit('message:received', socketPayload);
                }
            } catch (dbErr) {
                console.error('[sendWhatsAppMessage] DB Sync Error:', dbErr);
            }
        }

        return true;
    } catch (error: any) {
        console.error('[sendWhatsAppMessage] Fatal Error:', error.message);
        return false;
    }
}

