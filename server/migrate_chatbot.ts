
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('Starting Chatbot migration...');

        await client.query('BEGIN');

        // 1. Create bots table
        await client.query(`
      CREATE TABLE IF NOT EXISTS bots (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'inactive', -- active, inactive, draft
        trigger_type VARCHAR(50) DEFAULT 'all', -- all, keyword, none (manual only)
        trigger_config JSONB DEFAULT '{}', -- e.g. { keywords: ['hi', 'hello'] }
        settings JSONB DEFAULT '{}', -- timezone, working_hours, auto_archive, etc.
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        // 2. Create bot_nodes table (stores the visual blocks)
        await client.query(`
      CREATE TABLE IF NOT EXISTS bot_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- message, question, condition, action, integration, human_handoff
        position_x FLOAT NOT NULL DEFAULT 0,
        position_y FLOAT NOT NULL DEFAULT 0,
        content JSONB DEFAULT '{}', -- Stores the specific config for the node (text, options, etc)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        // 3. Create bot_edges table (stores connections between nodes)
        await client.query(`
      CREATE TABLE IF NOT EXISTS bot_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
        source_node_id UUID REFERENCES bot_nodes(id) ON DELETE CASCADE,
        target_node_id UUID REFERENCES bot_nodes(id) ON DELETE SET NULL,
        source_handle VARCHAR(50), -- For nodes with multiple outputs (like conditions)
        target_handle VARCHAR(50),
        label VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        // 4. Create bot_sessions table (tracks active conversations)
        await client.query(`
      CREATE TABLE IF NOT EXISTS bot_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
        contact_id INTEGER, -- Reference to contacts table if exists, or store phone directly
        phone VARCHAR(50) NOT NULL,
        current_node_id UUID REFERENCES bot_nodes(id) ON DELETE SET NULL,
        variables JSONB DEFAULT '{}', -- Store collected data (name, email, etc)
        status VARCHAR(50) DEFAULT 'active', -- active, completed, paused, handed_off
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

        // 5. Create bot_instances table (links bots to specific whatsapp instances)
        await client.query(`
      CREATE TABLE IF NOT EXISTS bot_instances (
        id SERIAL PRIMARY KEY,
        bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
        instance_key VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(bot_id, instance_key)
      );
    `);

        await client.query('COMMIT');
        console.log('Chatbot migration completed successfully!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

runMigration();
