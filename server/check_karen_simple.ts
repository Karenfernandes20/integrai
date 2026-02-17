
import './env.js';
import { pool } from './db/index.js';

async function checkKarenConfig() {
    try {
        const res = await pool.query('SELECT * FROM companies LIMIT 1');
        if (res.rows.length > 0) {
            console.log('Columns:');
            console.log(JSON.stringify(Object.keys(res.rows[0]), null, 2));
        } else {
            console.log('No companies.');
        }
    } catch (error) {
        console.error(error);
    } finally {
        if (pool) await pool.end();
    }
}

checkKarenConfig();
