
import { pool } from './server/db';

async function check() {
    try {
        const res = await pool.query('SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE id = 1');
        console.log('--- DB Config for Company 1 ---');
        console.log(res.rows[0]);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
