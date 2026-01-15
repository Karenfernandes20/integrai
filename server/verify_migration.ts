
import './env';
import { pool } from './db/index';

async function main() {
    try {
        if (!pool) return;
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'companies' 
            AND column_name LIKE 'instagram_%'
        `);
        console.log("Instagram Columns in 'companies':", res.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
main();
