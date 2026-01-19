
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { URL } from 'url';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
const dbUrl = process.env.DATABASE_URL;

console.log('Testing DB Connect...');
if (!dbUrl) { console.error('No DB URL'); process.exit(1); }

// Test 1: Connection String
async function test1() {
    console.log('--- Test 1: Connection String ---');
    const pool1 = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });
    try {
        const res = await pool1.query('SELECT NOW()');
        console.log('Test 1 Success:', res.rows[0]);
    } catch (e: any) {
        console.log('Test 1 Failed:', e.message);
    } finally {
        await pool1.end();
    }
}

// Test 2: Parsed URL (Simulating app logic)
async function test2() {
    console.log('--- Test 2: Parsed URL (App Logic) ---');
    try {
        const url = new URL(dbUrl!);
        const config = {
            user: url.username,
            password: url.password, // Uses what URL gives (encoded?)
            host: url.hostname,
            port: parseInt(url.port || '5432'),
            database: url.pathname.slice(1),
            ssl: { rejectUnauthorized: false }
        };
        console.log('Parsed Password (raw):', config.password);
        console.log('Decoded Password:', decodeURIComponent(config.password));

        // Try with raw as returned by URL
        const pool2 = new Pool(config);
        try {
            const res = await pool2.query('SELECT NOW()');
            console.log('Test 2 (Raw) Success:', res.rows[0]);
        } catch (e: any) {
            console.log('Test 2 (Raw) Failed:', e.message);

            // Try with decoded
            const configDecoded = { ...config, password: decodeURIComponent(config.password) };
            const pool3 = new Pool(configDecoded);
            try {
                const res = await pool3.query('SELECT NOW()');
                console.log('Test 2 (Decoded) Success:', res.rows[0]);
            } catch (e2: any) {
                console.log('Test 2 (Decoded) Failed:', e2.message);
            } finally {
                await pool3.end();
            }
        } finally {
            await pool2.end();
        }
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    await test1();
    await test2();
}

run();
