
import { Pool } from 'pg';

// Render Credentials from line 1 of .env
const connectionString = "postgresql://cadastro_cliente_iwbo_user:RyqHDy6ABo9QAESIRbyTxxC6cUAmOl8G@dpg-d5221o56ubrc7392bor0-a.oregon-postgres.render.com/cadastro_cliente_iwbo?ssl=true";

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Connecting to Render DB...');
        const res = await pool.query('SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE id = 1');
        console.log('Success:', res.rows[0]);
    } catch (e: any) {
        console.error('Failed:', e.message);
    } finally {
        await pool.end();
    }
}

run();
