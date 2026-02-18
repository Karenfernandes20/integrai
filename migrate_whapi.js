
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:integraiempresa1234@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify' });

(async () => {
    try {
        await pool.query("ALTER TABLE company_instances ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'evolution'");
        await pool.query("ALTER TABLE company_instances ADD COLUMN IF NOT EXISTS whapi_token TEXT");
        await pool.query("ALTER TABLE company_instances ADD COLUMN IF NOT EXISTS whapi_channel_id TEXT");
        console.log("Migration success");
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
})();
