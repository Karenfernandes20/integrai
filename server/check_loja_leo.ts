
import './env';
import { pool } from './db';

async function check() {
    try {
        const res = await pool.query("SELECT name, instagram_page_id, instagram_business_id, instagram_enabled, instagram_status FROM companies WHERE name = 'Loja Leo'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
