
import { pool } from './server/db';

async function migrate() {
    if (!pool) {
        console.error('No pool');
        return;
    }
    try {
        console.log('Migrating operational_profile column length...');
        await pool.query('ALTER TABLE companies ALTER COLUMN operational_profile TYPE VARCHAR(50)');
        console.log('Done.');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

migrate();
