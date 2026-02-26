
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAllRecentLogs() {
    try {
        console.log(`--- Checking ALL Recent Audit Logs ---`);
        const logs = await pool.query(`
      SELECT id, company_id, event_type, message, details, created_at 
      FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
        console.table(logs.rows);
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkAllRecentLogs();
