
import "./env"; // Load env vars
import { pool } from './db';

async function checkDb() {
    if (!pool) {
        console.error("Pool is null - CHECK .ENV file and DATABASE_URL variable");
        return;
    }
    try {
        console.log("Checking DB connection...");
        const res = await pool.query("SELECT NOW()");
        console.log("Connected to DB at:", res.rows[0].now);

        console.log("Checking for crm_appointments table...");
        const tableRes = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'crm_appointments'
        `);

        if (tableRes.rows.length > 0) {
            console.log("✅ Table 'crm_appointments' EXISTS.");

            // Check columns
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'crm_appointments'
            `);
            console.log("Columns:", cols.rows.map(r => r.column_name).join(', '));

        } else {
            console.log("❌ Table 'crm_appointments' DOES NOT EXIST.");
        }

    } catch (e) {
        console.error("DB Check Failed:", e);
    } finally {
        process.exit();
    }
}

checkDb();
