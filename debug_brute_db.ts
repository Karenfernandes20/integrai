
import { Pool } from 'pg';
import fs from 'fs';

const logFile = 'debug_brute_log.txt';
function log(msg: string) {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
}
fs.writeFileSync(logFile, '');

const baseConfig = {
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.hdwubhvmzfggsrtgkdlv',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

async function test(pass: string, name: string) {
    log(`Testing Password: ${name}`);
    const pool = new Pool({ ...baseConfig, password: pass });
    try {
        await pool.query('SELECT 1');
        log(`SUCCESS with ${name}`);
        return true;
    } catch (e: any) {
        log(`FAILED with ${name}: ${e.message}`);
        return false;
    } finally {
        await pool.end();
    }
}

async function run() {
    const p1 = 'Klpf1212@@@!';
    const p2 = 'Klpf1212%40%40%40!';
    const p3 = 'ryqHDy6ABo9QAESIRbyTxxC6cUAmOl8G'; // From the *first* DATABASE_URL in the .env file I saw earlier!

    if (await test(p1, 'Decoded')) return;
    if (await test(p2, 'Raw')) return;
    if (await test(p3, 'FirstEnvPass')) return;
}

run();
