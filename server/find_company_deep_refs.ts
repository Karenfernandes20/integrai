
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
        const tablesWithCompanyId = fs.readFileSync('company_refs.txt', 'utf8').split('\n').filter(t => t.trim().length > 0);

        // Find dependencies OF these tables (cascading cleanup)
        const result = await pool.query(`
      SELECT
          tc.table_name, 
          kcu.column_name,
          ccu.table_name as referenced_table
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = ANY($1);
    `, [tablesWithCompanyId]);

        const output = result.rows.map(r => `${r.table_name}.${r.column_name} references ${r.referenced_table}`).join('\n');
        fs.writeFileSync('company_deep_refs.txt', output);
        console.log('Deep dependencies count:', result.rows.length);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
