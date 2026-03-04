
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
    await pool.query("UPDATE company_instances SET type = 'instagram' WHERE id = 18244");
    const res = await pool.query('SELECT * FROM company_instances WHERE company_id = 42');
    console.log(res.rows.map(r => `${r.id}: ${r.name} - ${r.type}`).join('\n'));
    process.exit(0);
}

fix();
