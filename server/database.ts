
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

// Load .env if not loaded
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}

const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 10, // Limit max clients to prevent blocking
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false } // Required for Render/Cloud
};

// Singleton Pool
let poolInstance: any = null;

if (!poolInstance) {
    if (!process.env.DATABASE_URL) {
        console.error("FATAL: DATABASE_URL not defined.");
    } else {
        poolInstance = new Pool(dbConfig);

        poolInstance.on('error', (err: any) => {
            console.error('Unexpected error on idle client', err);
            // Don't exit process, connection will be recovered
        });

        console.log(`[Database] Pool initialized with max ${dbConfig.max} connections.`);
    }
}

export const pool = poolInstance;

// Helper for transaction handling
export const withTransaction = async <T>(callback: (client: any) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};
