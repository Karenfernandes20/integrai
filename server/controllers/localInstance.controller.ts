import { Request, Response } from 'express';
import { InstanceManager } from '../services/strategies/instanceManager.js';

export class LocalInstanceController {
    async create(req: Request, res: Response) {
        const { instanceId } = req.body;
        const companyId = (req as any).user.company_id;
        const io = req.app.get('io');

        if (!instanceId) {
            return res.status(400).json({ error: 'instanceId is required' });
        }

        try {
            await InstanceManager.createInstance('local', instanceId, companyId, io);
            res.json({ success: true, message: 'Instance initialization started' });
        } catch (e: any) {
            console.error('[createLocalInstance] Error:', e);
            res.status(500).json({ error: e.message });
        }
    }

    async getQRCode(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const qr = await InstanceManager.getQRCode('local', id);

            if (qr === 'IS_CONNECTED') {
                return res.json({ status: 'connected', message: 'Instance is already connected' });
            }

            if (qr === 'IS_CONNECTING') {
                return res.json({ status: 'connecting', message: 'Warming up instance, please wait...' });
            }

            if (!qr) {
                return res.status(404).json({ error: 'QR Code not available' });
            }
            res.json({ qr });
        } catch (e: any) {
            console.error(`[LocalInstanceController] Error getting QR for ${id}:`, e);
            res.status(500).json({ error: e.message });
        }
    }

    async getStatus(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const status = await InstanceManager.getStatus('local', id);
            res.json({ status });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    async delete(req: Request, res: Response) {
        const { id } = req.params;
        try {
            await InstanceManager.deleteInstance('local', id);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    async disconnect(req: Request, res: Response) {
        const { id } = req.params;
        try {
            await InstanceManager.disconnectInstance('local', id);
            res.json({ success: true, message: 'Instância desconectada com sucesso.' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
}

export default new LocalInstanceController();
