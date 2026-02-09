
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:integraiempresa1234@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify'
});

async function check() {
    try {
        const res = await pool.query("SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE id = 1 OR name ILIKE '%Karen%'");
        for (const r of res.rows) {
            console.log(`Company: ID=${r.id}, Name=${r.name}, Instance=${r.evolution_instance}, APIKey=${r.evolution_apikey}`);
        }

        const companyIds = res.rows.map(r => r.id);
        if (companyIds.length > 0) {
            const res2 = await pool.query("SELECT id, company_id, instance_key, api_key FROM company_instances WHERE company_id = ANY($1)", [companyIds]);
            for (const inst of res2.rows) {
                console.log(`Instance: ID=${inst.id}, CoID=${inst.company_id}, Key=${inst.instance_key}, Key2=${inst.api_key}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
