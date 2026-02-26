
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res = await pool.query('SELECT * FROM company_instances WHERE company_id = 34');
    fs.writeFileSync('inst_34_full_details.txt', JSON.stringify(res.rows, null, 2));
    await pool.end();
}
check();
