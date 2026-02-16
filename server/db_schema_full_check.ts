import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import fs from 'fs';

import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

async function check() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_name IN ('companies', 'whatsapp_messages', 'whatsapp_conversations', 'company_instances')
            ORDER BY table_name, column_name
        `);

        fs.writeFileSync('schema_debug.json', JSON.stringify(res.rows, null, 2));
        console.log("Success, rows:", res.rows.length);

    } catch (e: any) {
        console.error("Error:", e);
        fs.writeFileSync('schema_debug.json', JSON.stringify({ error: e.message, stack: e.stack }));
    }
    await pool.end();
}
check();
