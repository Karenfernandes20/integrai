import { Request, Response } from 'express';
import { pool } from '../db';

export const getTasks = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { status, priority, responsible_id, search, filter } = req.query;

        let query = `
            SELECT t.*, u.full_name as responsible_name, u2.full_name as creator_name
            FROM admin_tasks t
            LEFT JOIN app_users u ON t.responsible_id = u.id
            LEFT JOIN app_users u2 ON t.created_by = u2.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (status) {
            params.push(status);
            query += ` AND t.status = $${params.length}`;
        }

        if (priority) {
            params.push(priority);
            query += ` AND t.priority = $${params.length}`;
        }

        if (responsible_id) {
            params.push(responsible_id);
            query += ` AND t.responsible_id = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`;
        }

        // Quick Filters
        if (filter === 'today') {
            query += ` AND t.due_date::date = CURRENT_DATE`;
        } else if (filter === 'week') {
            query += ` AND t.due_date::date <= CURRENT_DATE + INTERVAL '7 days' AND t.due_date::date >= CURRENT_DATE`;
        }

        // Sorting
        query += `
            ORDER BY 
                CASE WHEN t.priority = 'high' THEN 1 WHEN t.priority = 'medium' THEN 2 ELSE 3 END,
                t.due_date ASC NULLS LAST,
                t.created_at DESC
        `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
};

export const createTask = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { title, description, priority, due_date, responsible_id, company_id } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const result = await pool.query(
            `INSERT INTO admin_tasks (title, description, priority, due_date, responsible_id, company_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [title, description, priority || 'medium', due_date, responsible_id, company_id, user.id]
        );

        const newTask = result.rows[0];

        // Log history
        await pool.query(
            `INSERT INTO admin_task_history (task_id, user_id, action) VALUES ($1, $2, $3)`,
            [newTask.id, user.id, 'Tarefa criada']
        );

        res.status(201).json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
};

export const updateTask = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { id } = req.params;
        const { title, description, status, priority, due_date, responsible_id } = req.body;

        // Get current state for history comparison
        const currentRes = await pool.query('SELECT * FROM admin_tasks WHERE id = $1', [id]);
        if (currentRes.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
        const current = currentRes.rows[0];

        let completed_at = current.completed_at;
        if (status === 'completed' && current.status !== 'completed') {
            completed_at = new Date();
        } else if (status && status !== 'completed') {
            completed_at = null;
        }

        const result = await pool.query(
            `UPDATE admin_tasks 
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 status = COALESCE($3, status),
                 priority = COALESCE($4, priority),
                 due_date = COALESCE($5, due_date),
                 responsible_id = COALESCE($6, responsible_id),
                 completed_at = $7,
                 updated_at = NOW()
             WHERE id = $8 RETURNING *`,
            [title, description, status, priority, due_date, responsible_id, completed_at, id]
        );

        const updated = result.rows[0];

        // Simple history text
        const changes = [];
        if (title && title !== current.title) changes.push(`Título alterado de "${current.title}" para "${title}"`);
        if (status && status !== current.status) changes.push(`Status alterado de "${current.status}" para "${status}"`);
        if (priority && priority !== current.priority) changes.push(`Prioridade alterada de "${current.priority}" para "${priority}"`);

        if (changes.length > 0) {
            await pool.query(
                `INSERT INTO admin_task_history (task_id, user_id, action) VALUES ($1, $2, $3)`,
                [id, user.id, changes.join(', ')]
            );
        }

        res.json(updated);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
};

export const getTaskHistory = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const { id } = req.params;
        const result = await pool.query(
            `SELECT h.*, u.full_name as user_name
             FROM admin_task_history h
             LEFT JOIN app_users u ON h.user_id = u.id
             WHERE h.task_id = $1
             ORDER BY h.created_at DESC`,
            [id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching task history:', error);
        res.status(500).json({ error: 'Failed to fetch task history' });
    }
};

export const getPendingTasksCount = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user?.role !== 'SUPERADMIN') return res.json({ count: 0 });

        const result = await pool.query(
            "SELECT COUNT(*) FROM admin_tasks WHERE status != 'completed'"
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch count' });
    }
};

export const deleteTask = async (req: Request, res: Response) => {
    try {
        if (!pool) return res.status(500).json({ error: 'Database not configured' });

        const user = (req as any).user;
        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { id } = req.params;
        await pool.query('DELETE FROM admin_tasks WHERE id = $1', [id]);
        res.json({ message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete task' });
    }
};
