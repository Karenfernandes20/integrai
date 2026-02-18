
import { pool } from '../db/index.js';

export const resolveCompanyByInstanceKey = async (instanceKey: string) => {
    if (!pool || !instanceKey) return null;

    try {
        // 1. Try company_instances table (Primary Source)
        let query = `
      SELECT company_id as id, name as company_name 
      FROM company_instances 
      WHERE instance_key = $1 OR name = $1
    `;
        let res = await pool.query(query, [instanceKey]);

        if (res.rows.length > 0) {
            return res.rows[0];
        }

        // 2. Try companies table (Legacy/Single Instance)
        query = `
      SELECT id, name as company_name
      FROM companies
      WHERE evolution_instance = $1
    `;
        res = await pool.query(query, [instanceKey]);

        if (res.rows.length > 0) {
            return res.rows[0];
        }

        return null;
    } catch (error) {
        console.error(`[Evolution Utils] Error resolving company for instance ${instanceKey}:`, error);
        return null;
    }
};
