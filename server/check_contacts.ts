
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("--- Contacts Columns ---");
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'contacts'");
        console.log(JSON.stringify(res.rows, null, 2));

    } catch (e) {
        console.error("Query failed:", e);
    } finally {
        await pool.end();
    }
}
run();
