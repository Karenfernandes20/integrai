import { Request, Response } from 'express';
import { pool } from '../db';

export const getCities = async (_req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const result = await pool.query(
      'SELECT id, name, state, color_hex, is_active, created_at FROM cities ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
};

export const createCity = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { name, state, color_hex } = req.body;

    if (!name || !state) {
      return res.status(400).json({ error: 'name and state are required' });
    }

    const result = await pool.query(
      'INSERT INTO cities (name, state, color_hex, is_active) VALUES ($1, $2, $3, TRUE) RETURNING id, name, state, color_hex, is_active, created_at',
      [name, state.toUpperCase(), color_hex || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ error: 'Failed to create city' });
  }
};
