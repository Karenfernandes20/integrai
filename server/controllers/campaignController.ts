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

// Background process to send messages
async function processCampaign(campaignId: number) {
    try {
        if (!pool) return;

        const campaignResult = await pool.query(
            'SELECT * FROM whatsapp_campaigns WHERE id = $1',
            [campaignId]
        );

        if (campaignResult.rows.length === 0) return;

        const campaign = campaignResult.rows[0];

        // Get pending contacts
        const contactsResult = await pool.query(
            `SELECT * FROM whatsapp_campaign_contacts 
             WHERE campaign_id = $1 AND status = 'pending' 
             ORDER BY created_at ASC`,
            [campaignId]
        );

        const contacts = contactsResult.rows;

        console.log(`[Campaign ${campaignId}] Processing ${contacts.length} contacts`);

        // Send messages with delay
        for (const contact of contacts) {
            // Check if campaign is still running
            const statusCheck = await pool.query(
                'SELECT status FROM whatsapp_campaigns WHERE id = $1',
                [campaignId]
            );

            if (statusCheck.rows[0].status !== 'running') {
                console.log(`[Campaign ${campaignId}] Stopped (status: ${statusCheck.rows[0].status})`);
                break;
            }

            // Check time window
            const now = new Date();
            const currentTime = now.toTimeString().substring(0, 5); // HH:MM
            if (currentTime < campaign.start_time || currentTime > campaign.end_time) {
                console.log(`[Campaign ${campaignId}] Outside time window, waiting...`);
                await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
                continue;
            }

            // Replace variables in message
            let message = campaign.message_template;
            const variables = contact.variables || {};

            Object.keys(variables).forEach(key => {
                message = message.replace(new RegExp(`{${key}}`, 'g'), variables[key]);
            });

            // Send message via Evolution API
            const success = await sendWhatsAppMessage(campaign.company_id, contact.phone, message);

            if (success) {
                await pool.query(
                    `UPDATE whatsapp_campaign_contacts 
                     SET status = 'sent', sent_at = NOW() 
                     WHERE id = $1`,
                    [contact.id]
                );

                await pool.query(
                    `UPDATE whatsapp_campaigns 
                     SET sent_count = sent_count + 1, updated_at = NOW() 
                     WHERE id = $1`,
                    [campaignId]
                );
            } else {
                await pool.query(
                    `UPDATE whatsapp_campaign_contacts 
                     SET status = 'failed', error_message = 'Failed to send' 
                     WHERE id = $1`,
                    [contact.id]
                );

                await pool.query(
                    `UPDATE whatsapp_campaigns 
                     SET failed_count = failed_count + 1 
                     WHERE id = $1`,
                    [campaignId]
                );
            }

            // Random delay between messages
            const delay = Math.random() * (campaign.delay_max - campaign.delay_min) + campaign.delay_min;
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }

        // Mark campaign as completed
        await pool.query(
            `UPDATE whatsapp_campaigns 
             SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
             WHERE id = $1`,
            [campaignId]
        );

        console.log(`[Campaign ${campaignId}] Completed`);
    } catch (error) {
        console.error(`Error processing campaign ${campaignId}:`, error);
    }
}

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(companyId: number, phone: string, message: string): Promise<boolean> {
    try {
        if (!pool) return false;

        // Get company Evolution API config
        const companyResult = await pool.query(
            'SELECT evolution_instance, evolution_apikey FROM companies WHERE id = $1',
            [companyId]
        );

        if (companyResult.rows.length === 0) return false;

        const { evolution_instance, evolution_apikey } = companyResult.rows[0];

        if (!evolution_instance || !evolution_apikey) return false;

        const EVOLUTION_API_BASE = process.env.EVOLUTION_API_URL || 'https://freelasdekaren-evolution-api.nhvvzr.easypanel.host';

        const response = await fetch(`${EVOLUTION_API_BASE}/message/sendText/${evolution_instance}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolution_apikey
            },
            body: JSON.stringify({
                number: phone,
                text: message
            })
        });

        return response.ok;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        return false;
    }
}
