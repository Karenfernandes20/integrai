
import 'dotenv/config';
import { pool } from './server/db/index';

async function checkConstraints() {
    if (!pool) {
        console.error('Pool not initialized');
        return;
    }
    try {
        const res = await pool.query(`
      SELECT
          conname AS constraint_name,
          contype AS constraint_type,
          pg_get_constraintdef(c.oid) AS constraint_definition
      FROM
          pg_constraint c
      JOIN
          pg_namespace n ON n.oid = c.connamespace
      WHERE
          conrelid = 'whatsapp_contacts'::regclass;
    `);
        console.log('Constraints for whatsapp_contacts:');
        console.log(JSON.stringify(res.rows, null, 2));

        const indexes = await pool.query(`
      SELECT
          indexname,
          indexdef
      FROM
          pg_indexes
      WHERE
          tablename = 'whatsapp_contacts';
    `);
        console.log('Indexes for whatsapp_contacts:');
        console.log(JSON.stringify(indexes.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkConstraints();
