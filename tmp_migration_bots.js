import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function up() {
    try {
        await pool.query(`
            DROP TABLE IF EXISTS bot_sessions CASCADE;
            DROP TABLE IF EXISTS bot_versions CASCADE;
            
            CREATE TABLE IF NOT EXISTS bot_versions (
                id SERIAL PRIMARY KEY,
                bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
                version_number INTEGER NOT NULL,
                is_published BOOLEAN DEFAULT false,
                flow_snapshot JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS bot_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
                contact_jid VARCHAR(255) NOT NULL,
                current_node_id VARCHAR(255),
                variables JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                interrupted_by_human BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_bot_versions_bot_id ON bot_versions(bot_id);
            CREATE INDEX IF NOT EXISTS idx_bot_sessions_contact_bot ON bot_sessions(contact_jid, bot_id);
            CREATE INDEX IF NOT EXISTS idx_bot_sessions_active ON bot_sessions(is_active);
        `);
        console.log("Migration successful");
    } catch (e) {
        console.error("Migration failed", e);
    } finally {
        process.exit();
    }
}

up();
