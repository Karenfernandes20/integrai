import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import pkg from 'pg';
const { Pool } = pkg;
import { URL } from 'url';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error("DATABASE_URL not found");
    process.exit(1);
}

const url = new URL(databaseUrl);
const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
const pool = new Pool({
    user: url.username,
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    database: url.pathname.slice(1),
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'whatsapp_messages'
            ORDER BY column_name
        `);
        console.log("MESSAGES_COLUMNS:" + JSON.stringify(res.rows.map(r => r.column_name)));

        const res2 = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'whatsapp_conversations'
            ORDER BY column_name
        `);
        console.log("CONVERSATIONS_COLUMNS:" + JSON.stringify(res2.rows.map(r => r.column_name)));

    } catch (e: any) {
        console.error("FAIL:", e.message);
    }
    await pool.end();
    process.exit();
}
check();
