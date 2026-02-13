import { Request, Response } from 'express';
import { pool } from '../db';

const DEFAULT_QUEUE_NAME = 'Recepção';

export const ensureQueueSchema = async () => {
    if (!pool) return;

    await pool.query(`
        CREATE TABLE IF NOT EXISTS queues (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            color TEXT DEFAULT '#3b82f6',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(company_id, name)
        );
    `);

    await pool.query(`ALTER TABLE queues ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';`);
    await pool.query(`ALTER TABLE queues ADD COLUMN IF NOT EXISTS greeting_message TEXT;`);
    await pool.query(`ALTER TABLE queues ADD COLUMN IF NOT EXISTS out_of_hours_message TEXT;`);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_queues_company_active ON queues(company_id, is_active);`);

    await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS queue_id INTEGER REFERENCES queues(id) ON DELETE SET NULL;`);
    await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;`);
    await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS opened_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_queue_id ON whatsapp_conversations(queue_id);`);

    await pool.query(`
        INSERT INTO queues (company_id, name, is_active)
        SELECT id, $1, true
        FROM companies
        ON CONFLICT (company_id, name) DO NOTHING;
    `, [DEFAULT_QUEUE_NAME]);

    await pool.query(`
        UPDATE whatsapp_conversations c
        SET queue_id = q.id
        FROM queues q
        WHERE c.queue_id IS NULL
          AND c.company_id = q.company_id
          AND q.name = $1;
    `, [DEFAULT_QUEUE_NAME]);
};

export const getOrCreateQueueId = async (companyId: number, name: string = DEFAULT_QUEUE_NAME): Promise<number | null> => {
    if (!pool || !companyId) return null;
    await ensureQueueSchema();

    const normalizedName = String(name || DEFAULT_QUEUE_NAME).trim() || DEFAULT_QUEUE_NAME;
    const result = await pool.query(
        `INSERT INTO queues (company_id, name, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (company_id, name)
         DO UPDATE SET is_active = true
         RETURNING id`,
        [companyId, normalizedName]
    );
    return result.rows[0]?.id || null;
};

export const assignQueueToConversationByPhone = async (
    companyId: number,
    instanceKey: string,
    contactPhone: string,
    queueName: string
) => {
    if (!pool || !companyId || !contactPhone) return;
    await ensureQueueSchema();

    const queueId = await getOrCreateQueueId(companyId, queueName);
    if (!queueId) return;

    const digits = String(contactPhone).replace(/\D/g, '');
    const externalId = `${digits}@s.whatsapp.net`;

    await pool.query(
        `UPDATE whatsapp_conversations
         SET queue_id = $1
         WHERE id = (
             SELECT id
             FROM whatsapp_conversations
             WHERE company_id = $2
               AND (instance = $3 OR last_instance_key = $3)
               AND (
                   external_id = $4
                   OR phone = $5
                   OR regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = $5
               )
             ORDER BY last_message_at DESC NULLS LAST, created_at DESC
             LIMIT 1
         )`,
        [queueId, companyId, instanceKey, externalId, digits]
    );
};

const resolveCompanyId = (req: Request): number | null => {
    const user = (req as any).user;
    const companyIdFromQuery = Number(req.query.companyId || req.body?.companyId || 0);
    if (user?.role === 'SUPERADMIN') {
        return companyIdFromQuery || Number(user?.company_id || 0) || null;
    }
    return Number(user?.company_id || 0) || null;
};

export const listQueues = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureQueueSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ error: 'Company ID not found' });

        const result = await pool.query(
            `SELECT id, company_id as "companyId", name, is_active as "isActive", 
                    greeting_message as "greetingMessage", out_of_hours_message as "outOfHoursMessage",
                    color, created_at as "createdAt"
             FROM queues
             WHERE company_id = $1
             ORDER BY name ASC`,
            [companyId]
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error listing queues:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createQueue = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });
        await ensureQueueSchema();

        const companyId = resolveCompanyId(req);
        if (!companyId) return res.status(400).json({ error: 'Company ID not found' });

        const { name, greetingMessage, color } = req.body;
        if (!name) return res.status(400).json({ error: 'Nome da fila é obrigatório' });

        const result = await pool.query(
            `INSERT INTO queues (company_id, name, greeting_message, color, is_active)
             VALUES ($1, $2, $3, $4, true)
             RETURNING id, company_id as "companyId", name, is_active as "isActive", 
                       greeting_message as "greetingMessage", color, created_at as "createdAt"`,
            [companyId, name, greetingMessage, color || '#3b82f6']
        );
        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Error creating queue:', error);
        res.status(500).json({ error: error.message });
    }
};

export const updateQueue = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, greetingMessage, color, isActive } = req.body;

        const result = await pool!.query(
            `UPDATE queues 
             SET name = COALESCE($1, name), 
                 greeting_message = $2, 
                 color = COALESCE($3, color),
                 is_active = COALESCE($4, is_active)
             WHERE id = $5 
             RETURNING id, name, is_active as "isActive", greeting_message as "greetingMessage", color`,
            [name, greetingMessage, color, isActive, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Queue not found' });
        res.json(result.rows[0]);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteQueue = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await pool!.query('DELETE FROM queues WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
