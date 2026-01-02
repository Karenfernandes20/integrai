import pkg from 'pg';
const { Pool } = pkg;
import { URL } from 'url';
import dns from 'dns';

// CRITICAL FIX: Force Node.js to prefer IPv4 results from DNS
// This solves the 'connect ENETUNREACH 2600:...' error on Render/networks with broken IPv6
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const databaseUrl = process.env.DATABASE_URL;

let poolConfig: any = null;

if (!databaseUrl) {
    console.warn("DATABASE_URL não definida. Configure-a no Render para conectar ao Postgres/PgHero.");
} else {
    try {
        // Parse URL manually to ensure family: 4 is respected by passing exact parameters
        // instead of connectionString which might prioritize IPv6 DNS resolution in some envs.
        const url = new URL(databaseUrl);

        poolConfig = {
            user: url.username,
            password: url.password,
            host: url.hostname,
            port: parseInt(url.port || '5432'),
            database: url.pathname.slice(1), // remove leading slash
            ssl: {
                rejectUnauthorized: false, // Required for most cloud providers including Supabase
            },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            family: 4 // Strictly FORCE IPv4
        };

        console.log(`DB Configured within Host: ${poolConfig.host} (IPv4 Forced)`);
    } catch (e) {
        console.error("Failed to parse DATABASE_URL, falling back to connectionString", e);
        poolConfig = {
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            family: 4
        };
    }
}

export const pool = poolConfig ? new Pool(poolConfig) : null;

if (pool) {
    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        // Do not exit process, just log
    });
}
