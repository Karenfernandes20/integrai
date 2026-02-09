
import 'dotenv/config';
import fs from 'fs';
import { pool } from './server/db/index.js';
async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'whatsapp_contacts';
        `);
        let output = "COLUMNS: " + res.rows.map(r => r.column_name).join(', ') + "\n";

        const constraints = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE contype IN ('f', 'p', 'u')
            AND conrelid = 'whatsapp_contacts'::regclass;
        `);
        output += "CONSTRAINTS:\n";
        constraints.rows.forEach(r => output += `${r.conname}: ${r.pg_get_constraintdef}\n`);

        fs.writeFileSync('schema_info.txt', output);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('schema_info.txt', e.toString());
        process.exit(1);
    }
}
check();
