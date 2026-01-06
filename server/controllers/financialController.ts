import { Request, Response } from 'express';
import { pool } from '../db';

export const getTransactions = async (req: Request, res: Response, forcedType?: string) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { startDate, endDate, status, category, search } = req.query as any;
    const type = forcedType || (req.query as any).type;
    const conditions: string[] = [];
    const params: any[] = [];

    const user = (req as any).user;
    const companyId = user?.company_id;

    if (type && type !== 'all') {
      params.push(type);
      conditions.push(`ft.type = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`ft.due_date >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`ft.due_date <= $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`ft.status = $${params.length}`);
    }

    if (category && category !== 'all') {
      params.push(category);
      conditions.push(`ft.category = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(ft.description ILIKE $${params.length} OR ft.category ILIKE $${params.length} OR ft.notes ILIKE $${params.length})`);
    }

    // Strict company filter - show ONLY this company's data
    if (companyId) {
      params.push(companyId);
      conditions.push(`ft.company_id = $${params.length}`);
    } else if (user.role !== 'SUPERADMIN') {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT ft.*,
             c.name as city_name, c.state as city_state
      FROM financial_transactions ft
      LEFT JOIN cities c ON ft.city_id = c.id
      ${whereClause}
      ORDER BY ft.due_date NULLS LAST, ft.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// Keep old names for compatibility if needed, or update routes
export const getPayables = (req: Request, res: Response) => {
  return getTransactions(req, res, 'payable');
};

export const getReceivables = (req: Request, res: Response) => {
  return getTransactions(req, res, 'receivable');
};

export const getFinancialStats = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const { startDate, endDate } = req.query;
    const params: any[] = [];
    const user = (req as any).user;
    const companyId = user?.company_id;

    let dateFilter = '';
    if (startDate && endDate) {
      params.push(startDate, endDate);
      dateFilter = `AND due_date BETWEEN $1 AND $2`;
    }

    let companyFilter = '';
    if (companyId) {
      params.push(companyId);
      companyFilter = `AND company_id = $${params.length}`;
    } else if (user.role !== 'SUPERADMIN') {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const query = `
      SELECT 
        SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END) as total_receivables,
        SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END) as total_payables,
        SUM(CASE WHEN type = 'receivable' AND status = 'paid' THEN amount ELSE 0 END) as received_amount,
        SUM(CASE WHEN type = 'payable' AND status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN type = 'receivable' AND status = 'pending' THEN amount ELSE 0 END) as pending_receivables,
        SUM(CASE WHEN type = 'payable' AND status = 'pending' THEN amount ELSE 0 END) as pending_payables,
        SUM(CASE WHEN status != 'paid' AND due_date < CURRENT_DATE THEN amount ELSE 0 END) as total_overdue
      FROM financial_transactions
      WHERE status != 'cancelled' ${dateFilter} ${companyFilter}
    `;

    const result = await pool.query(query, params);
    const stats = result.rows[0];

    res.json({
      revenues: Number(stats.total_receivables || 0),
      expenses: Number(stats.total_payables || 0),
      balance: Number(stats.total_receivables || 0) - Number(stats.total_payables || 0),
      receivables: Number(stats.pending_receivables || 0),
      payables: Number(stats.pending_payables || 0),
      overdue: Number(stats.total_overdue || 0),
      received: Number(stats.received_amount || 0),
      paid: Number(stats.paid_amount || 0)
    });
  } catch (error) {
    console.error('Error fetching financial stats:', error);
    res.status(500).json({ error: 'Failed to fetch financial stats' });
  }
};

export const getReceivablesByCity = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const user = (req as any).user;
    const companyId = user?.company_id;

    let companyFilter = '';
    const params: any[] = [];
    if (companyId) {
      params.push(companyId);
      companyFilter = `AND ft.company_id = $${params.length}`;
    } else if (user.role !== 'SUPERADMIN') {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const query = `
      SELECT COALESCE(c.name, 'Sem cidade') as city_name,
             COALESCE(c.state, '--') as city_state,
             SUM(ft.amount) as total_amount
      FROM financial_transactions ft
      LEFT JOIN cities c ON ft.city_id = c.id
      WHERE ft.type = 'receivable' ${companyFilter}
      GROUP BY c.name, c.state
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query, params);
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

    const user = (req as any).user;
    const companyId = user?.company_id;

    if (startDate) {
      params.push(startDate);
      conditions.push(`due_date >= $${params.length}`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`due_date <= $${params.length}`);
    }

    if (companyId) {
      params.push(companyId);
      conditions.push(`company_id = $${params.length}`);
    } else if (user.role !== 'SUPERADMIN') {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT ft.*,
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

export const createFinancialTransaction = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });

    const user = (req as any).user;
    const userCompanyId = user?.company_id;

    const { description, amount, due_date, issue_date, category, status, type, city_id, notes, company_id, cost_center } = req.body;

    if (!description || !amount) {
      return res.status(400).json({ error: 'description and amount are required' });
    }

    // New transaction should be associated with user's company if provided, or default to user context
    const finalCompanyId = company_id || userCompanyId;

    const result = await pool.query(
      `INSERT INTO financial_transactions (description, type, amount, status, due_date, issue_date, category, city_id, notes, company_id, cost_center)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        description,
        type || 'payable',
        amount,
        status || 'pending',
        (due_date && due_date !== "") ? due_date : null,
        (issue_date && issue_date !== "") ? issue_date : new Date(),
        category || null,
        (city_id && city_id !== "") ? city_id : null,
        notes || null,
        (finalCompanyId && finalCompanyId !== "" && finalCompanyId !== 0) ? finalCompanyId : null,
        cost_center || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction', details: error.message });
  }
};

export const updateFinancialTransaction = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const user = (req as any).user;
    const userCompanyId = user?.company_id;
    const { id } = req.params;
    const { description, amount, due_date, issue_date, category, status, type, city_id, notes, company_id, cost_center } = req.body;

    // Check ownership
    const check = await pool.query('SELECT company_id FROM financial_transactions WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    if (user.role !== 'SUPERADMIN' && check.rows[0].company_id && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const result = await pool.query(
      `UPDATE financial_transactions 
             SET description = $1, amount = $2, due_date = $3, issue_date = $4, category = $5, status = $6, type = $7, city_id = $8, notes = $9, company_id = $10, cost_center = $11, updated_at = NOW()
             WHERE id = $12
             RETURNING *`,
      [
        description,
        amount,
        (due_date && due_date !== "") ? due_date : null,
        (issue_date && issue_date !== "") ? issue_date : null,
        category || null,
        status,
        type,
        (city_id && city_id !== "") ? city_id : null,
        notes || null,
        (company_id && company_id !== "" && company_id !== 0) ? company_id : userCompanyId,
        cost_center || null,
        id
      ]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction', details: error.message });
  }
};

export const deleteFinancialTransaction = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const user = (req as any).user;
    const userCompanyId = user?.company_id;
    const { id } = req.params;

    // Check ownership
    const check = await pool.query('SELECT company_id, status FROM financial_transactions WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    if (user.role !== 'SUPERADMIN' && check.rows[0].company_id && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // SOFT DELETE: Mark as excluded instead of deleting
    await pool.query("UPDATE financial_transactions SET status = 'excluded', updated_at = NOW() WHERE id = $1", [id]);
    res.json({ message: 'Transaction marked as excluded' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};

export const reactivateFinancialTransaction = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const user = (req as any).user;
    const userCompanyId = user?.company_id;
    const { id } = req.params;

    // Check ownership
    const check = await pool.query('SELECT company_id, paid_at FROM financial_transactions WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    if (user.role !== 'SUPERADMIN' && check.rows[0].company_id && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Determine status: if paid_at exists, go to paid, else pending
    const newStatus = check.rows[0].paid_at ? 'paid' : 'pending';

    const result = await pool.query(
      `UPDATE financial_transactions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error reactivating transaction:', error);
    res.status(500).json({ error: 'Failed to reactivate' });
  }
};

