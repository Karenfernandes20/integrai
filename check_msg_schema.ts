
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'whatsapp_messages'
      ORDER BY column_name
    `);
        res.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

checkSchema();
