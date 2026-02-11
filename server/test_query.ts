
import "dotenv/config";
import { pool } from "./db";

async function test() {
    if (!pool) return;
    try {
        console.log("Q1: id");
        await pool.query("SELECT id FROM whatsapp_conversations LIMIT 1");

        console.log("Q2: external_id");
        await pool.query("SELECT external_id FROM whatsapp_conversations LIMIT 1");

        console.log("Q3: is_group");
        await pool.query("SELECT is_group FROM whatsapp_conversations LIMIT 1");

        console.log("Q4: Full Query");
        await pool.query("SELECT id FROM whatsapp_conversations WHERE is_group = true AND external_id NOT LIKE '%@g.us' LIMIT 1");

        console.log("ALL SUCCESS");
    } catch (e: any) {
        console.error("FAIL:", e.message);
    }
    process.exit();
}
test();
