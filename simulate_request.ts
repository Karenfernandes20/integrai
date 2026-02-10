
import { pool } from './server/db';
import fs from 'fs';

async function simulate() {
    try {
        console.log("--- SIMULATING REQUEST FOR USER 38 (Karen Agenda) ---");

        // Mock User
        const user = { id: 38, company_id: 30, role: 'ADMIN' };

        // Mock Query Params (Monday Feb 9)
        // Frontend sends ISO strings. 
        // Let's assume frontend sends full UTC Day range.
        const start = "2026-02-09T03:00:00.000Z";
        const end = "2026-02-10T02:59:59.999Z";

        // Reconstruct Controller Logic
        const params: any[] = [];
        let query = `
            SELECT a.id, a.title, a.start_time, a.end_time, a.company_id
            FROM crm_appointments a
            WHERE 1=1 
        `;

        if (user.company_id) {
            params.push(user.company_id);
            query += ` AND a.company_id = $${params.length}`;
        }

        if (start && end) {
            params.push(start, end);
            query += ` AND a.start_time >= ($${params.length - 1}::timestamp - INTERVAL '12 hours') AND a.start_time <= ($${params.length}::timestamp + INTERVAL '12 hours')`;
        }

        query += " ORDER BY a.start_time ASC";

        console.log("Query:", query);
        console.log("Params:", params);

        const result = await pool.query(query, params);
        console.log(`Rows Found: ${result.rowCount}`);
        console.log(JSON.stringify(result.rows, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit();
}

simulate();
