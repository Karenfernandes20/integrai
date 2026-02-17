
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
        const res = await pool.query("SELECT * FROM companies WHERE id = 31");
        if (res.rows.length === 0) {
            console.log("Company 31 not found!");
            return;
        }
        const c = res.rows[0];
        console.log("--- Company 31 Config ---");
        console.log("Name:", c.name);
        console.log("WhatsApp Type:", c.whatsapp_type);
        console.log("Phone ID:", c.whatsapp_official_phone_number_id);
        console.log("Verify Token:", c.whatsapp_official_webhook_token);
        console.log("Business Account ID:", c.whatsapp_official_business_account_id);
        console.log("Meta Status:", c.whatsapp_meta_status);
        console.log("Last Sync:", c.whatsapp_meta_last_sync);

        console.log("\n--- Checking for specific test conversation ---");
        const convTest = await pool!.query(
            "SELECT * FROM whatsapp_conversations WHERE external_id = $1 AND company_id = $2",
            ['16315551181@s.whatsapp.net', 31]
        );
        console.log(JSON.stringify(convTest.rows, null, 2));

        if (convTest.rows.length > 0) {
            console.log("\n--- Checking for messages in this conversation ---");
            const msgTest = await pool!.query(
                "SELECT * FROM whatsapp_messages WHERE conversation_id = $1 ORDER BY sent_at DESC",
                [convTest.rows[0].id]
            );
            console.log(JSON.stringify(msgTest.rows, null, 2));
        }

    } catch (e) {
        console.error("Query failed:", e);
    } finally {
        await pool.end();
    }
}
run();
