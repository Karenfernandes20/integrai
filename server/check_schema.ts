import './env.ts';
import { pool } from './db/index.ts';

async function checkSchema() {
    try {
        const res = await pool!.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'financial_transactions'");
        console.log("Schema Check:", res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSchema();
