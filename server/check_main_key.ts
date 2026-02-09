
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:integraiempresa1234@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify'
});

async function run() {
    const res = await pool.query("SELECT evolution_apikey FROM companies WHERE id = 1");
    console.log('MAIN_COMPANY_KEY:', res.rows[0].evolution_apikey);
    await pool.end();
}
run();
