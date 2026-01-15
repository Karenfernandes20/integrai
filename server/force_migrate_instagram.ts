
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

import dns from 'dns';

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

dotenv.config({ path: envPath });

console.log("DB URL Length:", process.env.DATABASE_URL?.length);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("Starting Forced Migration...");
        const client = await pool.connect();
        console.log("Connected to DB.");

        try {
            await client.query('BEGIN');

            // 1. Companies
            await client.query(`
                ALTER TABLE companies
                ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS instagram_app_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS instagram_app_secret VARCHAR(255),
                ADD COLUMN IF NOT EXISTS instagram_page_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS instagram_business_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
                ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP;
            `);
            console.log("Updated companies table.");

            // 2. Conversations
            await client.query(`
                ALTER TABLE whatsapp_conversations
                ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
                ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
                ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255);
            `);
            console.log("Updated whatsapp_conversations table.");

            // 3. Messages
            await client.query(`
                ALTER TABLE whatsapp_messages
                ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
                ADD COLUMN IF NOT EXISTS instagram_message_id VARCHAR(255);
            `);
            console.log("Updated whatsapp_messages table.");

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
