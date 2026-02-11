import "dotenv/config";
import { pool } from "./db";

async function analyze() {
    console.log("Starting...");
    if (!pool) { console.error("Pool is null"); return; }

    try {
        console.log("Querying 1...");
        const res = await pool.query('SELECT 1');
        console.log("Query 1 success");

        console.log("Querying columns...");
        const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_conversations'");
        console.log("Cols:", cols.rows.map(r => r.column_name).sort().join(', '));

    } catch (e: any) {
        console.error("Error detected:");
        console.error(e.message || e);
    }
    process.exit();
}

analyze();
