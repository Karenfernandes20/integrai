
import './env.js';
import { pool } from './db/index.js';

async function checkKarenConfig() {
    try {
        const res = await pool.query(`SELECT * FROM companies WHERE id = 21`);

        if (res.rows.length > 0) {
            const c = res.rows[0];
            console.log('Keys:', Object.keys(c).sort().join(', '));
        } else {
            console.log('NOT_FOUND');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (pool) await pool.end();
    }
}

checkKarenConfig();
