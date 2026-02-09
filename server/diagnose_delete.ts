
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function diagnose() {
    let output = "";
    try {
        output += "Checking for tables referencing key entities...\n";
        const entities = ['companies', 'app_users', 'crm_leads', 'whatsapp_conversations', 'whatsapp_campaigns', 'system_logs', 'company_instances'];

        for (const entity of entities) {
            output += `\n--- Referencing ${entity} ---\n`;
            const result = await pool.query(`
                SELECT
                    tc.table_name, 
                    kcu.column_name,
                    rc.delete_rule
                FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                    JOIN information_schema.referential_constraints AS rc
                      ON rc.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name=$1;
            `, [entity]);

            result.rows.forEach(r => {
                output += `${r.table_name}.${r.column_name} (ON DELETE ${r.delete_rule})\n`;
            });
        }
        fs.writeFileSync('server/diag_output.txt', output);
        console.log("Written to server/diag_output.txt");
    } catch (e: any) {
        console.error(e);
        fs.writeFileSync('server/diag_output.txt', e.message);
    } finally {
        await pool.end();
    }
}

diagnose();
