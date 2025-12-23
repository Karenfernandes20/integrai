import { Request, Response } from 'express';
import { pool } from '../db';

export const getPayables = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { startDate, endDate } = req.query;
    const conditions: string[] = ["type = 'payable'"];
    const params: any[] = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`due_date >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`due_date <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT ft.id, ft.description, ft.amount, ft.status, ft.due_date,
             c.name as city_name, c.state as city_state
      FROM financial_transactions ft
      LEFT JOIN cities c ON ft.city_id = c.id
      ${whereClause}
      ORDER BY ft.due_date NULLS LAST, ft.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payables:', error);
    res.status(500).json({ error: 'Failed to fetch payables' });
  }
};

export const getReceivablesByCity = async (_req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const query = `
      SELECT COALESCE(c.name, 'Sem cidade') as city_name,
             COALESCE(c.state, '--') as city_state,
             SUM(ft.amount) as total_amount
      FROM financial_transactions ft
      LEFT JOIN cities c ON ft.city_id = c.id
      WHERE ft.type = 'receivable'
      GROUP BY c.name, c.state
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching receivables by city:', error);
    res.status(500).json({ error: 'Failed to fetch receivables by city' });
  }
};

export const getCashFlow = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { startDate, endDate } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`due_date >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`due_date <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT ft.id,
             ft.description,
             ft.amount,
             ft.type,
             ft.status,
             ft.due_date,
             c.name as city_name,
             c.state as city_state
      FROM financial_transactions ft
      LEFT JOIN cities c ON ft.city_id = c.id
      ${whereClause}
      ORDER BY ft.due_date NULLS LAST, ft.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cash flow:', error);
    res.status(500).json({ error: 'Failed to fetch cash flow' });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { description, amount, due_date, city_id } = req.body;

    if (!description || !amount || !due_date) {
      return res.status(400).json({ error: 'description, amount and due_date are required' });
    }

    const result = await pool.query(
      `INSERT INTO financial_transactions (description, type, amount, status, due_date, city_id)
       VALUES ($1, 'payable', $2, 'pending', $3, $4)
       RETURNING id, description, amount, status, due_date` ,
      [description, amount, due_date, city_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};
