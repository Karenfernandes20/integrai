
import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;
import { URL } from 'url';

// Copying logic from server/db/index.ts for consistency
const databaseUrl = process.env.DATABASE_URL;
let poolConfig = null;

if (databaseUrl) {
    try {
        const url = new URL(databaseUrl);
        const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        poolConfig = {
            user: url.username,
            password: decodeURIComponent(url.password),
            host: url.hostname,
            port: parseInt(url.port || '5432'),
            database: url.pathname.slice(1),
            ssl: isLocal ? undefined : { rejectUnauthorized: false },
            family: 4 // Force IPv4
        };
        console.log(`Using Database Host: ${poolConfig.host}`);
    } catch (e) {
        console.log("Using Connection String directly");
        poolConfig = { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } };
    }
}

const pool = new Pool(poolConfig);

async function checkLogs() {
    try {
        console.log("Checking recent sales and errors...");

        // Check Sales
        const salesRes = await pool.query('SELECT id, company_id, total_amount, status, created_at FROM sales ORDER BY id DESC LIMIT 5');
        console.log("\n--- RECENT SALES ---");
        console.table(salesRes.rows);

        // Check System Logs for Errors
        const logsRes = await pool.query("SELECT id, event_type, status, message, created_at FROM system_logs WHERE status = 'error' ORDER BY id DESC LIMIT 10");
        console.log("\n--- RECENT ERROR LOGS ---");
        console.table(logsRes.rows.map(row => ({
            id: row.id,
            type: row.event_type,
            msg: row.message ? row.message.substring(0, 50) + '...' : '',
            time: row.created_at
        })));

        // Check specific table for sale errors if any (though usually in logs)

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await pool.end();
    }
}

checkLogs();
