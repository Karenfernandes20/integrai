
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'whatsapp_conversations'
    `);

        const output = res.rows.map(r => `${r.column_name} (${r.data_type}) - Nullable: ${r.is_nullable}`).join('\n');
        console.log(output);
        fs.writeFileSync('conversations_schema.txt', output);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
