import './env.ts';
import { pool } from './db/index.ts';
// Wait, listing of 'server' showed 'db' directly in 'server'. 'check_schema.ts' used './db/index.ts'.
// Let's use './db' if I place this in 'server'.

async function migrate() {
    try {
        if (!pool) {
            console.error("Pool not initialized");
            process.exit(1);
        }

        console.log("Creating financial_categories table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS financial_categories (
                id SERIAL PRIMARY KEY,
                company_id INTEGER,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("Table created.");
        process.exit(0);
    } catch (e: any) {
        const fs = await import('fs');
        fs.writeFileSync('error_log.txt', e.message + '\n' + e.stack);
        console.error("MIGRATION ERROR:", e.message);
        process.exit(1);
    }
}

migrate();
