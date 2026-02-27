
import { pool } from '../db/index.js';
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    type WASocket,
    type ConnectionState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
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
    private static instances: Map<string, WASocket> = new Map();
    private static qrCodes: Map<string, string> = new Map();

    static async createLocalInstance(instanceId: string, companyId: number, io: Server) {
        // Initialize table for messages
        await this.ensureMessageTable(instanceId);

        // Update instance type and status in DB
        await pool.query(
            'UPDATE company_instances SET type = $1, status = $2 WHERE instance_key = $3 AND company_id = $4',
            ['local', 'connecting', instanceId, companyId]
        );

        return this.connectInstance(instanceId, companyId, io);
    }

    static async connectInstance(instanceId: string, companyId: number, io: Server) {
        const sessionDir = path.join(sessionsPath, `instance_${instanceId}`);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger
        });

        this.instances.set(instanceId, sock);

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`[LocalInstance] QR Code gerado para ${instanceId}`);
                this.qrCodes.set(instanceId, qr);
                try {
                    const qrBase64 = await qrcode.toDataURL(qr);
                    io.to(`company_${companyId}`).emit('instance:qrcode', { instanceId, qr: qrBase64 });
                } catch (e) {
                    console.error('[LocalInstance] Failed to generate QR Base64', e);
                }
            }

            if (connection === 'close') {
                this.qrCodes.delete(instanceId);
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

                await pool.query(
                    'UPDATE company_instances SET status = $1 WHERE instance_key = $2',
                    ['disconnected', instanceId]
                );
                io.to(`company_${companyId}`).emit('instance:status', { instanceKey: instanceId, status: 'disconnected' });

                if (shouldReconnect) {
                    setTimeout(() => {
                        this.connectInstance(instanceId, companyId, io);
                    }, 5000);
                } else {
                    this.instances.delete(instanceId);
                    const sessionDir = path.join(sessionsPath, `instance_${instanceId}`);
                    if (fs.existsSync(sessionDir)) {
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                    }
                }
            } else if (connection === 'open') {
                this.qrCodes.delete(instanceId);
                console.log(`[LocalInstance] Instance ${instanceId} connected`);

                await pool.query(
                    'UPDATE company_instances SET status = $1 WHERE instance_key = $2',
                    ['connected', instanceId]
                );
                io.to(`company_${companyId}`).emit('instance:status', { instanceKey: instanceId, status: 'connected' });
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'append' || m.type === 'notify') {
                for (const msg of m.messages) {
                    if (!msg.key.fromMe) {
                        await this.saveMessage(instanceId, msg, io);
                    }
                }
            }
        });

        return sock;
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
        const timestamp = msg.messageTimestamp;

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
            const OUTRO_SISTEMA_URL = process.env.MINI_EVO_URL || 'http://localhost:3001';
            const qrRes = await fetch(`${OUTRO_SISTEMA_URL}/get-qr`);

            if (qrRes.ok) {
                const data = await qrRes.json() as any;
                if (data.qr) {
                    return qrcode.toDataURL(data.qr);
                }
            }
        } catch (e) {
            console.error("LocalInstance.generateQRCode: Error fetching QR from mini-evo", e);
        }

        const qrString = this.qrCodes.get(instanceId);
        if (qrString) {
            return qrcode.toDataURL(qrString);
        }
        return null;
    }

    static async disconnectInstance(instanceId: string) {
        try {
            const OUTRO_SISTEMA_URL = process.env.MINI_EVO_URL || 'http://localhost:3001';
            await fetch(`${OUTRO_SISTEMA_URL}/logout`, { method: 'POST' });
        } catch (e) {
            console.error("LocalInstance.disconnectInstance: Error calling mini-evo logout", e);
        }

        await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', ['disconnected', instanceId]);

        // Clean up memory if any local socket was left here magically
        const sock = this.instances.get(instanceId);
        if (sock) {
            await sock.logout();
            this.instances.delete(instanceId);
        }
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

    static getInstanceStatus(instanceId: string) {
        const sock = this.instances.get(instanceId);
        if (!sock) return 'disconnected';
        return 'connected'; // Simplified, should check actual sock state
    }
}
