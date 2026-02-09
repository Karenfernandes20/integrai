
import "./env";
import pg from 'pg';
const { Client } = pg;

async function diagnose() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("❌ DATABASE_URL is missing in .env");
        process.exit(1);
    }

    console.log("---------------------------------------------------");
    console.log("DIAGNOSTIC TOOL");
    console.log("---------------------------------------------------");
    console.log(`Connection String Length: ${dbUrl.length}`);

    // Masked Host
    try {
        const url = new URL(dbUrl);
        console.log(`Target Host: ${url.hostname} (Port: ${url.port})`);

        if (url.hostname.includes("aws-0") && url.hostname.includes("pooler")) {
            console.log("ℹ️  Identified as Supabase Transaction Pooler");
        } else if (url.hostname.includes("render.com")) {
            console.log("ℹ️  Identified as Render Postgres");
        }
    } catch {
        console.log("❌ Could not parse URL");
    }

    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }, // Permissive SSL for testing
        connectionTimeoutMillis: 5000
    });

    try {
        console.log("Attempting connection...");
        await client.connect();
        console.log("✅ DataBase Connection Successful!");

        const res = await client.query('SELECT NOW() as now');
        console.log(`Server Time: ${res.rows[0].now}`);

        // Check Table
        const tableCheck = await client.query("SELECT * FROM information_schema.tables WHERE table_name = 'crm_appointments'");
        if (tableCheck.rows.length > 0) {
            console.log("✅ Table 'crm_appointments' FOUND.");

            // Count
            const count = await client.query('SELECT count(*) FROM crm_appointments');
            console.log(`Current Appointments Count: ${count.rows[0].count}`);
        } else {
            console.error("❌ Table 'crm_appointments' NOT FOUND. You need to run the migration.");
        }

    } catch (e) {
        console.error("❌ CONNECTION ERROR:", e.message);
        if (e.message.includes("password")) console.log("   -> Check your password.");
        if (e.message.includes("does not exist")) console.log("   -> Database name might be wrong.");
        if (e.message.includes("ECONNREFUSED")) console.log("   -> Check Host and Port.");
    } finally {
        await client.end();
        console.log("---------------------------------------------------");
    }
}

diagnose();
