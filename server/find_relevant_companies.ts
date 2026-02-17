
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
        const res = await pool.query("SELECT id, name, whatsapp_type, whatsapp_official_phone_number_id, whatsapp_official_webhook_token, evolution_instance, instagram_enabled, instagram_business_account_id FROM companies");
        console.log("Found", res.rows.length, "companies");
        res.rows.forEach(c => {
            console.log(`ID:${c.id}|NAME:${c.name}|TYPE:${c.whatsapp_type}|PHONE_ID:${c.whatsapp_official_phone_number_id}|INSTA:${c.instagram_enabled}`);
        });
    } catch (e) {
        console.error("Query failed:", e);
    } finally {
        await pool.end();
    }
}
run();
