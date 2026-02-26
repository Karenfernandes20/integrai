
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAuditLogs34() {
    try {
        const companyId = 34;
        console.log(`--- Checking Audit Logs for Company ${companyId} ---`);
        const logs = await pool.query(`
      SELECT * FROM audit_logs 
      WHERE company_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [companyId]);
        console.table(logs.rows);

        console.log('\n--- Checking System Logs for Company 34 ---');
        const systemLogs = await pool.query(`
      SELECT * FROM system_logs 
      WHERE company_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, [companyId]);
        console.table(systemLogs.rows);

        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkAuditLogs34();
