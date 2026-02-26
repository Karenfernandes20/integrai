
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function dumpSystemLogs() {
    try {
        const res = await pool.query(`
      SELECT id, company_id, event_type, message, details, origin, created_at 
      FROM system_logs 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
        fs.writeFileSync('system_logs_output.txt', JSON.stringify(res.rows, null, 2));
        console.log('Done');
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

dumpSystemLogs();
