
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

// Manual env loading
const envPath = path.join(process.cwd(), '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_users'
    `);
        console.log('App Users Columns:', result.rows.map(r => r.column_name));

        const result2 = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `);
        console.log('Tables:', result2.rows.map(r => r.table_name));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
