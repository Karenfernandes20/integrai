import { Request, Response } from 'express';
import { pool } from '../db';

type ReasonType = 'positivo' | 'negativo' | 'neutro';

export const ensureClosingReasonSchema = async () => {
    if (!pool) return;

    await pool.query(`
        CREATE TABLE IF NOT EXISTS closing_reasons (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            category TEXT,
            type VARCHAR(20) NOT NULL DEFAULT 'neutro' CHECK (type IN ('positivo', 'negativo', 'neutro')),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(company_id, name)
        );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_closing_reasons_company_active ON closing_reasons(company_id, is_active);`);

    await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS closing_reason_id INTEGER REFERENCES closing_reasons(id) ON DELETE SET NULL;`);
    await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS closing_observation TEXT;`);
    await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS closed_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_closing_reason ON whatsapp_conversations(closing_reason_id);`);
};

const resolveCompanyId = (req: Request): number | null => {
    const user = (req as any).user;
    const companyIdFromQuery = Number(req.query.companyId || req.body?.companyId || 0);
    if (user?.role === 'SUPERADMIN') {
        return companyIdFromQuery || Number(user?.company_id || 0) || null;
    }
    return Number(user?.company_id || 0) || null;
};

const normalizeType = (value: any): ReasonType => {
    const v = String(value || '').toLowerCase().trim();
    if (v === 'positivo' || v === 'negativo' || v === 'neutro') return v;
    if (v === 'positive') return 'positivo';
    if (v === 'negative') return 'negativo';
    return 'neutro';
};

export const listClosingReasons = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureClosingReasonSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ error: 'Company ID not found' });

        const onlyActive = String(req.query.onlyActive || 'true') !== 'false';

        let result = await pool.query(
            `SELECT id, company_id as "companyId", name, category, type, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
             FROM closing_reasons
             WHERE company_id = $1
               AND ($2::boolean = false OR is_active = true)
             ORDER BY name ASC`,
            [companyId, onlyActive]
        );
        if (result.rows.length === 0) {
            // Seed defaults
            const defaults = [
                { name: 'Venda Concluída', category: 'Vendas', type: 'positivo' },
                { name: 'Negociação em Andamento', category: 'Vendas', type: 'neutro' },
                { name: 'Cliente Desistiu', category: 'Vendas', type: 'negativo' },
                { name: 'Dúvida Respondida', category: 'Suporte', type: 'neutro' },
                { name: 'Suporte Técnico', category: 'Suporte', type: 'neutro' },
                { name: 'Outros', category: 'Geral', type: 'neutro' }
            ];

            for (const d of defaults) {
                await pool.query(
                    `INSERT INTO closing_reasons (company_id, name, category, type, is_active) 
                     VALUES ($1, $2, $3, $4, true) 
                     ON CONFLICT (company_id, name) DO NOTHING`,
                    [companyId, d.name, d.category, d.type]
                );
            }

            // Re-fetch after seeding
            result = await pool.query(
                `SELECT id, company_id as "companyId", name, category, type, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
                 FROM closing_reasons
                 WHERE company_id = $1
                   AND ($2::boolean = false OR is_active = true)
                 ORDER BY name ASC`,
                [companyId, onlyActive]
            );
        }

        res.json(result.rows);
    } catch (error: any) {
        console.error('Error listing closing reasons:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createClosingReason = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureClosingReasonSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ error: 'Company ID not found' });

        const name = String(req.body?.name || '').trim();
        const category = String(req.body?.category || '').trim() || null;
        const type = normalizeType(req.body?.type);
        const isActive = req.body?.isActive !== false;

        if (!name) return res.status(400).json({ error: 'Nome do motivo é obrigatório' });

        const result = await pool.query(
            `INSERT INTO closing_reasons (company_id, name, category, type, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (company_id, name)
             DO UPDATE SET category = EXCLUDED.category, type = EXCLUDED.type, is_active = EXCLUDED.is_active, updated_at = NOW()
             RETURNING id, company_id as "companyId", name, category, type, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
            [companyId, name, category, type, isActive]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Error creating closing reason:', error);
        res.status(500).json({ error: error.message });
    }
};

