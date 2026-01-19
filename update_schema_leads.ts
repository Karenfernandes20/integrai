
import { pool } from './server/db';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    if (!pool) {
        console.error("No Pool");
        return;
    }
    try {
        await pool.query("ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS instance VARCHAR(100)");
        console.log("Added instance column to crm_leads");

        // Also ensure whatsapp_conversations has instance (it should, but good to check)
        // It is already there based on migrations.ts

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
