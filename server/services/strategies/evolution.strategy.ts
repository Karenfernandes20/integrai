import { InstanceStrategy } from './instance.strategy.js';
import { pool } from '../../db/index.js';
import { resolveEvolutionConfig } from '../../controllers/evolutionController.js';

export class EvolutionStrategy implements InstanceStrategy {
    async createInstance(instanceId: string, companyId: number, io: any) {
        // Evolution creates instance when connect is called if it doesn't exist
        return this.connectInstance(instanceId, companyId, io);
    }

    async connectInstance(instanceId: string, companyId: number, io: any): Promise<any> {
        const config = await resolveEvolutionConfig({ instanceKey: instanceId, companyId });
        const EVOLUTION_API_URL = config.url;
        const EVOLUTION_API_KEY = config.apikey;

        const connectUrl = `${EVOLUTION_API_URL}/instance/connect/${instanceId}`;
        const response = await fetch(connectUrl, {
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                // Auto-create
                const createUrl = `${EVOLUTION_API_URL}/instance/create`;
                await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_API_KEY
                    },
                    body: JSON.stringify({
                        instanceName: instanceId,
                        token: EVOLUTION_API_KEY,
                        qrcode: true,
                        integration: 'WHATSAPP-BAILEYS'
                    })
                });
                return this.connectInstance(instanceId, companyId, io);
            }
            throw new Error(`Evolution API Error: ${response.status}`);
        }

        const data = await response.json() as any;
        const qrcode = data.qrCode || data.qrcode || data.qr || (data.code?.base64);

        if (qrcode) {
            let qr = qrcode;
            if (qr.startsWith('data:image/png;base64,')) {
                qr = qr.replace('data:image/png;base64,', '');
            }
            io.to(`company_${companyId}`).emit('instance:qrcode', { instanceId, qr });
        }

        return data;
    }

    async disconnectInstance(instanceId: string) {
        // We need companyId to resolve config, but if we don't have it, we use global fallback
        const instRes = await pool.query('SELECT company_id, api_key FROM company_instances WHERE instance_key = $1', [instanceId]);
        if (instRes.rows.length === 0) return;

        const companyId = instRes.rows[0].company_id;
        const config = await resolveEvolutionConfig({ instanceKey: instanceId, companyId });

        const logoutUrl = `${config.url}/instance/logout/${instanceId}`;
        await fetch(logoutUrl, {
            method: 'DELETE',
            headers: { 'apikey': config.apikey }
        });

        await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', ['disconnected', instanceId]);
    }

    async deleteInstance(instanceId: string) {
        const instRes = await pool.query('SELECT company_id, api_key FROM company_instances WHERE instance_key = $1', [instanceId]);
        if (instRes.rows.length === 0) return;

        const companyId = instRes.rows[0].company_id;
        const config = await resolveEvolutionConfig({ instanceKey: instanceId, companyId });

        const deleteUrl = `${config.url}/instance/delete/${instanceId}`;
        await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { 'apikey': config.apikey }
        });

        await pool.query('DELETE FROM company_instances WHERE instance_key = $1', [instanceId]);
    }

    async getQRCode(instanceId: string) {
        const instRes = await pool.query('SELECT company_id FROM company_instances WHERE instance_key = $1', [instanceId]);
        if (instRes.rows.length === 0) return null;

        const config = await resolveEvolutionConfig({ instanceKey: instanceId, companyId: instRes.rows[0].company_id });
        const connectUrl = `${config.url}/instance/connect/${instanceId}`;
        const response = await fetch(connectUrl, {
            headers: { 'apikey': config.apikey }
        });

        if (!response.ok) return null;
        const data = await response.json() as any;
        return data.qrCode || data.qrcode || data.qr || (data.code?.base64) || null;
    }

    async getStatus(instanceId: string) {
        return 'unknown';
    }
}
