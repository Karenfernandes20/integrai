
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res = await pool.query(`
    SELECT id, message, details, created_at 
    FROM system_logs 
    WHERE event_type = 'webhook_error' 
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC 
    LIMIT 20
  `);
    fs.writeFileSync('webhook_errors_today.txt', JSON.stringify(res.rows, null, 2));
    await pool.end();
}
check();
