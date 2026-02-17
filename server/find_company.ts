
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
        const res = await pool.query("SELECT id, name, whatsapp_type, whatsapp_official_phone_number_id, whatsapp_official_webhook_token, instagram_enabled FROM companies WHERE name ILIKE '%Integrai%' OR name ILIKE '%Karen%' LIMIT 5");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error("Query failed:", e);
    } finally {
        await pool.end();
        process.exit();
    }
}
run();