export const updateClosingReason = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureClosingReasonSchema();

        const companyId = resolveCompanyId(req);
        const { id } = req.params;
        if (!companyId) return res.status(400).json({ error: 'Company ID not found' });

        const currentRes = await pool.query('SELECT * FROM closing_reasons WHERE id = $1 AND company_id = $2', [id, companyId]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Motivo não encontrado' });

        const current = currentRes.rows[0];
        const name = req.body?.name !== undefined ? String(req.body.name || '').trim() : current.name;
        const category = req.body?.category !== undefined ? (String(req.body.category || '').trim() || null) : current.category;
        const type = req.body?.type !== undefined ? normalizeType(req.body.type) : current.type;
        const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : current.is_active;

        if (!name) return res.status(400).json({ error: 'Nome do motivo é obrigatório' });

        const result = await pool.query(
            `UPDATE closing_reasons
             SET name = $1, category = $2, type = $3, is_active = $4, updated_at = NOW()
             WHERE id = $5 AND company_id = $6
             RETURNING id, company_id as "companyId", name, category, type, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
            [name, category, type, isActive, id, companyId]
        );

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Error updating closing reason:', error);
        if (error?.code === '23505') {
            return res.status(409).json({ error: 'Já existe um motivo com este nome' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const deleteClosingReason = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureClosingReasonSchema();

        const companyId = resolveCompanyId(req);
        const { id } = req.params;
        if (!companyId) return res.status(400).json({ error: 'Company ID not found' });

        await pool.query('UPDATE closing_reasons SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2', [id, companyId]);
        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting closing reason:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getClosingReasonsAnalytics = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureClosingReasonSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ error: 'Company ID not found' });

        const { startDate, endDate, userId, reasonId, category } = req.query as any;

        const params: any[] = [companyId];
        let where = 'WHERE c.company_id = $1 AND c.status = \'CLOSED\' AND c.closed_at IS NOT NULL';

        if (startDate) {
            params.push(startDate);
            where += ` AND c.closed_at::date >= $${params.length}::date`;
        }
        if (endDate) {
            params.push(endDate);
            where += ` AND c.closed_at::date <= $${params.length}::date`;
        }
        if (userId) {
            params.push(Number(userId));
            where += ` AND c.closed_by_user_id = $${params.length}`;
        }
        if (reasonId) {
            params.push(Number(reasonId));
            where += ` AND c.closing_reason_id = $${params.length}`;
        }
        if (category) {
            params.push(String(category));
            where += ` AND r.category = $${params.length}`;
        }

        const byReason = await pool.query(`
            SELECT r.id, r.name, r.category, r.type, COUNT(*)::int as total
            FROM whatsapp_conversations c
            JOIN closing_reasons r ON r.id = c.closing_reason_id
            ${where}
            GROUP BY r.id, r.name, r.category, r.type
            ORDER BY total DESC
        `, params);

        const byCategory = await pool.query(`
            SELECT COALESCE(r.category, 'Outros') as category, COUNT(*)::int as total
            FROM whatsapp_conversations c
            JOIN closing_reasons r ON r.id = c.closing_reason_id
            ${where}
            GROUP BY COALESCE(r.category, 'Outros')
            ORDER BY total DESC
        `, params);

        const typeSummary = await pool.query(`
            SELECT r.type, COUNT(*)::int as total
            FROM whatsapp_conversations c
            JOIN closing_reasons r ON r.id = c.closing_reason_id
            ${where}
            GROUP BY r.type
        `, params);

        const byUser = await pool.query(`
            SELECT 
                u.id as user_id,
                u.full_name as user_name,
                COUNT(*)::int as total_closures,
                SUM(CASE WHEN r.type = 'positivo' THEN 1 ELSE 0 END)::int as positive,
                SUM(CASE WHEN r.type = 'negativo' THEN 1 ELSE 0 END)::int as negative,
                ROUND(
                    (SUM(CASE WHEN r.type = 'positivo' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100,
                    2
                ) as conversion
            FROM whatsapp_conversations c
            JOIN closing_reasons r ON r.id = c.closing_reason_id
            LEFT JOIN app_users u ON u.id = c.closed_by_user_id
            ${where}
            GROUP BY u.id, u.full_name
            ORDER BY positive DESC, total_closures DESC
        `, params);

        const totals = typeSummary.rows.reduce((acc: any, row: any) => {
            acc.total += Number(row.total || 0);
            acc[row.type] = Number(row.total || 0);
            return acc;
        }, { total: 0, positivo: 0, negativo: 0, neutro: 0 });

        const positivePct = totals.total ? Number(((totals.positivo / totals.total) * 100).toFixed(2)) : 0;
        const negativePct = totals.total ? Number(((totals.negativo / totals.total) * 100).toFixed(2)) : 0;
        const neutralPct = totals.total ? Number(((totals.neutro / totals.total) * 100).toFixed(2)) : 0;

        return res.json({
            summary: {
                totalClosures: totals.total,
                positive: totals.positivo,
                negative: totals.negativo,
                neutral: totals.neutro,
                positivePct,
                negativePct,
                neutralPct
            },
            byReason: byReason.rows,
            byCategory: byCategory.rows,
            byUser: byUser.rows
        });
    } catch (error: any) {
        console.error('Error in closing reasons analytics:', error);
        res.status(500).json({ error: error.message });
    }
};
