
import "./env";
import { pool } from './db';

async function main() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'operational_profile';
        `);
        console.log("Column Check:", res.rows);

        const res2 = await pool.query(`SELECT id, name, operational_profile, category, operation_type FROM companies LIMIT 5`);
        console.log("Data Check:", res2.rows);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

main();
