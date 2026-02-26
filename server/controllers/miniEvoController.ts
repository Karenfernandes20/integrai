import { Request, Response } from 'express';
import { pool } from '../db/index.js';

export class MiniEvoController {
    // =========================================================================
    // 1. WEBHOOK (Receber mensagens e QR Code do seu sistema separado)
    // Rota: POST /api/minievo/webhook/:instanceKey
    // =========================================================================
    async webhook(req: Request, res: Response) {
        const { instanceKey } = req.params;
        const body = req.body;
        const io = req.app.get('io');

        try {
            console.log(`[Mini-Evo Webhook] Recebido da instância ${instanceKey}:`, body);

            // Busca a qual empresa essa instância pertence
            const instRes = await pool.query('SELECT company_id FROM company_instances WHERE instance_key = $1', [instanceKey]);
            if (instRes.rows.length === 0) {
                return res.status(404).json({ error: 'Instância não encontrada no banco.' });
            }
            const companyId = instRes.rows[0].company_id;

            const eventType = body.event || body.type; // Ajuste conforme seu outro sistema envia

            // a) EVENTO DE QR CODE
            if (eventType === 'qrcode') {
                const qrCodeBase64 = body.qr; // Payload esperado do seu sistema
                io.to(`company_${companyId}`).emit('instance:qrcode', {
                    instanceId: instanceKey,
                    qr: qrCodeBase64
                });
            }

            // b) EVENTO DE CONEXÃO
            if (eventType === 'status') {
                const status = body.status; // 'connected', 'disconnected'
                await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', [status, instanceKey]);
                io.to(`company_${companyId}`).emit('instance:status', {
                    instanceId: instanceKey,
                    status
                });
            }

            // c) EVENTO DE MENSAGEM RECEBIDA
            if (eventType === 'message') {
                const remoteJid = body.remoteJid; // Ex: 5511999999999@s.whatsapp.net
                const text = body.text;
                const fromMe = body.fromMe || false;

                // Emite a mensagem ao vivo pro frontend
                io.to(`company_${companyId}`).emit('newMessage', {
                    instanceId: instanceKey,
                    message: {
                        remoteJid,
                        content: text,
                        fromMe,
                        timestamp: Date.now()
                    }
                });

                // Aqui você vai adicionar a lógica de Salvar o Contato e a Mensagem nas tabelas
                // (Mimetize o comportamento do webhookController.ts existente)
            }

            res.status(200).json({ success: true, message: 'Webhook recebido.' });
        } catch (error: any) {
            console.error('[Mini-Evo Webhook] Erro:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // =========================================================================
    // 2. ENVIAR MENSAGENS (Do seu CRM para seu sistema separado)
    // Rota: POST /api/minievo/send
    // =========================================================================
    async sendMessage(req: Request, res: Response) {
        const { instanceKey, remoteJid, text } = req.body;

        // Substitua pela porta/URL do seu outro sistema rodando localmente
        const OUTRO_SISTEMA_URL = process.env.MINI_EVO_URL || 'http://localhost:3001';

        try {
            // Faz a ponte chamando o seu mini-evolution
            const response = await fetch(`${OUTRO_SISTEMA_URL}/send-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceKey,
                    remoteJid,
                    text
                })
            });

            if (!response.ok) {
                throw new Error(`Erro na API separada: ${response.statusText}`);
            }

            const data = await response.json();

            // Log no banco do CRM simulando o envio
            res.json({ success: true, data });
        } catch (error: any) {
            console.error('[Mini-Evo Send] Erro:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

export default new MiniEvoController();
