
import 'dotenv/config';
import { pool } from './server/db/index.js';
async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'whatsapp_contacts';
        `);
        console.log("COLUMNS:", res.rows.map(r => r.column_name).join(', '));

        const constraints = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE contype IN ('f', 'p', 'u')
            AND conrelid = 'whatsapp_contacts'::regclass;
        `);
        console.log("CONSTRAINTS:");
        constraints.rows.forEach(r => console.log(`${r.conname}: ${r.pg_get_constraintdef}`));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
