
import { pool } from './server/db';

async function main() {
    try {
        console.log('Checking crm_leads columns...');
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'crm_leads'
        `);
        const columns = res.rows.map(r => r.column_name);
        console.log('Columns:', columns);
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}

main();
