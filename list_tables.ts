
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function listTables() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
        res.rows.forEach(row => {
            console.log(row.table_name);
        });
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

listTables();
