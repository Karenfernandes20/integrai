import { Request, Response } from 'express';
import { pool } from '../db';
import { logEvent } from '../logger';
import { logAudit } from '../auditLogger';

import { checkLimit } from '../services/limitService';

export const getAiAgents = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        const companyId = user?.company_id;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        let query = 'SELECT * FROM ai_agents';
        const params: any[] = [];

        if (!isSuperAdmin) {
            query += ' WHERE company_id = $1 OR company_id IS NULL';
            params.push(companyId);
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[getAiAgents] Error:', error);
        res.status(500).json({ error: 'Failed to fetch AI agents' });
    }
};

export const updateAgentStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        if (!['active', 'paused'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Access Control
        const check = await pool!.query('SELECT company_id FROM ai_agents WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

        if (!isSuperAdmin && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Limit Check
        if (status === 'active' && user.company_id) {
            const allowed = await checkLimit(user.company_id, 'ai_agents');
            if (!allowed) {
                return res.status(403).json({ error: 'Limite de Agentes de IA ativos atingido para este plano.' });
            }
        }

        const result = await pool!.query(
            'UPDATE ai_agents SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, id]
        );

        const updated = result.rows[0];

        // Audit Log
        await logAudit({
            userId: user.id,
            companyId: user.company_id,
            action: 'update',
            resourceType: 'ai_agent',
            resourceId: id,
            newValues: { status },
            details: `Alterou status do agente ${updated.name} para ${status}`
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status' });
    }
};

export const updateAgentPrompt = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { prompt } = req.body;
        const user = (req as any).user;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        // Access Control
        const check = await pool!.query('SELECT company_id FROM ai_agents WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

        if (!isSuperAdmin && check.rows[0].company_id !== user.company_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await pool!.query(
            'UPDATE ai_agents SET prompt = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [prompt, id]
        );

        const updated = result.rows[0];

        // Audit Log
        await logAudit({
            userId: user.id,
            companyId: user.company_id,
            action: 'update',
            resourceType: 'ai_agent',
            resourceId: id,
            newValues: { prompt },
            details: `Atualizou o prompt do agente ${updated.name}`
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update prompt' });
    }
};

export const getAiHistory = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user?.company_id;
        const isSuperAdmin = user?.role === 'SUPERADMIN';

        let query = `
            SELECT m.*, c.contact_name, c.phone 
            FROM whatsapp_messages m
            JOIN whatsapp_conversations c ON m.conversation_id = c.id
            WHERE m.direction = 'outbound' AND m.user_id IS NULL
        `;
        const params: any[] = [];

        if (!isSuperAdmin) {
            query += ' AND c.company_id = $1';
            params.push(companyId);
        }

        query += ' ORDER BY m.sent_at DESC LIMIT 50';

        const result = await pool!.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
};

export const testAiAgent = async (req: Request, res: Response) => {
    try {
        const { message, prompt } = req.body;

        // Simulating AI response for testing
        // In a real scenario, this would call OpenAI/Anthropic API
        const responses = [
            "Olá! Como posso ajudar você hoje?",
            "Perfeito, entendi sua solicitação. Vou verificar isso agora.",
            "Desculpe, não entendi muito bem. Poderia repetir?",
            "Esta é uma resposta automática gerada por mim, sua IA assistente."
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];

        // Simulate thinking delay
        await new Promise(r => setTimeout(r, 1500));

        res.json({ response });
    } catch (error) {
        res.status(500).json({ error: 'AI Test failed' });
    }
};
