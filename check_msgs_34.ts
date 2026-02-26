
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res = await pool.query('SELECT * FROM whatsapp_messages WHERE company_id = 34 ORDER BY sent_at DESC LIMIT 10');
    fs.writeFileSync('msgs_34_recent.txt', JSON.stringify(res.rows, null, 2));
    await pool.end();
}
check();
