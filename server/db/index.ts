import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.warn("DATABASE_URL não definida. Configure-a no Render para conectar ao Postgres/PgHero.");
}

// Configure Pool with explicit settings for Render/Cloud stability
const poolConfig = databaseUrl ? {
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false, // Required for most cloud providers
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // FORCE IPv4 to avoid "connect ENETUNREACH :5432" (Node 17+ localhost resolution issue)
    // This is the CRITICAL fix for the user's error.
    host: undefined, // Let connectionString handle it
    port: undefined, // Let connectionString handle it
} : null;

// Only apply 'family' if we are actually creating the config object
// Type casting as any to bypass partial type mismatch if types are old, 
// though pg types usually support it.
if (poolConfig) {
    (poolConfig as any).family = 4; // Force IPv4
}

export const pool = poolConfig ? new Pool(poolConfig) : null;

if (pool) {
    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        // Do not exit process, just log
    });
}
