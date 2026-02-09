
import 'dotenv/config';
import fs from 'fs';
import { pool } from './server/db/index.js';
async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'whatsapp_contacts';
        `);
        let output = "";
        res.rows.forEach(r => output += `${r.column_name}: ${r.is_nullable}\n`);
        fs.writeFileSync('whatsapp_contacts_nulls.txt', output);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('whatsapp_contacts_nulls.txt', e.toString());
        process.exit(1);
    }
}
check();
