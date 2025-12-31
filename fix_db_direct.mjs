
import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = "postgresql://postgres.hdwubhvmzfggsrtgkdlv:bWAxkRV4Gb7VRw88@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

async function fix() {
    try {
        console.log("Connecting to Supabase...");

        // Check if company 1 exists
        const check = await pool.query("SELECT id FROM companies WHERE id = 1");

        let res;
        if (check.rows.length > 0) {
            console.log("Updating Company 1...");
            res = await pool.query(
                "UPDATE companies SET evolution_instance = 'integrai', evolution_apikey = '5A44C72AAB33-42BD-968A-27EB8E14BE6F' WHERE id = 1 RETURNING *"
            );
        } else {
            console.log("Company 1 not found. Inserting default company...");
            res = await pool.query(
                "INSERT INTO companies (id, name, evolution_instance, evolution_apikey) VALUES (1, 'Empresa Principal', 'integrai', '5A44C72AAB33-42BD-968A-27EB8E14BE6F') ON CONFLICT (id) DO UPDATE SET evolution_instance = EXCLUDED.evolution_instance, evolution_apikey = EXCLUDED.evolution_apikey RETURNING *"
            );
        }

        console.log("Success! Database updated:");
        console.log(JSON.stringify(res.rows[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error("Error fixing database:", err);
        process.exit(1);
    }
}

fix();
