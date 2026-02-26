import { InstanceStrategy } from './instance.strategy.js';
import { pool } from '../../db/index.js';
import { validateMetaConnection } from '../whatsappMetaService.js';

export class OfficialStrategy implements InstanceStrategy {
    async createInstance(instanceId: string, companyId: number, io: any): Promise<any> {
        return { success: true };
    }

    async connectInstance(instanceId: string, companyId: number, io: any): Promise<any> {
        // Fetch config from DB
        const res = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
        if (res.rows.length === 0) throw new Error('Company not found');
        const company = res.rows[0];

        const validation = await validateMetaConnection({
            accessToken: company.access_token,
            apiVersion: company.api_version || 'v18.0',
            wabaId: company.waba_id,
            phoneNumberId: company.phone_number_id
        });

        if (validation.status === 'CONECTADO') {
            await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', ['connected', instanceId]);
            io.to(`company_${companyId}`).emit('instance:status', { instanceId, status: 'connected' });
        }

        return validation;
    }

    async disconnectInstance(instanceId: string): Promise<any> {
        await pool.query('UPDATE company_instances SET status = $1 WHERE instance_key = $2', ['disconnected', instanceId]);
        return { success: true };
    }

    async deleteInstance(instanceId: string): Promise<any> {
        await pool.query('DELETE FROM company_instances WHERE instance_key = $1', [instanceId]);
        return { success: true };
    }

    async getQRCode(instanceId: string): Promise<string | null> {
        return null; // Official API doesn't use QR codes
    }

    async getStatus(instanceId: string): Promise<string> {
        const res = await pool.query('SELECT status FROM company_instances WHERE instance_key = $1', [instanceId]);
        return res.rows[0]?.status || 'disconnected';
    }
}
