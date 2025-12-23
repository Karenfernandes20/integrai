import pkg from 'pg';
const { Pool } = pkg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.warn("DATABASE_URL não definida. Configure-a no Render para conectar ao Postgres/PgHero.");
}

export const pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        // Configurações recomendadas para produção
        max: 20, // maximo de conexões
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    })
    : null;
