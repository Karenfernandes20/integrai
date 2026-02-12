
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgres://postgres:postgres@localhost:5432/integrai_db'
});

async function checkLogs() {
    try {
        console.log("Checking recent sales and errors...");

        const salesRes = await pool.query('SELECT * FROM sales ORDER BY id DESC LIMIT 5');
        console.log("\n--- RECENT SALES ---");
        console.table(salesRes.rows);

        const logsRes = await pool.query("SELECT * FROM system_logs WHERE status = 'error' ORDER BY id DESC LIMIT 10");
        console.log("\n--- RECENT ERROR LOGS ---");
        console.table(logsRes.rows);

        const alertsRes = await pool.query("SELECT * FROM admin_alerts WHERE is_read = FALSE ORDER BY id DESC LIMIT 10");
        console.log("\n--- UNREAD ALERTS ---");
        console.table(alertsRes.rows);

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await pool.end();
    }
}

checkLogs();
