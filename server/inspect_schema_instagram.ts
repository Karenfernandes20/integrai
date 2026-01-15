
import './env';
import { pool } from './db/index';

async function main() {
    try {
        if (!pool) return;
        console.log("Checking 'companies' table schema:");
        const companiesRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'companies'`);
        companiesRes.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

        console.log("\nChecking 'whatsapp_conversations' table schema:");
        const convRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'whatsapp_conversations'`);
        convRes.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
