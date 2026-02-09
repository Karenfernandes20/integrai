
import pg from 'pg';
const { Client } = pg;

async function checkLocalhost() {
    // Try standard local defaults
    const connectionString = "postgresql://postgres:postgres@localhost:5432/postgres";

    console.log("Checking Localhost (Default)...");

    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log("Connected to Localhost!");
        // If connected, list users
        const res = await client.query(`SELECT email, role, is_active FROM app_users ORDER BY id ASC`);
        console.table(res.rows);
    } catch (e) {
        console.log("Could not connect to localhost:5432 (postgres/postgres). Reason:", e.message);
    } finally {
        await client.end();
    }
}

checkLocalhost();
