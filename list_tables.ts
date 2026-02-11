
import 'dotenv/config';
import { pool } from './server/db/index';

async function listTables() {
    if (!pool) {
        console.error('Pool not initialized');
        return;
    }
    try {
        const res = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log(res.rows.map(r => r.tablename));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listTables();
