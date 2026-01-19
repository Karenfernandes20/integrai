import { Client } from 'pg';

const supabaseUrl = "postgresql://postgres.hdwubhvmzfggsrtgkdlv:Klpf1212%40%40%40!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=no-verify";

async function testConnection() {
    console.log("Testing Supabase URL...");
    const client = new Client({
        connectionString: supabaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Successfully connected to Supabase!");
        const res = await client.query('SELECT NOW()');
        console.log("Current Time:", res.rows[0]);

        // Check columns for leads and conversations
        const leadsCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'crm_leads'");
        console.log("crm_leads columns:", leadsCols.rows.map(r => r.column_name));

        const convCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_conversations'");
        console.log("whatsapp_conversations columns:", convCols.rows.map(r => r.column_name));

        await client.end();
    } catch (err: any) {
        console.error("Connection Failed:", err.message);
        if (err.stack) console.error(err.stack);
    }
}

testConnection();
