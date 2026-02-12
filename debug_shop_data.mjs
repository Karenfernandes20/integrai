
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
    process.exit(1);
}

const pool = new Pool(poolConfig);

async function checkShopData() {
    try {
        let output = "Checking SHOP Data...\n";

        // Inventory
        const invRes = await pool.query('SELECT id, name, quantity, sale_price, status FROM inventory ORDER BY id DESC LIMIT 5');
        output += "\n--- INVENTORY (Last 5) ---\n";
        output += JSON.stringify(invRes.rows, null, 2);

        // Companies and instances
        const compRes = await pool.query('SELECT id, name, operation_type FROM companies LIMIT 5');
        output += "\n--- COMPANIES ---\n";
        output += JSON.stringify(compRes.rows, null, 2);

        // Instance
        const instRes = await pool.query('SELECT id, company_id, name, status FROM company_instances LIMIT 5');
        output += "\n--- INSTANCES ---\n";
        output += JSON.stringify(instRes.rows, null, 2);

        fs.writeFileSync('debug_shop_output.txt', output);
        console.log("Output written to debug_shop_output.txt");

    } catch (e) {
        console.error("DB Error:", e);
        fs.writeFileSync('debug_shop_output.txt', "DB Error: " + e.message);
    } finally {
        await pool.end();
    }
}

checkShopData();
