
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
const databaseUrl = process.env.DATABASE_URL;

async function checkLogs() {
    const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT * FROM system_logs WHERE event_type = 'evolution_error' ORDER BY id DESC LIMIT 5");
        console.log("Latest Evolution Errors (UTC):");
        res.rows.forEach(r => {
            console.log(`Log ID: ${r.id}`);
            console.log(`Created At: ${new Date(r.created_at).toISOString()}`);
            console.log(`Message: ${r.message}`);
            // console.log(`Details: ${JSON.stringify(r.details)}`);
            // Pretty print details if it's json
            try {
                const details = typeof r.details === 'string' ? JSON.parse(r.details) : r.details;
                console.log('Details Body:', details.body);
            } catch (e) {
                console.log('Details:', r.details);
            }
            console.log('---');
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
checkLogs();
