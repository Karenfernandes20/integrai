import './server/env.js';
import { pool } from './server/db/index.js';

async function run() {
    if (!pool) return;
    console.log("Starting DB Cleanup for bad instance names...");

    const badInstance = 'integraiempresa01gmailcom';

    try {
        // 1. Check companies
        const res1 = await pool.query('UPDATE companies SET evolution_instance = NULL WHERE evolution_instance = $1 RETURNING id, name', [badInstance]);
        console.log(`Updated ${res1.rowCount} companies from bad instance.`);
        if (res1.rows.length > 0) {
            console.log('Affected companies:', res1.rows);
        }

        // 2. Check company_instances
        const res2 = await pool.query('DELETE FROM company_instances WHERE instance_key = $1 RETURNING id, company_id', [badInstance]);
        console.log(`Deleted ${res2.rowCount} bad instances from company_instances.`);

        // 3. Check whatsapp_conversations (maybe some are linked to it)
        const res3 = await pool.query('UPDATE whatsapp_conversations SET instance = NULL WHERE instance = $1', [badInstance]);
        console.log(`Cleared ${res3.rowCount} conversations from bad instance.`);

        // 4. Set a safe default for any company that has NO instance and is supposed to have one?
        // Actually it's better to leave it NULL so resolveInstanceByCompany can handle it.

    } catch (e) {
        console.error("Cleanup failed:", (e as any).message);
    }

    console.log("DB Cleanup Completed.");
    process.exit(0);
}
run();
