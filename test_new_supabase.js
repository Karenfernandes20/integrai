
import pg from 'pg';
const { Client } = pg;

async function testConnection(connectionString, label) {
    console.log(`\n--- Testing: ${label} ---`);
    console.log(`URL: ${connectionString.replace(/:([^:@]+)@/, ':***@')}`); // Mask password

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully!');
        const res = await client.query('SELECT count(*) FROM companies');
        console.log(`Companies Count: ${res.rows[0].count}`);

        // Check for user
        const userRes = await client.query("SELECT * FROM app_users WHERE email = 'dev.karenfernandes@gmail.com'");
        if (userRes.rowCount > 0) {
            console.log('✅ User found:', userRes.rows[0].email, 'Role:', userRes.rows[0].role);
        } else {
            console.log('⚠️ User dev.karenfernandes@gmail.com NOT found.');
        }

        await client.end();
        return true;
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        return false;
    }
}

async function run() {
    // Attempt 1: As provided (Assuming password is Klpf1212!!!@ or implicit parsing handles @@)
    // If user put @@, maybe they meant password ends in @?
    // postgres://user:pass@host:port/db
    // postgres://postgres:Klpf1212!!!@@db...
    // This implies password is "Klpf1212!!!@"

    const url1 = "postgresql://postgres:Klpf1212!!!@@db.hdwubhvmzfggsrtgkdlv.supabase.co:5432/postgres";

    // Attempt 2: Assuming double @ was a typo and password is Klpf1212!!!
    const url2 = "postgresql://postgres:Klpf1212!!!@db.hdwubhvmzfggsrtgkdlv.supabase.co:5432/postgres";

    // Attempt 3: Assuming previous password Klpf1212!
    const url3 = "postgresql://postgres:Klpf1212!@db.hdwubhvmzfggsrtgkdlv.supabase.co:5432/postgres";

    if (await testConnection(url1, "Direct Input (Password: Klpf1212!!!@)")) return;
    if (await testConnection(url2, "Single @ (Password: Klpf1212!!!)")) return;
    if (await testConnection(url3, "Old Password (Password: Klpf1212!)")) return;
}

run();
