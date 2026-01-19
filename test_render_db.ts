import { Client } from 'pg';

const renderUrl = "postgresql://cadastro_cliente_iwbo_user:RyqHDy6ABo9QAESIRbyTxxC6cUAmOl8G@dpg-d5221o56ubrc7392bor0-a.oregon-postgres.render.com/cadastro_cliente_iwbo";

async function testConnection() {
    console.log("Testing Render URL...");
    const client = new Client({
        connectionString: renderUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Successfully connected to Render DB!");
        const res = await client.query('SELECT NOW()');
        console.log("Current Time:", res.rows[0]);
        await client.end();
    } catch (err: any) {
        console.error("Render Connection Failed:", err.message);
    }
}

testConnection();
