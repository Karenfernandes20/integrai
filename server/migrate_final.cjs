
require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
});

async function run() {
    try {
        console.log("Checking financial_categories...");
        const res = await pool.query("SELECT to_regclass('public.financial_categories')");
        if (res.rows[0].to_regclass) {
            console.log("Table financial_categories EXISTS.");
        } else {
            console.log("Table financial_categories MISSING. Creating...");
            await pool.query(`
                CREATE TABLE financial_categories (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Created financial_categories.");
        }

        console.log("Checking cost_center column...");
        const colRes = await pool.query("SELECT to_regclass('public.financial_transactions')");
        if (colRes.rows[0].to_regclass) {
            const hasCol = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='financial_transactions' AND column_name='cost_center'");
            if (hasCol.rows.length === 0) {
                console.log("Column cost_center MISSING. Adding...");
                await pool.query("ALTER TABLE financial_transactions ADD COLUMN cost_center VARCHAR(255)");
                console.log("Added cost_center.");
            } else {
                console.log("Column cost_center EXISTS.");
            }
        }

        process.exit(0);
    } catch (e) {
        console.error("Error:", e.message);
        process.exit(1);
    }
}

run();
