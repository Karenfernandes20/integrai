
import "./env";
import { pool } from "./db";

const check = async () => {
    try {
        const res = await pool.query("SELECT count(*) FROM whatsapp_campaigns WHERE status = 'scheduled' OR status = 'running'");
        console.log("Pending/Running Campaigns:", res.rows[0].count);

        const res2 = await pool.query("SELECT * FROM whatsapp_campaigns ORDER BY created_at DESC LIMIT 1");
        console.log("Last Campaign:", res2.rows[0]);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
};
check();
