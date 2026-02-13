
import './env';
import { pool } from './db';

async function check() {
    const res = await pool.query("SELECT name, instagram_access_token FROM companies");
    res.rows.forEach(r => {
        console.log(`Company: ${r.name}, Token: ${r.instagram_access_token ? 'YES (' + r.instagram_access_token.substring(0, 10) + '...)' : 'NO'}`);
    });
    process.exit(0);
}
check();
