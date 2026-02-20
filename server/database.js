"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = exports.pool = void 0;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env if not loaded
if (!process.env.DATABASE_URL) {
    dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../.env') });
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
let poolInstance = null;
if (!poolInstance) {
    if (!process.env.DATABASE_URL) {
        console.error("FATAL: DATABASE_URL not defined.");
    }
    else {
        poolInstance = new Pool(dbConfig);
        poolInstance.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Don't exit process, connection will be recovered
        });
        console.log(`[Database] Pool initialized with max ${dbConfig.max} connections.`);
    }
}
exports.pool = poolInstance;
// Helper for transaction handling
const withTransaction = async (callback) => {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
};
exports.withTransaction = withTransaction;
