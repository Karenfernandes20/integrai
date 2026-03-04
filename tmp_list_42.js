
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT id, name, instance_key, type, status FROM company_instances WHERE company_id = 42")
    .then(res => {
        console.log("COUNT:", res.rows.length);
        res.rows.forEach(r => {
            console.log(`- ${r.id}: ${r.name} (${r.instance_key}) [${r.type}] -> ${r.status}`);
        });
        process.exit(0);
    });
