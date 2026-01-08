import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { systemMode } from '../systemState';

import { checkLimit, incrementUsage } from '../services/limitService';

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

        // Check ownership
        const check = await pool.query('SELECT company_id FROM whatsapp_campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

        if (!isSuperAdmin && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
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
            contacts
        } = req.body;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Check ownership
        const check = await pool.query('SELECT company_id FROM whatsapp_campaigns WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

        if (!isSuperAdmin && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
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
                // Re-check system mode
                if (systemMode === 'readonly' || systemMode === 'emergency') {
                    console.log(`[Campaign ${campaignId}] Stopping because system switched to ${systemMode} mode.`);
                    return;
                }

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

                let result: { success: boolean; error?: string } = { success: false, error: 'Not started' };
                let attempts = 0;
                const maxAttempts = 3;

                while (attempts < maxAttempts) {
                    attempts++;
                    result = await sendWhatsAppMessage(
                        campaign.company_id,
                        contact.phone,
                        message,
                        contact.name,
                        campaign.user_id,
                        io,
                        campaign.media_url,
                        campaign.media_type,
                        campaign.id
                    );

                    if (result.success) break;

                    if (attempts < maxAttempts) {
                        console.log(`[Campaign ${campaignId}] Retry ${attempts}/${maxAttempts} for ${contact.phone} after 2s delay...`);
                        await new Promise(r => setTimeout(r, 2000));

                        await logEvent({
                            eventType: 'campaign_retry',
                            origin: 'system',
                            status: 'info',
                            message: `Campanha ${campaignId}: Tentativa ${attempts} de envio para ${contact.phone}`,
                            phone: contact.phone,
                            details: { campaignId, contactId: contact.id, attempt: attempts }
                        });
                    }
                }

                if (result.success) {
                    await pool.query(
                        `UPDATE whatsapp_campaign_contacts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
                        [contact.id]
                    );

                    await pool.query(
                        `UPDATE whatsapp_campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
                        [campaignId]
                    );

                    await logEvent({
                        eventType: 'campaign_success',
                        origin: 'system',
                        status: 'success',
                        message: `Campanha ${campaignId}: Mensagem enviada para ${contact.phone} (Tentativas: ${attempts})`,
                        phone: contact.phone,
                        details: { campaignId, contactId: contact.id, attempts }
                    });
                } else {
                    let errorMsg = (result.error || 'Evolution API failed (Unknown Error)').substring(0, 255);
                    if (!errorMsg || errorMsg.trim() === "") {
                        errorMsg = "Falha crítica: erro ocorreu no envio de imagem e não foi retornado pela Evolution API";
                    }

                    console.error(`[Campaign ${campaignId}] FAILED for ${contact.phone}: ${errorMsg}`);

                    await pool.query(
                        `UPDATE whatsapp_campaign_contacts SET status = 'failed', error_message = $1 WHERE id = $2`,
                        [errorMsg, contact.id]
                    );

                    await pool.query(
                        `UPDATE whatsapp_campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
                        [campaignId]
                    );

                    await logEvent({
                        eventType: 'campaign_fail',
                        origin: 'system',
                        status: 'error',
                        message: `Campanha ${campaignId}: Falha para ${contact.phone}: ${errorMsg}`,
                        phone: contact.phone,
                        details: { campaignId, contactId: contact.id, error: errorMsg }
                    });
                }

                // Random delay between messages
                const delayMs = (Math.random() * (campaign.delay_max - campaign.delay_min) + parseInt(campaign.delay_min || 5)) * 1000;
                await new Promise(r => setTimeout(r, delayMs));

            } catch (err: any) {
                console.error(`[Campaign ${campaignId}] EXCEPTION on contact ${contact.phone}:`, err);
                const errorMsg = (err.message || "Erro interno não tratado").substring(0, 255);
                await pool.query(
                    `UPDATE whatsapp_campaign_contacts SET status = 'failed', error_message = $1 WHERE id = $2`,
                    [errorMsg, contact.id]
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

        if (systemMode === 'readonly' || systemMode === 'emergency') {
            return;
        }

        // Find due campaigns OR running campaigns that are not being processed (interrupted)
        let result = null;
        try {
            result = await pool.query(
                `SELECT id, name, status FROM whatsapp_campaigns 
                 WHERE (status = 'scheduled' AND (scheduled_at <= NOW() OR scheduled_at IS NULL))
                    OR (status = 'running')`
            );
        } catch (queryErr) {
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

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(
    companyId: number | null,
    phone: string,
    message: string,
    contactName?: string,
    userId?: number | null,
    io?: any,
    mediaUrl?: string | null,
    mediaType?: string | null,
    campaignId?: number
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!pool) return { success: false, error: 'Database not configured' };

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
            return { success: false, error: 'No API Key found' };
        }

        // Limit Check for Messages
        if (companyId) {
            const allowed = await checkLimit(companyId, 'messages');
            if (!allowed) {
                console.error(`[sendWhatsAppMessage] Message limit reached for company ${companyId}`);
                return { success: false, error: 'Message limit reached' };
            }
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

        // FIX: Convert local media to Base64 for remote Evolution API
        // Always try to resolve the file locally if it looks like it belongs to our uploads
        let finalMedia = mediaUrl;
        let finalMimeType = 'application/octet-stream';

        if (isMedia && mediaUrl) {
            try {
                // Check if it's a local file URL
                if (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1') || mediaUrl.includes('/uploads/')) {
                    const urlParts = mediaUrl.split('/uploads/');
                    const filename = urlParts.length > 1 ? urlParts[1].split('?')[0] : null;

                    if (filename) {
                        const __filename = fileURLToPath(import.meta.url);
                        const __dirname = path.dirname(__filename);

                        const projectRoot = process.cwd();
                        const possiblePaths = [
                            path.join(projectRoot, 'server', 'uploads', filename),
                            path.join(projectRoot, 'uploads', filename),
                            path.join(__dirname, '..', 'uploads', filename),
                            path.join(__dirname, '..', '..', 'uploads', filename)
                        ];

                        console.log(`[sendWhatsAppMessage] MEDIA DEBUG - Searching for file: ${filename}`);
                        let fileFoundPath = null;
                        for (const p of possiblePaths) {
                            const exists = fs.existsSync(p);
                            console.log(`[sendWhatsAppMessage] -> Checking: ${p} | Exists: ${exists}`);
                            if (exists) {
                                fileFoundPath = p;
                                break;
                            }
                        }

                        if (fileFoundPath) {
                            console.log(`[sendWhatsAppMessage] ✓ Local file found at: ${fileFoundPath}`);
                            const fileBuffer = fs.readFileSync(fileFoundPath);
                            const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
                            console.log(`[sendWhatsAppMessage] File size: ${fileSizeKB} KB`);

                            const base64 = fileBuffer.toString('base64');
                            const ext = filename.split('.').pop()?.toLowerCase() || '';
                            const mimes: Record<string, string> = {
                                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
                                'mp3': 'audio/mpeg', 'ogg': 'audio/ogg', 'mp4': 'video/mp4', 'pdf': 'application/pdf',
                                'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                            };
                            finalMimeType = mimes[ext] || 'application/octet-stream';
                            finalMedia = `data:${finalMimeType};base64,${base64}`;

                            console.log(`[sendWhatsAppMessage] ✓ Base64 conversion successful. MIME: ${finalMimeType}, Length: ${base64.length}`);
                        } else {
                            console.error(`[sendWhatsAppMessage] ✗ File NOT found locally: ${filename}`);
                            // Fallback: If it's NOT a localhost URL, permit Evolution to fetch directly
                            if (!mediaUrl.includes('localhost') && !mediaUrl.includes('127.0.0.1')) {
                                console.log(`[sendWhatsAppMessage] ! URL is NOT localhost, permitting Evolution to fetch directly: ${mediaUrl}`);
                                finalMedia = mediaUrl;
                            } else {
                                return { success: false, error: `Arquivo local não encontrado: ${filename}` };
                            }
                        }
                    } else {
                        console.error(`[sendWhatsAppMessage] Could not extract filename from URL: ${mediaUrl}`);
                        return { success: false, error: 'URL de mídia inválida - não foi possível extrair o nome do arquivo' };
                    }
                } else {
                    console.log(`[sendWhatsAppMessage] Using remote media URL directly: ${mediaUrl}`);
                }
            } catch (e) {
                console.error(`[sendWhatsAppMessage] ✗ EXCEPTION processing media:`, e);
                console.error(`[sendWhatsAppMessage] Stack trace:`, (e as Error).stack);
                return { success: false, error: `Falha ao processar mídia: ${(e as Error).message}` };
            }
        }

        console.log(`[sendWhatsAppMessage] POST ${targetUrl} | Target: ${cleanPhone} | Type: ${isMedia ? mediaType : 'text'} | Media: ${finalMedia?.substring(0, 50)}...`);

        let payload: any = {
            number: cleanPhone,
            options: {
                delay: 1200,
                presence: "composing",
                linkPreview: false
            }
        };

        if (isMedia) {
            // Simplified and documented payload structure matching Atendimento/evolutionController logic
            payload.mediaMessage = {
                mediatype: mediaType, // image, video, audio, document
                caption: message || "",
                media: finalMedia, // Base64 or URL
                fileName: (mediaUrl?.split('/').pop() || 'file').split('?')[0]
            };

            // LOG THE MEDIA PAYLOAD (MASKED)
            console.log(`[sendWhatsAppMessage] PAYLOAD PREVIEW (Media):`, JSON.stringify({
                ...payload,
                mediaMessage: {
                    ...payload.mediaMessage,
                    media: finalMedia && finalMedia.length > 100 ? `${finalMedia.substring(0, 50)}... [Total: ${finalMedia.length} chars]` : finalMedia
                }
            }, null, 2));
        } else {
            payload.textMessage = { text: message };
            payload.text = message; // backward compat key
        }

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolution_apikey
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error(`[sendWhatsAppMessage] FAILED RESPONSE: Status ${response.status}`);
            console.error(`[sendWhatsAppMessage] RESPONSE BODY: ${responseText}`);

            // Try to extract a clean error message
            let cleanError = `Evolution API Error ${response.status}: ${responseText.substring(0, 100)}`;
            try {
                const jsonErr = JSON.parse(responseText);
                cleanError = jsonErr.message || jsonErr.error || jsonErr.response?.message || cleanError;
            } catch (p) { }

            return { success: false, error: cleanError };
        }

        const data = JSON.parse(responseText);

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
                         SET last_message = $1, last_message_at = NOW(), status = 'OPEN', user_id = COALESCE(user_id, $2), company_id = COALESCE(company_id, $3), last_message_source = $5
                         WHERE id = $4`,
                        [message, userId, companyId, conversationId, campaignId ? 'campaign' : null]
                    );
                } else {
                    // Create new conversation
                    const newConv = await pool.query(
                        `INSERT INTO whatsapp_conversations (external_id, phone, contact_name, instance, status, user_id, last_message, last_message_at, company_id, last_message_source) 
                         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, NOW(), $7, $8) RETURNING id`,
                        [remoteJid, cleanPhone, contactName || cleanPhone, evolution_instance, userId, message, companyId, campaignId ? 'campaign' : null]
                    );
                    conversationId = newConv.rows[0].id;
                }

                const externalMessageId = data?.key?.id;

                // Insert message
                // Note: We should probably store media_url if it's a media message
                const insertedMsg = await pool.query(
                    'INSERT INTO whatsapp_messages (conversation_id, direction, content, sent_at, status, external_id, user_id, media_url, message_type, campaign_id) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9) RETURNING id',
                    [conversationId, 'outbound', message, 'sent', externalMessageId, userId, mediaUrl || null, mediaType || 'text', campaignId || null]
                );

                // Increment Usage
                if (companyId) {
                    await incrementUsage(companyId, 'messages', 1);
                }

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
            } catch (p) {
                console.error("[sendWhatsAppMessage] Error syncing with Atendimento:", p);
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error sending WhatsApp message:', error);
        return { success: false, error: error.message };
    }
}
