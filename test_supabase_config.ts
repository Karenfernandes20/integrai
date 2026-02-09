
import pg from 'pg';
const { Client } = pg;

const url = "postgresql://postgres.hdwubhvmzfggsrtgkdlv:Klpf1212%40%40%40!@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=no-verify";

async function testSupabase() {
    console.log("Tentando conectar ao Supabase com a configuração antiga...");
    console.log("URL:", url.replace(/:([^:@]+)@/, ":****@")); // Hide password in log

    const client = new Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("✅ SUCESSO! Conectado ao Supabase.");
        const res = await client.query("SELECT NOW()");
        console.log("Hora no servidor:", res.rows[0].now);
        await client.end();
    } catch (e) {
        console.error("❌ FALHA DE CONEXÃO:");
        console.error(e.message);
        if (e.message.includes("password")) {
            console.log("\n⚠️  DIAGNÓSTICO: A senha está incorreta ou foi alterada.");
        }
    }
}

testSupabase();
