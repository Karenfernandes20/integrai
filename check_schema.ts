
import { pool } from './server/db';

async function checkSchema() {
    if (!pool) {
        console.error('No pool');
        return;
    }
    try {
        const res = await pool.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'companies' AND column_name IN ('operational_profile', 'operation_type', 'category');
        `);
        console.log('SCHEMA_START');
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('SCHEMA_END');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkSchema();
