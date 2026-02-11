import { Request, Response } from 'express';
import { pool } from '../db';

const assertCompanyAccess = async (req: Request, companyId: number) => {
  const user = (req as any).user;
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };

  if (user.role === 'SUPERADMIN') return { ok: true };
  if (!user.company_id || Number(user.company_id) !== Number(companyId)) {
    return { ok: false, status: 403, error: 'Acesso negado para esta empresa.' };
  }

  return { ok: true };
};

export const listCompanyQueues = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const companyId = Number(req.params.id);
    if (!companyId) return res.status(400).json({ error: 'companyId inválido' });

    const access = await assertCompanyAccess(req, companyId);
    if (!access.ok) return res.status(access.status!).json({ error: access.error });

    const result = await pool.query(
      `SELECT id, company_id, name, color, is_active, created_at, updated_at
       FROM company_queues
       WHERE company_id = $1
       ORDER BY name ASC`,
      [companyId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('[listCompanyQueues] Error:', error);
    return res.status(500).json({ error: 'Falha ao carregar filas' });
  }
};

export const createCompanyQueue = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const companyId = Number(req.params.id);
    const name = String(req.body?.name || '').trim();
    const color = String(req.body?.color || '#3B82F6').trim();
    const isActive = req.body?.is_active !== undefined ? Boolean(req.body.is_active) : true;

    if (!companyId) return res.status(400).json({ error: 'companyId inválido' });
    if (!name) return res.status(400).json({ error: 'Nome da fila é obrigatório.' });

    const access = await assertCompanyAccess(req, companyId);
    if (!access.ok) return res.status(access.status!).json({ error: access.error });

    const exists = await pool.query(
      `SELECT id FROM company_queues WHERE company_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
      [companyId, name]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Já existe uma fila com este nome para esta empresa.' });
    }

    const result = await pool.query(
      `INSERT INTO company_queues (company_id, name, color, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, company_id, name, color, is_active, created_at, updated_at`,
      [companyId, name, color, isActive]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[createCompanyQueue] Error:', error);
    return res.status(500).json({ error: 'Falha ao criar fila' });
  }
};

export const updateCompanyQueue = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const companyId = Number(req.params.id);
    const queueId = Number(req.params.queueId);
    const name = String(req.body?.name || '').trim();
    const color = String(req.body?.color || '#3B82F6').trim();
    const isActive = req.body?.is_active !== undefined ? Boolean(req.body.is_active) : true;

    if (!companyId || !queueId) return res.status(400).json({ error: 'Parâmetros inválidos' });
    if (!name) return res.status(400).json({ error: 'Nome da fila é obrigatório.' });

    const access = await assertCompanyAccess(req, companyId);
    if (!access.ok) return res.status(access.status!).json({ error: access.error });

    const duplicate = await pool.query(
      `SELECT id FROM company_queues
       WHERE company_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3
       LIMIT 1`,
      [companyId, name, queueId]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: 'Já existe uma fila com este nome para esta empresa.' });
    }

    const result = await pool.query(
      `UPDATE company_queues
       SET name = $1, color = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4 AND company_id = $5
       RETURNING id, company_id, name, color, is_active, created_at, updated_at`,
      [name, color, isActive, queueId, companyId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Fila não encontrada' });

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[updateCompanyQueue] Error:', error);
    return res.status(500).json({ error: 'Falha ao atualizar fila' });
  }
};

export const listActiveQueues = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const user = (req as any).user;
    const companyId = Number(req.query.companyId || user?.company_id);
    if (!companyId) return res.status(400).json({ error: 'companyId é obrigatório' });

    const access = await assertCompanyAccess(req, companyId);
    if (!access.ok) return res.status(access.status!).json({ error: access.error });

    const result = await pool.query(
      `SELECT id, company_id, name, color, is_active
       FROM company_queues
       WHERE company_id = $1 AND is_active = true
       ORDER BY name ASC`,
      [companyId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('[listActiveQueues] Error:', error);
    return res.status(500).json({ error: 'Falha ao carregar filas ativas' });
  }
};
