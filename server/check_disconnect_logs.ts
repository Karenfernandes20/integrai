
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkDisconnectLogs() {
    try {
        const res = await pool.query(`
        SELECT created_at, message, details 
        FROM system_logs 
        WHERE (message LIKE '%Disconnect%' OR message LIKE '%Evolution Failure%') 
        ORDER BY created_at DESC 
        LIMIT 10
    `);
        console.log("Disconnect-related logs:");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkDisconnectLogs();
