
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkSchema() {
    let output = "";
    try {
        const tables = ['company_instances', 'whatsapp_conversations', 'queues'];
        for (const table of tables) {
            output += `--- ${table} ---\n`;
            const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
            output += res.rows.map(r => r.column_name).join(', ') + "\n\n";
        }
        fs.writeFileSync('schema_output.txt', output);
        console.log("Done. Results in schema_output.txt");
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
