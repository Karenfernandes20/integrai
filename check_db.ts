import './server/env';
import { pool } from './server/db';

async function checkInstance() {
    try {
        const res = await pool.query('SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE id = 1');
        console.log('Company ID 1:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkInstance();
