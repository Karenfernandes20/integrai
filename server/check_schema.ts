import dotenv from 'dotenv';
dotenv.config();
import { pool } from './db/index.ts';

async function checkSchema() {
    try {
        const res = await pool!.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'logo_url'");
        console.log("Schema Check:", res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSchema();
