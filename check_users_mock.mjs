
import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
const { Pool } = pg;
import { URL } from 'url';

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
    process.exit(1);
}

const pool = new Pool(poolConfig);

async function checkUsers() {
    try {
        const users = await pool.query('SELECT id, email, full_name, role FROM app_users WHERE company_id = 32');
        console.table(users.rows);
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await pool.end();
    }
}

checkUsers();
