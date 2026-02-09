
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

// Manual env loading
const envPath = path.join(process.cwd(), '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx !== -1) {
            const key = line.substring(0, idx).trim();
            const value = line.substring(idx + 1).trim();
            process.env[key] = value;
        }
    });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error("DATABASE_URL not found");
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const result = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%user_id%' OR column_name LIKE '%responsible_id%' OR column_name LIKE '%created_by%' OR column_name LIKE '%passenger_id%' OR column_name LIKE '%driver_id%')
    `);
        console.log('Tables with references:', result.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
