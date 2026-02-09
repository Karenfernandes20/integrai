
import 'dotenv/config';
import { pool } from './server/db';
import fs from 'fs';

async function diagnose() {
    try {
        console.log("Diagnosing with company context...");

        // Get a sample user's company_id
        const userRes = await pool.query("SELECT id, company_id, email FROM app_users WHERE email = 'andrebrito@teste.com' OR email LIKE '%andrebrito%' LIMIT 1");
        const user = userRes.rows[0];
        console.log("Current User:", user);

        const companyId = user?.company_id;

        const appointments = await pool.query(`
            SELECT id, title, start_time, end_time, company_id, status, created_at 
            FROM crm_appointments 
            WHERE company_id = $1
            ORDER BY created_at DESC 
            LIMIT 10
        `, [companyId]);

        const allAppointmentsCount = await pool.query("SELECT count(*) FROM crm_appointments");

        const results = {
            currentUser: user,
            appointmentsForCompany: appointments.rows,
            totalAppointmentsInDb: allAppointmentsCount.rows[0].count,
            dbTimezone: (await pool.query("SHOW TIMEZONE")).rows[0]
        };

        fs.writeFileSync('diagnose_results_v2.json', JSON.stringify(results, null, 2));
        console.log("Done writing to diagnose_results_v2.json");

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

diagnose();
