
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkSchema() {
    try {
        console.log("--- company_instances ---");
        const res1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company_instances'");
        console.log(res1.rows);

        console.log("\n--- whatsapp_conversations ---");
        const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'whatsapp_conversations'");
        console.log(res2.rows);

        console.log("\n--- queues ---");
        const res3 = await pool.query("SELECT id, name FROM queues LIMIT 5");
        console.log(res3.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
