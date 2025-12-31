
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:bWAxkRV4Gb7VRw88@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query(`
            SELECT company_id, instance, count(*) as count
            FROM whatsapp_conversations 
            GROUP BY company_id, instance 
            ORDER BY company_id ASC NULLS FIRST
        `);
        console.log("CONVERSATIONS:");
        res.rows.forEach(r => console.log(`  - Company: ${r.company_id}, Instance: ${r.instance}, Count: ${r.count}`));

        console.log("\nCOMPANIES:");
        const compRes = await pool.query(`SELECT id, name, evolution_instance FROM companies`);
        compRes.rows.forEach(r => console.log(`  - ID: ${r.id}, Name: ${r.name}, Instance: ${r.evolution_instance}`));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
