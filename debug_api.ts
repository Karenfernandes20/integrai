
import 'dotenv/config';
import { getCrmAppointments } from './server/controllers/appointmentController';
import { Request, Response } from 'express';

// Mock objects
const req = {
    query: {
        start: '2026-02-01T03:00:00.000Z',
        end: '2026-02-08T03:00:00.000Z',
        responsible_id: undefined // All
    },
    user: {
        company_id: 1 // Assuming 1, or I need to fetch a user tokens. 
        // Actually, I can't easily mock the controller without a DB connection and valid user object that matches the DB.
    }
};

// Instead of mocking controller, let's just use the URL with a valid token if I had one, 
// OR just query the DB directly and check the `to_char` output which is the critical part.

import { pool } from './server/db';

async function checkApiOutput() {
    console.log('--- Checking API Output Simulation ---');

    // 1. Get a company ID (assuming 1 or from a user)
    // Let's just pick the first company
    const compRes = await pool.query('SELECT id FROM companies LIMIT 1');
    const companyId = compRes.rows[0].id;
    console.log('Using Company ID:', companyId);

    // 2. Run the exact query from the controller
    const start = '2026-02-01T03:00:00.000Z'; // Week view approx
    const end = '2026-02-08T03:00:00.000Z';

    const query = `
        SELECT a.id, a.title, 
               to_char(a.start_time, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as start_time,
               to_char(a.end_time, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as end_time
        FROM crm_appointments a
        WHERE a.company_id = $1
        AND a.start_time BETWEEN $2::timestamptz AT TIME ZONE 'UTC' AND $3::timestamptz AT TIME ZONE 'UTC'
    `;

    try {
        const res = await pool.query(query, [companyId, start, end]);
        console.log(`Query returned ${res.rowCount} rows.`);
        if (res.rowCount > 0) {
            console.log('Sample Row 0:', res.rows[0]);
        } else {
            // Check if there are ANY for this company regardless of date
            const anyRes = await pool.query('SELECT count(*) FROM crm_appointments WHERE company_id = $1', [companyId]);
            console.log(`Total appointments for company ${companyId}:`, anyRes.rows[0].count);

            // Show raw start_time for a few
            const rawRes = await pool.query('SELECT start_time FROM crm_appointments WHERE company_id = $1 LIMIT 5', [companyId]);
            console.log('Raw start_times:', rawRes.rows);
        }
    } catch (e) {
        console.error(e);
    }

    process.exit(0);
}

checkApiOutput();
