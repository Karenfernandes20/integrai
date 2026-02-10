
import { pool } from './server/db';
import fs from 'fs';

async function checkUsers() {
    try {
        console.log("Checking users for Company 30:");
        const res = await pool.query("SELECT id, email, full_name, role, company_id FROM app_users WHERE company_id = 30 OR email ILIKE '%karen%'");
        console.log(JSON.stringify(res.rows, null, 2));

        console.log("\nChecking Total Appointments for Company 30:");
        const count = await pool.query("SELECT COUNT(*) FROM crm_appointments WHERE company_id = 30");
        console.log(count.rows[0].count);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkUsers();
