
import pg from 'pg';
const { Client } = pg;

async function checkSupabaseUsers() {
    // The URL previously found in the .env file (Supabase)
    const connectionString = "postgresql://postgres.hdwubhvmzfggsrtgkdlv:Klpf1212%40%40%40!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=no-verify";

    console.log("Connecting to Supabase (Old Configuration)...");

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to Supabase!");

        const res = await client.query(`SELECT email, role, is_active FROM app_users ORDER BY id ASC`);

        if (res.rows.length === 0) {
            console.log("No users found in Supabase DB.");
        } else {
            console.log("--- USERS IN SUPABASE DB ---");
            res.rows.forEach(u => {
                console.log(`Email: ${u.email} | Role: ${u.role} | Active: ${u.is_active}`);
            });
            console.log("----------------------------");
        }

    } catch (e) {
        console.error("Could not connect to Supabase DB:", e.message);
    } finally {
        await client.end();
    }
}

checkSupabaseUsers();
