
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT name, instance_key, api_key FROM company_instances WHERE name = 'Karen Pessoal'")
    .then(res => { console.log(res.rows); process.exit(0); });
