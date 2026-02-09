
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
        const result = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND (column_name LIKE '%user_id%' OR column_name LIKE '%responsible_id%' OR column_name LIKE '%created_by%' OR column_name LIKE '%staff_id%' OR column_name LIKE '%delivery_staff_id%' OR column_name LIKE '%updated_by%' OR column_name LIKE '%last_updated_by%')
    `);
        const output = result.rows.map(r => `${r.table_name}.${r.column_name}`).join('\n');
        fs.writeFileSync('all_refs.txt', output);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
