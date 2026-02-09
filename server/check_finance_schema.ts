
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx !== -1) {
            const key = line.substring(0, idx).trim();
            let value = line.substring(idx + 1).trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    });
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const resSub = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions'");
        const resInv = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices'");
        console.log('Subscriptions Columns:', resSub.rows.map(r => r.column_name).join(', '));
        console.log('Invoices Columns:', resInv.rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
