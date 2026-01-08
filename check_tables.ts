import 'dotenv/config';
import { pool } from './server/db';
(async () => {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(res.rows.map(t => t.table_name));
    } catch (e: any) {
        console.error('ERROR:', e.message, e);
    }
    process.exit(0);
})();
