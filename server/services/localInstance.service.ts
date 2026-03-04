
import { pool } from '../db/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { Server } from 'socket.io';
import qrcode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionsPath = path.join(__dirname, '../../sessions');
if (!fs.existsSync(sessionsPath)) {
    fs.mkdirSync(sessionsPath, { recursive: true });
}

const logger = pino({ level: 'silent' });

export class LocalInstanceService {
    private static qrCodes: Map<string, string> = new Map();

    private static getMiniEvoUrl() {
        return (process.env.MINI_EVO_URL || 'http://127.0.0.1:3001').replace(/\/$/, "");
    }

    private static async getCompanyUrlForInstance(instanceId: string) {
        return this.getMiniEvoUrl();
    }

    static async createLocalInstance(instanceId: string, companyId: number, io: Server, apiKey?: string) {
        // Initialize table for messages
        await this.ensureMessageTable(instanceId);

        // Update instance type and status in DB
        await pool.query(
            'UPDATE company_instances SET type = $1, status = $2 WHERE instance_key = $3 AND company_id = $4',
            ['local', 'connecting', instanceId, companyId]
        );

        // Fetch instance data (name and api_key)
        const instRes = await pool.query('SELECT name, api_key FROM company_instances WHERE instance_key = $1', [instanceId]);
        const instance = instRes.rows[0];
        const token = apiKey || instance?.api_key;
        const name = instance?.name || instanceId;

        const baseUrl = await this.getCompanyUrlForInstance(instanceId);

        // 1. Ensure instance exists in Mini-Evolution
        try {
            console.log(`[LocalInstance] Ensuring registration for ${instanceId} in Mini-Evolution at ${baseUrl}...`);
            const regResponse = await fetch(`${baseUrl}/management/instances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: instanceId,
                    name: name,
                    token: token
                })
            });
            if (!regResponse.ok) {
                console.warn(`[LocalInstance] Registration warning: ${await regResponse.text()}`);
            }
        } catch (e: any) {
            console.error(`[LocalInstance] Failed to register/check instance: ${e.message}`);
        }

        // 2. Proxy to Mini-Evolution to wake up/init instance
        try {
            console.log(`[LocalInstance] Connecting to Mini-Evolution for ${instanceId} at ${baseUrl}...`);
            const response = await fetch(`${baseUrl}/instance/connect/${instanceId}`, {
                headers: { 'apikey': (token as string) || '' }
            });

            if (!response.ok) {
                const text = await response.text();
                let errorDetails = text;
                try {
                    const json = JSON.parse(text);
                    errorDetails = json.error || json.message || text;
                } catch (e) { }
                throw new Error(`Mini-Evolution respondeu ${response.status}: ${errorDetails}`);
            }

            const data: any = await response.json();
            console.log(`[LocalInstance] Mini-Evolution status for ${instanceId}:`, data.status);

            if (data.status === 'connected' || data.status === 'open') {
                await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', ['connected', instanceId]);
                io.to(`company_${companyId}`).emit('instance:status', {
                    instanceKey: instanceId,
                    status: 'connected',
                    state: 'open'
                });
            }

            return { success: true, status: data.status, message: data.message };
        } catch (e: any) {
            console.error(`[LocalInstance] Error waking up instance ${instanceId}:`, e.message);
            if (e.message?.includes('fetch failed') || e.code === 'ECONNREFUSED') {
                throw new Error(`Não foi possível conectar ao servidor da API Plus (Mini-Evolution) em ${baseUrl}. O servidor pode estar offline ou configurado incorretamente.`);
            }
            throw e;
        }
    }

    static async connectInstance(instanceId: string, companyId: number, io: Server, apiKey?: string) {
        return this.createLocalInstance(instanceId, companyId, io, apiKey);
    }


    private static async ensureMessageTable(instanceId: string) {
        const tableName = `messages_instance_${instanceId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                remote_jid VARCHAR(255),
                from_me BOOLEAN,
                message_type VARCHAR(50),
                content TEXT,
                media_url TEXT,
                timestamp BIGINT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
    }

    private static async saveMessage(instanceId: string, msg: any, io: Server) {
        const tableName = `messages_instance_${instanceId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const remoteJid = msg.key.remoteJid;
        const fromMe = msg.key.fromMe || false;
        const rawTimestamp = msg.messageTimestamp;
        const timestamp = typeof rawTimestamp === 'object' && rawTimestamp !== null ?
            (rawTimestamp.low || rawTimestamp.toNumber?.() || Date.now()) :
            (rawTimestamp || Math.floor(Date.now() / 1000));

        let content = '';
        let messageType = 'text';
        let mediaUrl = null;

        if (msg.message?.conversation) {
            content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
            messageType = 'image';
            content = msg.message.imageMessage.caption || '';
            // Media handling would go here, for now we just store the fact it is an image
        } else if (msg.message?.videoMessage) {
            messageType = 'video';
            content = msg.message.videoMessage.caption || '';
        }

        await pool.query(`
            INSERT INTO ${tableName} (remote_jid, from_me, message_type, content, media_url, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [remoteJid, fromMe, messageType, content, mediaUrl, timestamp]);

        // Emit to frontend
        // We need to find companyId to emit to the right room
        const res = await pool.query('SELECT company_id FROM company_instances WHERE instance_key = $1', [instanceId]);
        if (res.rows.length > 0) {
            const companyId = res.rows[0].company_id;
            io.to(`company_${companyId}`).emit('newMessage', {
                instanceId,
                message: {
                    remoteJid,
                    fromMe,
                    messageType,
                    content,
                    timestamp
                }
            });
        }
    }

    static async generateQRCode(instanceId: string) {
        try {
            const instRes = await pool.query(
                'SELECT ci.api_key FROM company_instances ci WHERE ci.instance_key = $1',
                [instanceId]
            );

            const instanceData = instRes.rows[0];
            const token = instanceData?.api_key;
            const baseUrl = await this.getCompanyUrlForInstance(instanceId);

            if (!token) {
                console.warn(`[LocalInstance] No api_key found in DB for instance ${instanceId}.`);
            }

            const url = `${baseUrl}/instance/connect/${instanceId}`;
            console.log(`[LocalInstance] Fetching QR from: ${url}`);

            const response = await fetch(url, {
                headers: { 'apikey': (token as string) || '' }
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => "No body");
                console.error(`[LocalInstance] Mini-Evolution error ${response.status}:`, errorBody);

                let parsedError = errorBody;
                try {
                    const json = JSON.parse(errorBody);
                    parsedError = json.error || json.message || errorBody;
                } catch (e) { }

                if (response.status === 404) {
                    return { status: 'error', error: 'Instância não encontrada na API Interna.' };
                }

                throw new Error(`Mini-Evolution respondeu ${response.status}: ${parsedError}`);
            }

            const data: any = await response.json().catch(() => ({}));
            console.log(`[LocalInstance] Mini-Evolution response for ${instanceId}:`, JSON.stringify(data));

            if (data && data.qrcode) {
                const qr = data.qrcode;
                const finalQr = qr.startsWith('data:image') ? qr : await qrcode.toDataURL(qr);
                return { status: 'scanning', qr: finalQr };
            }

            if (data.status === 'connected' || data.status === 'open') {
                // If it's already connected, update DB. Webhook or polling will notify frontend
                await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', ['connected', instanceId]);
                return { status: 'connected', message: 'Instância já conectada.' };
            }

            if (data.status === 'connecting') {
                return { status: 'connecting', message: data.message || 'WhatsApp está iniciando, aguarde...' };
            }

            return {
                status: 'error',
                error: 'Resposta inesperada do Mini-Evolution',
                details: data
            };
        } catch (e: any) {
            const baseUrl = await this.getCompanyUrlForInstance(instanceId).catch(() => this.getMiniEvoUrl());
            console.error("LocalInstance.generateQRCode: CRITICAL ERROR:", e.message);
            if (e.message.includes('ECONNREFUSED') || e.message.includes('fetch failed')) {
                return {
                    status: 'error',
                    error: 'API Interna (Mini Evolution) fora do ar',
                    details: `Não foi possível conectar em ${baseUrl}. O servidor nodejs separado de conexões está offline ou o proxy bloqueou o acesso.`
                };
            }
            return { status: 'error', error: e.message };
        }
    }

    static async disconnectInstance(instanceId: string) {
        try {
            const instRes = await pool.query('SELECT api_key FROM company_instances WHERE instance_key = $1', [instanceId]);
            const token = instRes.rows[0]?.api_key;
            const baseUrl = await this.getCompanyUrlForInstance(instanceId);

            await fetch(`${baseUrl}/management/instances/${instanceId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': (token as string) || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ confirmName: instanceId })
            });
        } catch (e: any) {
            console.error("LocalInstance.disconnectInstance: Error calling mini-evo logout", e.message);
        }

        await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', ['disconnected', instanceId]);
    }

    static async deleteInstance(instanceId: string) {
        await this.disconnectInstance(instanceId);
        const tableName = `messages_instance_${instanceId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await pool.query(`DROP TABLE IF EXISTS ${tableName}`);

        const sessionDir = path.join(sessionsPath, `instance_${instanceId}`);
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
    }

    static async getInstanceStatus(instanceId: string): Promise<string> {
        try {
            const instRes = await pool.query('SELECT status FROM company_instances WHERE instance_key = $1', [instanceId]);
            return instRes.rows[0]?.status || 'disconnected';
        } catch (e) {
            return 'disconnected';
        }
    }
}
