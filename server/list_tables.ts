
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
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        const tables = result.rows.map(r => r.table_name);
        fs.writeFileSync('tables.txt', tables.join('\n'));
        console.log('Tables found:', tables.length);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
