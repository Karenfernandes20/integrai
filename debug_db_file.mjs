
import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;
import { URL } from 'url';
import fs from 'fs';

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
    } catch (e) {
        poolConfig = { connectionString: databaseUrl, ssl: { rejectUnauthorized: false } };
    }
} else {
    console.error("DATABASE_URL not set");
    process.exit(1);
}

const pool = new Pool(poolConfig);

async function checkLogs() {
    try {
        let output = "Checking recent sales and errors...\n";

        // Check Sales
        const salesRes = await pool.query('SELECT id, company_id, total_amount, status, created_at FROM sales ORDER BY id DESC LIMIT 5');
        output += "\n--- RECENT SALES ---\n";
        output += JSON.stringify(salesRes.rows, null, 2);

        // Check System Logs for Errors
        const logsRes = await pool.query("SELECT id, event_type, status, message, details, created_at FROM system_logs WHERE status = 'error' ORDER BY id DESC LIMIT 5");
        output += "\n--- RECENT ERROR LOGS ---\n";
        output += JSON.stringify(logsRes.rows, null, 2);

        fs.writeFileSync('debug_output_full.txt', output);
        console.log("Output written to debug_output_full.txt");

    } catch (e) {
        console.error("DB Error:", e);
        fs.writeFileSync('debug_output_full.txt', "DB Error: " + e.message);
    } finally {
        await pool.end();
    }
}

checkLogs();
