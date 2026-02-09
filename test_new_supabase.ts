
import pg from 'pg';
const { Client } = pg;

const url = "postgresql://postgres.hdwubhvmzfggsrtgkdlv:integraiempresa1234@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify";

async function testNewSupabase() {
    console.log("Testing new Supabase credentials...");

    // Masked log
    console.log("URL:", url.replace(/:([^:@]+)@/, ":****@"));

    const client = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("✅ CONNECTION SUCCESSFUL!");
        const res = await client.query("SELECT NOW(), version()");
        console.log("Server Time:", res.rows[0].now);
        console.log("Version:", res.rows[0].version);
        await client.end();
    } catch (e) {
        console.error("❌ CONNECTION FAILED:");
        console.error(e.message);
    }
}

testNewSupabase();
