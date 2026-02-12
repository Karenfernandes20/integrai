
import pg from 'pg';
const { Pool } = pg;
import 'dotenv/config';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    const globalKey = '5A44C72AAB33-42BD-968A-27EB8E14BE6F';
    try {
        await pool.query('UPDATE companies SET evolution_apikey = $1 WHERE evolution_apikey IS NULL OR evolution_apikey = \'\'', [globalKey]);
        console.log('Updated evolution_apikey for all companies');
        await pool.query('UPDATE company_instances SET api_key = $1 WHERE api_key IS NULL OR api_key = \'\'', [globalKey]);
        console.log('Updated api_key for all instances');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
