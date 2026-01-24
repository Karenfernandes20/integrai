import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { systemMode } from '../systemState';

import { checkLimit, incrementUsage } from '../services/limitService';
import { sendWhatsAppMessage } from '../services/whatsappService';

// Helper to validate Media URL
async function validateMediaUrl(url: string, type: string): Promise<{ valid: boolean; error?: string }> {
    if (!url) return { valid: true }; // No media is valid

    // 1. Check if it's localhost (we assume server can access its own uploads)
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
        // Optional: Check if file exists on disk if it matches upload path pattern
        return { valid: true };
    }

    // 2. Head Request to check availability
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            return { valid: false, error: `URL de mídia inacessível (Status ${res.status})` };
        }

        const contentType = res.headers.get('content-type');
        if (contentType && type === 'image' && !contentType.startsWith('image/')) {
            return { valid: false, error: `URL não parece ser uma imagem (Tipo: ${contentType})` };
        }

        return { valid: true };
    } catch (e: any) {
        return { valid: false, error: `Erro ao acessar URL de mídia: ${e.message}` };
    }
}

// Create Campaign
export const createCampaign = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;

        // Limit Check (Feature)
        if (companyId) {
            const allowed = await checkLimit(companyId, 'campaigns');
            if (!allowed) {
                return res.status(403).json({ error: 'Seu plano não inclui Campanhas.' });
            }
        }

        const {
            name,
            message_template,
            scheduled_at,
            start_time,
            end_time,
            delay_min,
            delay_max,
            contacts, // [{phone, name, variables}]
            instance_id,
            instance_name
        } = req.body;

        const media_url = req.body.media_url;
        let media_type = req.body.media_type;

        // Validation
        if (!name || !message_template) {
            return res.status(400).json({ error: 'Name and message template are required' });
        }

        if (!instance_id) {
            return res.status(400).json({ error: 'Você deve selecionar uma instância para enviar a campanha.' });
        }

        // Validate Media if present
        if (media_url) {
            // Default to image if type is missing but url exists
            if (!media_type) media_type = 'image';

            const mediaCheck = await validateMediaUrl(media_url, media_type);
            if (!mediaCheck.valid) {
                return res.status(400).json({ error: mediaCheck.error });
            }
        }

        // Create campaign
        const campaignResult = await pool.query(
            `INSERT INTO whatsapp_campaigns 
            (name, message_template, company_id, user_id, scheduled_at, start_time, end_time, delay_min, delay_max, total_contacts, status, media_url, media_type, instance_id, instance_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
                media_url || null,
                media_type || null,
                instance_id,
                instance_name
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

        let query = `
            SELECT wc.*, ci.name as instance_display_name, ci.phone as instance_phone, ci.status as instance_status 
            FROM whatsapp_campaigns wc
            LEFT JOIN company_instances ci ON wc.instance_id = ci.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (user.role !== 'SUPERADMIN') {
            query += ' AND wc.company_id = $1';
            params.push(companyId);
        } else if (companyId) {
            query += ' AND wc.company_id = $1';
            params.push(companyId);
        }

        query += ' ORDER BY wc.created_at DESC';

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
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        const campaignResult = await pool.query(
            'SELECT * FROM whatsapp_campaigns WHERE id = $1',
            [id]
        );

        if (campaignResult.rows.length === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        const campaign = campaignResult.rows[0];

        // Access Check
        if (!isSuperAdmin && campaign.company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const contactsResult = await pool.query(
            'SELECT * FROM whatsapp_campaign_contacts WHERE campaign_id = $1 ORDER BY created_at ASC',
            [id]
        );

        res.json({
            ...campaign,
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
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Check ownership and instance status
        const check = await pool.query(`
            SELECT wc.company_id, wc.instance_id, ci.status as instance_status, ci.name as instance_name 
            FROM whatsapp_campaigns wc
            LEFT JOIN company_instances ci ON wc.instance_id = ci.id
            WHERE wc.id = $1
        `, [id]);

        if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

        const campaign = check.rows[0];
        if (!isSuperAdmin && campaign.company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Validate Instance status
        if (!campaign.instance_id) {
            return res.status(400).json({ error: 'Nenhuma instância selecionada para esta campanha.' });
        }

        if (campaign.instance_status !== 'connected' && campaign.instance_status !== 'open') {
            return res.status(400).json({
                error: `A instância "${campaign.instance_name || 'selecionada'}" não está conectada no momento.`
            });
        }

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
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Check ownership
        const check = await pool.query('SELECT company_id FROM whatsapp_campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

        if (!isSuperAdmin && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

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
            contacts,
            instance_id,
            instance_name
        } = req.body;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Check ownership
        const check = await pool.query('SELECT company_id FROM whatsapp_campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

        if (!isSuperAdmin && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const media_url = req.body.media_url;
        let media_type = req.body.media_type;

        // Validate Media if present
        if (media_url) {
            // Default to image if type is missing but url exists
            if (!media_type) media_type = 'image';

            const mediaCheck = await validateMediaUrl(media_url, media_type);
            if (!mediaCheck.valid) {
                return res.status(400).json({ error: mediaCheck.error });
            }
        }

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
                 instance_id = COALESCE($10, instance_id),
                 instance_name = COALESCE($11, instance_name),
                 updated_at = NOW()
             WHERE id = $12
             RETURNING *`,
            [
                name,
                message_template,
                scheduled_at || null,
                start_time,
                end_time,
                delay_min,
                delay_max,
                media_url || null,
                media_type || null,
                instance_id,
                instance_name,
                id
            ]
        );

        const campaign = campaignResult.rows[0];

        // If contacts are provided, replace them 
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
export const deleteCampaign = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Check ownership
        const check = await pool.query('SELECT company_id FROM whatsapp_campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

        if (!isSuperAdmin && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

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

    if (systemMode === 'readonly' || systemMode === 'emergency') {
        console.log(`[Campaign ${campaignId}] Not starting because system is in ${systemMode} mode.`);
        return;
    }

    if (!pool) {
        console.error(`[Campaign ${campaignId}] Database connection failed.`);
        return;
    }

    // ADVISORY LOCK: Prevent multiple workers (even on different server instances) from processing the SAME campaign
    const lockClient = await pool.connect();
    try {
        const lockRes = await lockClient.query('SELECT pg_try_advisory_lock(12345678, $1)', [campaignId]);
        if (!lockRes.rows[0].pg_try_advisory_lock) {
            console.log(`[Campaign ${campaignId}] Already being processed by another worker instance.`);
            return;
        }

        activeProcesses.add(campaignId);
        console.log(`[Campaign ${campaignId}] Starting/Resuming processing with advisory lock...`);

        // Check if campaign is still valid and connected
        const campaignResult = await lockClient.query(`
            SELECT wc.*, ci.status as instance_status, ci.name as instance_name 
            FROM whatsapp_campaigns wc
            LEFT JOIN company_instances ci ON wc.instance_id = ci.id
            WHERE wc.id = $1
        `, [campaignId]);

        if (campaignResult.rows.length === 0) {
            activeProcesses.delete(campaignId);
            return;
        }

        const campaign = campaignResult.rows[0];

        if (campaign.status === 'paused' || campaign.status === 'completed' || campaign.status === 'cancelled') {
            activeProcesses.delete(campaignId);
            return;
        }

        // Processing loop
        while (true) {
            try {
                // 1. RE-CHECK STATUS AND SESSION
                if (systemMode === 'readonly' || systemMode === 'emergency') break;

                const statusCheck = await lockClient.query(
                    'SELECT status FROM whatsapp_campaigns WHERE id = $1',
                    [campaignId]
                );
                if (statusCheck.rows[0]?.status !== 'running') break;

                // 2. TIME WINDOW CHECK
                const now = new Date();
                const brazilTimeStr = now.toLocaleTimeString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit', minute: '2-digit', hour12: false
                });

                const currentMinutes = getMinutes(brazilTimeStr);
                const startMinutes = getMinutes(campaign.start_time || '00:00');
                const endMinutes = getMinutes(campaign.end_time || '23:59');

                if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
                    console.log(`[Campaign ${campaignId}] Outside window (${brazilTimeStr}). Waiting...`);
                    break; // Stop for now, scheduler will re-run it when window opens
                }

                // 3. ATOMIC PICK NEXT CONTACT
                // This marks the contact as 'sending' atomically so no other process picks it
                const claimContact = await lockClient.query(`
                    UPDATE whatsapp_campaign_contacts
                    SET status = 'sending', updated_at = NOW()
                    WHERE id = (
                        SELECT id FROM whatsapp_campaign_contacts
                        WHERE campaign_id = $1 AND status = 'pending'
                        ORDER BY id ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                    )
                    RETURNING *
                `, [campaignId]);

                if (claimContact.rows.length === 0) {
                    // No more pending contacts
                    await lockClient.query(
                        `UPDATE whatsapp_campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
                        [campaignId]
                    );
                    break;
                }

                const contact = claimContact.rows[0];

                // 4. PREVENT DUPLICATE SENDS (REGRA OBRIGATÓRIA 2)
                // Check if this phone ALREADY received a message from this campaign successfully
                const alreadySent = await lockClient.query(
                    `SELECT id FROM whatsapp_campaign_contacts WHERE campaign_id = $1 AND phone = $2 AND status = 'sent' AND id != $3`,
                    [campaignId, contact.phone, contact.id]
                );

                if (alreadySent.rows.length > 0) {
                    console.log(`[Campaign ${campaignId}] Contact ${contact.phone} already received this campaign. Skipping duplicate.`);
                    await lockClient.query(
                        `UPDATE whatsapp_campaign_contacts SET status = 'skipped', error_message = 'Contato duplicado' WHERE id = $1`,
                        [contact.id]
                    );
                    continue;
                }

                // 5. SEND MESSAGE
                let message = campaign.message_template;
                const variables = (typeof contact.variables === 'string' ? JSON.parse(contact.variables) : contact.variables) || {};
                if (contact.name) variables.nome = contact.name;
                if (contact.phone) variables.telefone = contact.phone;

                Object.keys(variables).forEach(key => {
                    const val = variables[key] !== null && variables[key] !== undefined ? String(variables[key]) : "";
                    message = message.replace(new RegExp(`{${key}}`, 'gi'), val);
                });

                let result: { success: boolean; error?: string } = { success: false, error: 'Not started' };
                let attempts = 0;
                const maxAttempts = 3;

                while (attempts < maxAttempts) {
                    attempts++;

                    // SAFETY TIMEOUT RACE to prevent hanging indefinitely
                    const sendPromise = sendWhatsAppMessage({
                        companyId: campaign.company_id,
                        phone: contact.phone,
                        message,
                        contactName: contact.name,
                        userId: campaign.user_id,
                        io,
                        mediaUrl: campaign.media_url,
                        mediaType: campaign.media_type,
                        campaignId: campaign.id
                    });

                    // 45s hard timeout for the send operation
                    const timeoutPromise = new Promise<{ success: boolean, error?: string }>((resolve) => {
                        setTimeout(() => resolve({ success: false, error: 'TIMEOUT_ON_SEND_FUNCTION' }), 45000);
                    });

                    result = await Promise.race([sendPromise, timeoutPromise]);

                    if (result.success) break;
                    console.warn(`[Campaign ${campaignId}] Attempt ${attempts} failed for ${contact.phone}: ${result.error}`);
                    if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 2000));
                }

                // 6. UPDATE STATUS
                if (result.success) {
                    await lockClient.query(
                        `UPDATE whatsapp_campaign_contacts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
                        [contact.id]
                    );
                    await lockClient.query(
                        `UPDATE whatsapp_campaigns SET sent_count = sent_count + 1 WHERE id = $1`,
                        [campaignId]
                    );
                } else {
                    const errorMsg = (result.error || 'Failed').substring(0, 255);
                    await lockClient.query(
                        `UPDATE whatsapp_campaign_contacts SET status = 'failed', error_message = $1 WHERE id = $2`,
                        [errorMsg, contact.id]
                    );
                    await lockClient.query(
                        `UPDATE whatsapp_campaigns SET failed_count = failed_count + 1 WHERE id = $1`,
                        [campaignId]
                    );
                }

                // 7. DELAY (REGRA OBRIGATÓRIA 5)
                const delayMs = (Math.random() * (campaign.delay_max - campaign.delay_min) + parseInt(campaign.delay_min || 5)) * 1000;
                await new Promise(r => setTimeout(r, delayMs));

            } catch (innerError: any) {
                console.error(`[Campaign ${campaignId}] Inner loop error:`, innerError);
                // Safety break to prevent hot loop if DB is dead
                await new Promise(r => setTimeout(r, 5000));
            }
        }

    } catch (error: any) {
        console.error(`[Campaign ${campaignId}] Fatal error:`, error.message);
    } finally {
        // RELEASE LOCK
        try {
            await lockClient.query('SELECT pg_advisory_unlock(12345678, $1)', [campaignId]);
        } catch (e) { }
        lockClient.release();
        activeProcesses.delete(campaignId);
    }
}

// Scheduler to check for pending campaigns
export const checkAndStartScheduledCampaigns = async (io?: any) => {
    try {
        if (!pool) return;

        if (systemMode === 'readonly' || systemMode === 'emergency') {
            return;
        }

        // Find due campaigns OR running campaigns that are not being processed (interrupted)
        let result = null;
        try {
            result = await pool.query(
                `SELECT wc.id, wc.name, wc.status, wc.instance_id, ci.status as instance_status 
                 FROM whatsapp_campaigns wc
                 LEFT JOIN company_instances ci ON wc.instance_id = ci.id
                 WHERE (wc.status = 'scheduled' AND (wc.scheduled_at <= NOW() OR wc.scheduled_at IS NULL))
                    OR (wc.status = 'running')`
            );
        } catch (queryErr) {
            console.error("[Scheduler] Error querying campaigns:", queryErr);
            return;
        }

        if (!result) return;


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

