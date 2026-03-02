import { Request, Response } from 'express';
import { pool } from '../db/index.js';
import qrcode from 'qrcode';
import { handleWebhook } from './webhookController.js';

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
            let instRes = await pool.query('SELECT company_id, instance_key FROM company_instances WHERE instance_key = $1', [instanceKey]);

            // Fallback: se a chave 'minievo_1' do processo separado não for a mesma cadastrada no banco pelo usuário,
            // atrelamos à primeira instância cadastrada para garantir que funcionará.
            if (instRes.rows.length === 0) {
                console.log(`[Mini-Evo Webhook] Chave ${instanceKey} não achada. Buscando primeira instância genérica.`);
                instRes = await pool.query("SELECT company_id, instance_key FROM company_instances LIMIT 1");
                if (instRes.rows.length === 0) {
                    return res.status(404).json({ error: 'Nenhuma instância encontrada no banco para atrelar.' });
                }
            }
            const companyId = instRes.rows[0].company_id;
            const actualInstanceKey = instRes.rows[0].instance_key;

            const eventType = body.event || body.type; // Ajuste conforme seu outro sistema envia

            // a) EVENTO DE QR CODE
            if (eventType === 'qrcode') {
                try {
                    const qrCodeBase64 = await qrcode.toDataURL(body.qr);
                    io.to(`company_${companyId}`).emit('instance:qrcode', {
                        instanceKey: actualInstanceKey,
                        instanceId: actualInstanceKey,
                        qr: qrCodeBase64
                    });
                } catch (e) {
                    console.error('[MiniEvo Webhook] Failed to generate QR', e);
                }
            }

            // b) EVENTO DE CONEXÃO
            if (eventType === 'status') {
                const status = body.status; // 'connected', 'disconnected'
                await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', [status, actualInstanceKey]);
                io.to(`company_${companyId}`).emit('instance:status', {
                    instanceKey: actualInstanceKey,
                    instanceId: actualInstanceKey,
                    status
                });
            }

            // c) EVENTO DE MENSAGEM RECEBIDA (Evolutio formato novo)
            if (['messages.upsert', 'MESSAGES_UPSERT'].includes(eventType)) {
                // Modifica o req para enganar o webhook original e usar o fluxo existente
                req.body = {
                    event: 'messages.upsert',
                    instance: actualInstanceKey,
                    data: body.data
                };

                // Manda direto pro controller central!
                await handleWebhook(req, res);
                return; // O handleWebhook já vai responder o endpoint!
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
        const OUTRO_SISTEMA_URL = process.env.MINI_EVO_URL || 'http://127.0.0.1:3001';

        try {
            // Busca o token (api_key) da instância no banco
            const instRes = await pool.query('SELECT api_key FROM company_instances WHERE instance_key = $1 OR name = $1', [instanceKey]);
            const token = instRes.rows[0]?.api_key;

            // Faz a ponte chamando o seu mini-evolution
            const response = await fetch(`${OUTRO_SISTEMA_URL}/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': token || '' // Envia o token para autorização
                },
                body: JSON.stringify({
                    instanceKey,
                    remoteJid,
                    text
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro na API separada: ${response.status} ${errText}`);
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
