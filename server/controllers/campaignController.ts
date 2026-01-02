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
            (name, message_template, company_id, user_id, scheduled_at, start_time, end_time, delay_min, delay_max, total_contacts, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                name,
                message_template,
                companyId,
                user.id,
                scheduled_at || null,
                start_time || '09:00',
                end_time || '18:00',
                delay_min || 5,
                delay_max || 15,
                contacts?.length || 0,
                scheduled_at ? 'scheduled' : 'draft'
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
        processCampaign(parseInt(id));

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
                 updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [name, message_template, scheduled_at || null, start_time, end_time, delay_min, delay_max, id]
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

// Helper to get minutes from "HH:MM"
function getMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

// Background process to send messages
async function processCampaign(campaignId: number) {
    console.log(`[Campaign ${campaignId}] Starting processing...`);
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

        // Get pending contacts
        const contactsResult = await pool.query(
            `SELECT * FROM whatsapp_campaign_contacts 
             WHERE campaign_id = $1 AND status = 'pending' 
             ORDER BY created_at ASC`,
            [campaignId]
        );

        const contacts = contactsResult.rows;

        console.log(`[Campaign ${campaignId}] Found ${contacts.length} pending contacts for campaign "${campaign.name}".`);

        if (contacts.length === 0) {
            // Mark campaign as completed if no contacts left
            await pool.query(
                `UPDATE whatsapp_campaigns 
                 SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
                 WHERE id = $1`,
                [campaignId]
            );
            console.log(`[Campaign ${campaignId}] Completed (no pending contacts).`);
            return;
        }

        // Send messages with delay
        for (const contact of contacts) {
            try {
                // Check if campaign is still running
                const statusCheck = await pool.query(
                    'SELECT status FROM whatsapp_campaigns WHERE id = $1',
                    [campaignId]
                );

                if (statusCheck.rows[0].status !== 'running') {
                    console.log(`[Campaign ${campaignId}] Stopped/Paused (current status: ${statusCheck.rows[0].status})`);
                    break;
                }

                // Check time window (Robust Check)
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
                    console.log(`[Campaign ${campaignId}] Outside window (${campaign.start_time}-${campaign.end_time}), skipping and waiting...`);
                    // We don't break, we just sleep a bit longer or exit the iteration
                    // To avoid busy wait, we can exit the process and wait for scheduler to restart it
                    // But scheduler only starts 'scheduled' campaigns. 'running' campaigns should stay in this loop.

                    // Simple wait loop until window opens
                    let waiting = true;
                    while (waiting) {
                        const checkNow = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
                        const cm = getMinutes(checkNow);
                        if (cm >= startMinutes && cm <= endMinutes) {
                            waiting = false;
                        } else {
                            // Check if campaign was paused while waiting
                            const sCheck = await pool.query('SELECT status FROM whatsapp_campaigns WHERE id = $1', [campaignId]);
                            if (sCheck.rows[0].status !== 'running') {
                                console.log(`[Campaign ${campaignId}] Paused while waiting for time window.`);
                                return;
                            }
                            await new Promise(r => setTimeout(r, 60000)); // check every minute
                        }
                    }
                }

                // Replace variables in message
                let message = campaign.message_template;
                const variables = contact.variables || {};

                // Default variable 'nome' from contact.name
                if (contact.name) variables.nome = contact.name;

                Object.keys(variables).forEach(key => {
                    message = message.replace(new RegExp(`{${key}}`, 'g'), variables[key]);
                });

                console.log(`[Campaign ${campaignId}] Sending to ${contact.phone}...`);

                // Send message via Evolution API
                const success = await sendWhatsAppMessage(campaign.company_id, contact.phone, message);

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
                        `UPDATE whatsapp_campaign_contacts SET status = 'failed', error_message = 'Failed to send via API' WHERE id = $1`,
                        [contact.id]
                    );

                    await pool.query(
                        `UPDATE whatsapp_campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
                        [campaignId]
                    );
                }

                // Random delay between messages
                const delay = Math.random() * (campaign.delay_max - campaign.delay_min) + campaign.delay_min;
                console.log(`[Campaign ${campaignId}] Sleeping for ${delay.toFixed(1)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));

            } catch (itemError: any) {
                console.error(`[Campaign ${campaignId}] Error processing contact ${contact.phone}:`, itemError);
                await pool.query(
                    `UPDATE whatsapp_campaign_contacts SET status = 'failed', error_message = $1 WHERE id = $2`,
                    [itemError.message, contact.id]
                );
            }
        }

        // Verify if all done
        const remaining = await pool.query(
            "SELECT count(*) as count FROM whatsapp_campaign_contacts WHERE campaign_id = $1 AND status = 'pending'",
            [campaignId]
        );

        if (parseInt(remaining.rows[0].count) === 0) {
            await pool.query(
                `UPDATE whatsapp_campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
                [campaignId]
            );
            console.log(`[Campaign ${campaignId}] All contacts processed.`);
        }

    } catch (error) {
        console.error(`[Campaign ${campaignId}] Fatal error in processCampaign:`, error);
    }
}

// Scheduler to check for pending campaigns
export const checkAndStartScheduledCampaigns = async () => {
    try {
        if (!pool) return;

        // Find due campaigns
        const result = await pool.query(
            "SELECT id, name, scheduled_at FROM whatsapp_campaigns WHERE status = 'scheduled' AND (scheduled_at <= NOW() OR scheduled_at IS NULL)"
        );

        if (result.rows.length > 0) {
            console.log(`[Scheduler] Found ${result.rows.length} campaigns to start.`);
        }

        for (const row of result.rows) {
            console.log(`[Scheduler] Starting scheduled campaign: ${row.name} (ID: ${row.id})`);

            // Mark as running
            await pool.query(
                "UPDATE whatsapp_campaigns SET status = 'running', updated_at = NOW() WHERE id = $1",
                [row.id]
            );

            // Trigger process
            processCampaign(row.id);
        }
    } catch (error) {
        console.error("Error checking scheduled campaigns:", error);
    }
};

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(companyId: number, phone: string, message: string): Promise<boolean> {
    try {
        if (!pool) {
            console.error('[sendWhatsAppMessage] No DB setup.');
            return false;
        }

        // Get company Evolution API config
        const companyResult = await pool.query(
            'SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1',
            [companyId]
        );

        if (companyResult.rows.length === 0) {
            console.error(`[sendWhatsAppMessage] Company ${companyId} not found.`);
            return false;
        }

        const { evolution_instance, evolution_apikey } = companyResult.rows[0];

        if (!evolution_instance || !evolution_apikey) {
            console.error(`[sendWhatsAppMessage] Missing evolution config for company ${companyId}. Instance: ${evolution_instance}, key: ${evolution_apikey ? 'Set' : 'Missing'}`);
            return false;
        }

        const EVOLUTION_API_BASE = (process.env.EVOLUTION_API_URL || 'https://freelasdekaren-evolution-api.nhvvzr.easypanel.host').replace(/\/$/, "");

        const cleanPhone = phone.replace(/\D/g, '');
        const targetUrl = `${EVOLUTION_API_BASE}/message/sendText/${evolution_instance}`;

        console.log(`[sendWhatsAppMessage] POST ${targetUrl} | Phone: ${cleanPhone}`);

        const payload = {
            number: cleanPhone,
            options: {
                delay: 1200,
                presence: "composing",
            },
            textMessage: {
                text: message,
            },
            text: message, // Fallback for some versions/endpoints requiring root text
            message: message // Fallback for older versions
        };

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
            console.error(`[sendWhatsAppMessage] Failed: Status ${response.status} - Body: ${errText}`);
            return false;
        }

        const data = await response.json();
        console.log(`[sendWhatsAppMessage] Success for ${cleanPhone}:`, data);

        return true;
    } catch (error: any) {
        console.error('Error sending WhatsApp message:', error);
        console.error('Error details:', error.message, error.stack);
        return false;
    }
}

