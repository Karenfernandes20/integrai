
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dns from 'dns';

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("Starting Legal Pages Migration...");
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create table for legal pages
            await client.query(`
                CREATE TABLE IF NOT EXISTS legal_pages (
                    id SERIAL PRIMARY KEY,
                    type VARCHAR(50) NOT NULL UNIQUE, -- 'terms', 'privacy'
                    content TEXT,
                    last_updated_at TIMESTAMP DEFAULT NOW(),
                    last_updated_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL
                );
            `);
            console.log("Created legal_pages table.");

            // Insert default rows if not exist
            await client.query(`
                INSERT INTO legal_pages (type, content) 
                VALUES ('terms', '<h2>Termos de Serviço</h2><p>Conteúdo pendente.</p>'), 
                       ('privacy', '<h2>Política de Privacidade</h2><p>Conteúdo pendente.</p>')
                ON CONFLICT (type) DO NOTHING;
            `);
            console.log("Inserted default legal pages.");

            await client.query('COMMIT');
            console.log("Migration Committed Successfully.");

        } catch (queryErr) {
            console.error("Query Error:", queryErr);
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }

    } catch (e) {
        console.error("Connection Error:", e);
    } finally {
        await pool.end();
    }
}

main();
