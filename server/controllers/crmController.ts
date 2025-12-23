import { Request, Response } from 'express';
import { pool } from '../db';

// Ensure default stages exist
const ensureDefaultStages = async () => {
    if (!pool) return;
    const countResult = await pool.query('SELECT COUNT(*) FROM crm_stages');
    if (parseInt(countResult.rows[0].count) === 0) {
        const defaultStages = [
            { name: 'Leads', position: 1 },
            { name: 'Em contato', position: 2 },
            { name: 'Agendamento', position: 3 },
            { name: 'Venda realizada', position: 4 },
            { name: 'Perdido', position: 5 }
        ];

        for (const stage of defaultStages) {
            await pool.query('INSERT INTO crm_stages (name, position) VALUES ($1, $2)', [stage.name, stage.position]);
        }
    }
};

export const getStages = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        await ensureDefaultStages();

        const result = await pool.query('SELECT * FROM crm_stages ORDER BY position ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching stages:', error);
        res.status(500).json({ error: 'Failed to fetch stages' });
    }
};

export const getLeads = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const result = await pool.query(`
            SELECT l.*, s.name as stage_name, s.position as stage_position 
            FROM crm_leads l
            LEFT JOIN crm_stages s ON l.stage_id = s.id
            ORDER BY l.updated_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
};

export const updateLeadStage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const { stageId } = req.body; // Expecting stage_id (integer) OR stageId (integer)

        if (!stageId) {
            return res.status(400).json({ error: 'stageId is required' });
        }

        const result = await pool.query(
            'UPDATE crm_leads SET stage_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [stageId, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating lead stage:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
};

export const createStage = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }

        // Define próxima posição após a última fase existente
        const posResult = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM crm_stages');
        const nextPos = posResult.rows[0].next_pos as number;

        const insertResult = await pool.query(
            'INSERT INTO crm_stages (name, position) VALUES ($1, $2) RETURNING *',
            [name.trim(), nextPos]
        );

        res.status(201).json(insertResult.rows[0]);
    } catch (error) {
        console.error('Error creating stage:', error);
        res.status(500).json({ error: 'Failed to create stage' });
    }
};
