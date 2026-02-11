
import "dotenv/config";
import { pool } from "./db";

async function fix() {
    console.log("Applying DB Constraint Fix...");
    if (!pool) return;

    try {
        await pool.query(`
            -- Drop old constraints if they exist
            ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_external_id_key;
            ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_external_id_company_id_key;
            ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_external_id_instance_company_id_key;

            -- Apply new constraint: external_id + instance + company_id
            ALTER TABLE whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_external_id_instance_company_id_key UNIQUE (external_id, instance, company_id);
        `);
        console.log("Constraint updated successfully.");
    } catch (e) {
        console.error("Constraint update failed:", e);
    } finally {
        process.exit();
    }
}

fix();
