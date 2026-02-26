
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function searchMessagesUpsert() {
    try {
        const res = await pool.query(`
      SELECT id, company_id, event_type, message, details, created_at 
      FROM system_logs 
      WHERE message LIKE '%messages.upsert%' 
         OR details::text LIKE '%messages.upsert%'
      ORDER BY created_at DESC 
      LIMIT 50
    `);
        fs.writeFileSync('messages_upsert_logs.txt', JSON.stringify(res.rows, null, 2));
        console.log('Done');
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

searchMessagesUpsert();
