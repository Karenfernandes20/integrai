
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT id, name, instance_key, type, status FROM company_instances WHERE company_id = 42")
    .then(res => {
        res.rows.forEach(r => {
            console.log(`ID: ${r.id} | NAME: ${r.name} | KEY: ${r.instance_key} | TYPE: ${r.type} | STATUS: ${r.status}`);
        });
        process.exit(0);
    });
