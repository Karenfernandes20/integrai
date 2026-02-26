
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkKarenLojaActivity() {
    try {
        const res = await pool.query(`
      SELECT id, event_type, message, details, created_at 
      FROM system_logs 
      WHERE details::text LIKE '%karenloja%'
      ORDER BY created_at DESC 
      LIMIT 20
    `);
        fs.writeFileSync('karenloja_logs.txt', JSON.stringify(res.rows, null, 2));
        console.log('Done');
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkKarenLojaActivity();
