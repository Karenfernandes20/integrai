
import { pool } from './server/db';
import fs from 'fs';

async function checkUsers() {
    try {
        const res = await pool.query("SELECT id, email, full_name, role, company_id FROM app_users WHERE company_id = 30 OR email ILIKE '%karen%'");
        fs.writeFileSync('users_dump.json', JSON.stringify(res.rows, null, 2));
        console.log("Dumped Users.");
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkUsers();