export const markAsPaid = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const user = (req as any).user;
    const userCompanyId = user?.company_id;
    const { id } = req.params;

    // Check ownership
    const check = await pool.query('SELECT company_id FROM financial_transactions WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    if (user.role !== 'SUPERADMIN' && check.rows[0].company_id && check.rows[0].company_id !== userCompanyId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const result = await pool.query(
      `UPDATE financial_transactions 
             SET status = 'paid', paid_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking as paid:', error);
    res.status(500).json({ error: 'Failed to mark as paid' });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const user = (req as any).user;
    const companyId = user?.company_id;

    // For SuperAdmin without company_id, maybe return empty or all? Assuming company context is usually set.
    if (!companyId && user.role !== 'SUPERADMIN') {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    // Select custom categories for this company
    const query = companyId
      ? 'SELECT * FROM financial_categories WHERE company_id = $1 ORDER BY name ASC'
      : 'SELECT * FROM financial_categories ORDER BY name ASC'; // Admin sees all?

    const params = companyId ? [companyId] : [];

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    // If table doesn't exist, return empty list gracefully to avoid breaking frontend
    res.json([]);
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const user = (req as any).user;
    const companyId = user?.company_id;
    const { name, type } = req.body;

    if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });
    if (!companyId) return res.status(400).json({ error: 'Company ID required' });

    const result = await pool.query(
      'INSERT INTO financial_categories (company_id, name, type) VALUES ($1, $2, $3) RETURNING *',
      [companyId, name, type]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category: ' + error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const { id } = req.params;
    const user = (req as any).user;

    // Basic ownership check ideally
    await pool.query('DELETE FROM financial_categories WHERE id = $1', [id]);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
