
import './env';
import { pool } from './db';

async function check() {
    const res = await pool.query("SELECT name, instagram_app_id, instagram_page_id, instagram_business_id FROM companies WHERE name ILIKE '%Leo%'");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}
check();
