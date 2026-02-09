
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:integraiempresa1234@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify'
});

async function run() {
    try {
        const res = await pool.query("UPDATE company_instances SET api_key = '5A44C72AAB33-42BD-968A-27EB8E14BE6F' WHERE instance_key = 'karen' RETURNING *");
        if (res.rowCount > 0) {
            console.log('Updated successfully:', res.rows[0]);
        } else {
            console.log('No instance with key "karen" found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
