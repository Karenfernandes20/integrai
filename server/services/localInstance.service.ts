
import { pool } from '../db/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { Server } from 'socket.io';
import qrcode from 'qrcode';
import axios from 'axios';

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
        return (process.env.MINI_EVO_URL || 'http://localhost:3001').replace(/\/$/, "");
    }

    static async createLocalInstance(instanceId: string, companyId: number, io: Server) {
        // Initialize table for messages
        await this.ensureMessageTable(instanceId);

        // Update instance type and status in DB
        await pool.query(
            'UPDATE company_instances SET type = $1, status = $2 WHERE instance_key = $3 AND company_id = $4',
            ['local', 'connecting', instanceId, companyId]
        );

        // Fetch token for this instance
        const instRes = await pool.query('SELECT api_key FROM company_instances WHERE instance_key = $1', [instanceId]);
        const token = instRes.rows[0]?.api_key;

        // Proxy to Mini-Evolution to wake up/init instance
        try {
            await axios.get(`${this.getMiniEvoUrl()}/instance/connect/${instanceId}`, {
                headers: { 'apikey': token }
            });
            console.log(`[LocalInstance] Proxying connect to Mini-Evolution for ${instanceId}`);
        } catch (e: any) {
            console.error(`[LocalInstance] Error waking up instance ${instanceId}:`, e.message);
        }

        return { status: 'initializing' };
    }

    static async connectInstance(instanceId: string, companyId: number, io: Server) {
        return this.createLocalInstance(instanceId, companyId, io);
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
            const instRes = await pool.query('SELECT api_key FROM company_instances WHERE instance_key = $1', [instanceId]);
            const token = instRes.rows[0]?.api_key;

            const response = await axios.get(`${this.getMiniEvoUrl()}/instance/connect/${instanceId}`, {
                headers: { 'apikey': token }
            });

            if (response.data && response.data.qrcode) {
                // If it's already a data URL (base64 from Mini-Evo), return it. Otherwise convert.
                const qr = response.data.qrcode;
                if (qr.startsWith('data:image')) return qr;
                return qrcode.toDataURL(qr);
            }
        } catch (e: any) {
            console.error("LocalInstance.generateQRCode: Error fetching QR from mini-evo", e.message);
        }
        return null;
    }

    static async disconnectInstance(instanceId: string) {
        try {
            const instRes = await pool.query('SELECT api_key FROM company_instances WHERE instance_key = $1', [instanceId]);
            const token = instRes.rows[0]?.api_key;

            await axios.delete(`${this.getMiniEvoUrl()}/management/instances/${instanceId}`, {
                data: { confirmName: instanceId }, // External API requirement
                headers: { 'apikey': token }
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
