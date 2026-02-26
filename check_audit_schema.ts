
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAuditSchema() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
    `);
        console.log(res.rows.map(r => r.column_name).join(', '));
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkAuditSchema();
