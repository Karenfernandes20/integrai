
import 'dotenv/config';
import { pool } from './server/db/index.js';
async function check() {
    try {
        if (!pool) {
            console.log("Pool not found");
            return;
        }
        const res = await pool.query(`
            SELECT 
                tc.constraint_name, 
                tc.table_name, 
                kcu.column_name, 
                tc.constraint_type
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name IN ('whatsapp_contacts', 'crm_leads')
            AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE');
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
