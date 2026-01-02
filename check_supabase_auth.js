
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function checkSupabaseDirect() {
    console.log('--- CHECKING SUPABASE DIRECT CONNECTION ---');

    // Construct URL with User provided password and Project ID from .env
    // Project ID: faugdfdukdshcofhdmgyFrom .env (VITE_SUPABASE_PROJECT_ID or URL host)
    // Password: User provided 'Klpf1212!'

    // Warning: Special chars in password might need encoding. ! is usually fine but let's see.
    const projectRef = 'faugdfdukdshcofhdmgy';
    const password = 'Klpf1212!';
    const dbUrl = `postgres://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;

    console.log(`Trying URL: postgres://postgres:***@db.${projectRef}.supabase.co:5432/postgres`);

    const client = new Client({
        connectionString: dbUrl,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 10000
    });

    try {
        console.log('Connecting...');
        await client.connect();
        console.log('CONNECTED to Supabase Postgres!');

        const res = await client.query('SELECT count(*) FROM companies');
        console.log(`Supabase Companies Count: ${res.rows[0].count}`);

        const userRes = await client.query("SELECT * FROM app_users WHERE email = 'dev.karenfernandes@gmail.com'");
        console.log(`User dev.karenfernandes@gmail.com found: ${userRes.rowCount > 0 ? 'YES' : 'NO'}`);
        if (userRes.rowCount > 0) console.log('User Role:', userRes.rows[0].role);

        await client.end();
        return true;
    } catch (err) {
        console.error('Supabase Direct Connection Failed:', err.message);
        return false;
    }
}

checkSupabaseDirect();
