
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:integraiempresa1234@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify' });

(async () => {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'company_instances'");
        console.log(res.rows.map(r => r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
})();
