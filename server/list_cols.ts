
import './env';
import { pool } from './db';

async function check() {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'");
    console.log(res.rows.map(r => r.column_name));
    process.exit(0);
}
check();
