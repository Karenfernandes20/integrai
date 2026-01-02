
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Client } = pg;

async function checkRender() {
    console.log('--- CHECKING RENDER (via DATABASE_URL) ---');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.log('No DATABASE_URL found.');
        return;
    }
    console.log(`URL: ${dbUrl.substring(0, 20)}...`);

    const client = new Client({
        connectionString: dbUrl,
        ssl: {
            rejectUnauthorized: false
        },
        connectionTimeoutMillis: 10000
    });

    try {
        console.log('Connecting to Render...');
        await client.connect();
        console.log('Render Connected!');
        const res = await client.query('SELECT count(*) FROM companies');
        console.log(`Render Companies Count: ${res.rows[0].count}`);

        const userRes = await client.query("SELECT * FROM app_users WHERE email = 'dev.karenfernandes@gmail.com'");
        console.log(`User dev.karenfernandes@gmail.com found in Render: ${userRes.rowCount > 0 ? 'YES' : 'NO'}`);
        if (userRes.rowCount > 0) console.log('User Role:', userRes.rows[0].role);

        await client.end();
    } catch (err) {
        console.error('Render Connection Failed:', err.message);
        if (err.message.includes('terminated')) {
            console.log('Hint: Render User/DB might be suspended or SSL handshake failed.');
        }
    }
}

async function checkSupabase() {
    console.log('\n--- CHECKING SUPABASE (via REST) ---');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Using Anon key

    if (!supabaseUrl || !supabaseKey) {
        console.log('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
        return;
    }

    console.log(`Supabase URL: ${supabaseUrl}`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { data, error } = await supabase.from('companies').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('Supabase REST Error:', error.message);
        } else {
            console.log('Supabase Companies (Head Request): Success');
            console.log('Count:', data); // data might be null with head:true depending on version
        }

        // Try to fetch app_users? usually blocked by RLS for anon
        const { data: userData, error: userError } = await supabase
            .from('app_users')
            .select('*')
            .eq('email', 'dev.karenfernandes@gmail.com');

        if (userError) {
            console.log('Supabase User Fetch Error (Expected if RLS):', userError.message);
        } else {
            console.log(`User dev.karenfernandes@gmail.com found in Supabase: ${userData.length > 0 ? 'YES' : 'NO'}`);
        }

    } catch (err) {
        console.error('Supabase Check Failed:', err.message);
    }
}

async function run() {
    await checkRender();
    await checkSupabase();
}

run();
