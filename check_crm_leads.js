
import 'dotenv/config';
import fs from 'fs';
import { pool } from './server/db/index.js';
async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'crm_leads';
        `);
        let output = "COLUMNS: " + res.rows.map(r => r.column_name).join(', ') + "\n";

        const constraints = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE contype IN ('f', 'p', 'u')
            AND conrelid = 'crm_leads'::regclass;
        `);
        output += "CONSTRAINTS:\n";
        constraints.rows.forEach(r => output += `${r.conname}: ${r.pg_get_constraintdef}\n`);

        fs.writeFileSync('crm_leads_info.txt', output);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('crm_leads_info.txt', e.toString());
        process.exit(1);
    }
}
check();
