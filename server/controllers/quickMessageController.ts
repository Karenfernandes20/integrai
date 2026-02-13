import { Request, Response } from 'express';
import { pool } from '../db';

type QuickMessageType = 'text' | 'image' | 'audio' | 'document';

const ALLOWED_TYPES: QuickMessageType[] = ['text', 'image', 'audio', 'document'];

const normalizeKey = (raw: string) => {
    return String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9_-]/g, '');
};

const resolveCompanyId = (req: Request): number | null => {
    const user = (req as any).user;
    const explicit = Number((req.query.companyId as string) || req.body?.companyId || 0);
    if (user?.role === 'SUPERADMIN') {
        if (explicit > 0) return explicit;
        return user?.company_id ? Number(user.company_id) : null;
    }
    return user?.company_id ? Number(user.company_id) : null;
};

const ensureQuickMessagesSchema = async () => {
    if (!pool) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS quick_messages (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            shortcut_key VARCHAR(120) NOT NULL,
            type VARCHAR(20) NOT NULL CHECK (type IN ('text', 'image', 'audio', 'document')),
            content TEXT NOT NULL,
            file_name TEXT,
            created_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            UNIQUE(company_id, shortcut_key)
        );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_quick_messages_company_active ON quick_messages(company_id, is_active)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_quick_messages_key ON quick_messages(company_id, shortcut_key)');
};

export const listQuickMessages = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureQuickMessagesSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Company ID not found' });

        const q = String(req.query.q || '').trim().toLowerCase();
        const type = String(req.query.type || '').trim().toLowerCase();

        let query = `
            SELECT id, company_id as "companyId", shortcut_key as key, type, content, file_name as "fileName", created_at as "createdAt", updated_at as "updatedAt"
            FROM quick_messages
            WHERE company_id = $1 AND is_active = true
        `;
        const params: any[] = [companyId];
        let idx = 2;

        if (q) {
            query += ` AND shortcut_key LIKE $${idx}`;
            params.push(`${q}%`);
            idx += 1;
        }

        if (type && ALLOWED_TYPES.includes(type as QuickMessageType)) {
            query += ` AND type = $${idx}`;
            params.push(type);
        }

        query += ' ORDER BY shortcut_key ASC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error listing quick messages:', error);
        res.status(500).json({ error: error.message || 'Failed to list quick messages' });
    }
};

export const createQuickMessage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureQuickMessagesSchema();

        const user = (req as any).user;
        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Company ID not found' });

        const inputKey = String(req.body?.key || '');
        const key = normalizeKey(inputKey);
        const type = String(req.body?.type || '').toLowerCase() as QuickMessageType;
        const rawContent = String(req.body?.content || '').trim();

        if (!key) return res.status(400).json({ error: 'Chave inválida. Use apenas letras, números, _ e -.' });
        if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });

        let content = rawContent;
        let fileName: string | null = null;

        if (req.file) {
            fileName = req.file.originalname;
            content = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        if (type === 'text' && !content) {
            return res.status(400).json({ error: 'Conteúdo de texto é obrigatório.' });
        }

        if (type !== 'text' && !content) {
            return res.status(400).json({ error: 'Arquivo ou URL é obrigatório para este tipo.' });
        }

        const result = await pool.query(
            `INSERT INTO quick_messages (company_id, shortcut_key, type, content, file_name, created_by, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             ON CONFLICT (company_id, shortcut_key)
             DO UPDATE SET
                type = EXCLUDED.type,
                content = EXCLUDED.content,
                file_name = EXCLUDED.file_name,
                updated_at = NOW(),
                is_active = true
             RETURNING id, company_id as "companyId", shortcut_key as key, type, content, file_name as "fileName", created_at as "createdAt", updated_at as "updatedAt"`,
            [companyId, key, type, content, fileName, user?.id || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Error creating quick message:', error);
        res.status(500).json({ error: error.message || 'Failed to create quick message' });
    }
};

export const updateQuickMessage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureQuickMessagesSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Company ID not found' });

        const { id } = req.params;
        const keyInput = req.body?.key;
        const typeInput = req.body?.type;
        const contentInput = req.body?.content;

        const currentRes = await pool.query(
            'SELECT * FROM quick_messages WHERE id = $1 AND company_id = $2 AND is_active = true',
            [id, companyId]
        );
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Mensagem rápida não encontrada.' });

        const current = currentRes.rows[0];
        const nextKey = keyInput !== undefined ? normalizeKey(String(keyInput)) : current.shortcut_key;
        const nextType = typeInput !== undefined ? String(typeInput).toLowerCase() : current.type;

        if (!nextKey) return res.status(400).json({ error: 'Chave inválida.' });
        if (!ALLOWED_TYPES.includes(nextType as QuickMessageType)) return res.status(400).json({ error: 'Tipo inválido.' });

        let nextContent = contentInput !== undefined ? String(contentInput).trim() : current.content;
        let nextFileName = current.file_name;

        if (req.file) {
            nextContent = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            nextFileName = req.file.originalname;
        }

        if (nextType === 'text' && !nextContent) return res.status(400).json({ error: 'Conteúdo de texto é obrigatório.' });
        if (nextType !== 'text' && !nextContent) return res.status(400).json({ error: 'Arquivo ou URL é obrigatório para este tipo.' });

        const updateRes = await pool.query(
            `UPDATE quick_messages
             SET shortcut_key = $1,
                 type = $2,
                 content = $3,
                 file_name = $4,
                 updated_at = NOW()
             WHERE id = $5 AND company_id = $6
             RETURNING id, company_id as "companyId", shortcut_key as key, type, content, file_name as "fileName", created_at as "createdAt", updated_at as "updatedAt"`,
            [nextKey, nextType, nextContent, nextFileName, id, companyId]
        );

        res.json(updateRes.rows[0]);
    } catch (error: any) {
        if (error?.code === '23505') {
            return res.status(409).json({ error: 'Já existe uma mensagem rápida com esta chave.' });
        }
        console.error('Error updating quick message:', error);
        res.status(500).json({ error: error.message || 'Failed to update quick message' });
    }
};

export const deleteQuickMessage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureQuickMessagesSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(403).json({ error: 'Company ID not found' });

        const { id } = req.params;

        await pool.query(
            'UPDATE quick_messages SET is_active = false, updated_at = NOW() WHERE id = $1 AND company_id = $2',
            [id, companyId]
        );

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting quick message:', error);
        res.status(500).json({ error: error.message || 'Failed to delete quick message' });
    }
};
