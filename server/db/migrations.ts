
import { pool } from './index';

export const runMigrations = async () => {
    if (!pool) return;
    try {
        console.log("Running migrations...");

        // 1. Create financial_transactions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS financial_transactions (
                id SERIAL PRIMARY KEY,
                description TEXT NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('payable', 'receivable')),
                amount DECIMAL(12, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                due_date TIMESTAMP,
                paid_at TIMESTAMP,
                city_id INTEGER,
                category VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Add category column if missing
        try {
            await pool.query(`ALTER TABLE financial_transactions ADD COLUMN category VARCHAR(100);`);
        } catch (e: any) {
            // Ignore duplicate_column error
        }

        // 3. Add paid_at column if missing
        try {
            await pool.query(`ALTER TABLE financial_transactions ADD COLUMN paid_at TIMESTAMP;`);
        } catch (e: any) {
            // Ignore duplicate_column error
        }

        // 4. CRM Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_stages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                color VARCHAR(20) DEFAULT '#cbd5e1',
                position INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Ensure default stages exist
        const stagesCheck = await pool.query('SELECT COUNT(*) FROM crm_stages');
        if (parseInt(stagesCheck.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO crm_stages (name, color, position) VALUES 
                ('Leads', '#cbd5e1', 0),
                ('Em Atendimento', '#93c5fd', 1),
                ('Proposta', '#fde047', 2),
                ('Fechado', '#86efac', 3),
                ('Perdido', '#fca5a5', 4);
            `);
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                phone VARCHAR(50),
                email VARCHAR(100),
                value DECIMAL(12, 2),
                stage_id INTEGER REFERENCES crm_stages(id),
                description TEXT,
                origin VARCHAR(50),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);


        // 5. Companies Updates
        try {
            await pool.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='operation_type') THEN 
                        ALTER TABLE companies ADD COLUMN operation_type VARCHAR(20) DEFAULT 'clientes' CHECK (operation_type IN ('motoristas', 'clientes', 'pacientes')); 
                    END IF;
                END $$;
            `);
        } catch (e: any) {
            console.error("Error adding operation_type to companies:", e);
        }

        // 6. User Permissions
        try {
            await pool.query(`ALTER TABLE app_users ADD COLUMN permissions JSONB DEFAULT '[]'`);
        } catch (e: any) {
            // Ignore if exists
        }

        await runWhatsappMigrations();
        console.log("Migrations finished.");
    } catch (e) {
        console.error("Migration Error:", e);
    }
};

const runWhatsappMigrations = async () => {
    if (!pool) return;
    try {
        // whatsapp_conversations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_conversations (
                id SERIAL PRIMARY KEY,
                external_id VARCHAR(100) NOT NULL, -- remove UNIQUE constraint globally if multi-tenant sharing same number (unlikely) but better: enforce uniqueness constraint on (external_id, instance)
                phone VARCHAR(50),
                contact_name VARCHAR(100),
                profile_pic_url TEXT,
                unread_count INTEGER DEFAULT 0,
                last_message_at TIMESTAMP DEFAULT NOW(),
                instance VARCHAR(100), -- Connected instance name
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(external_id, instance) -- Conversation is unique per number per instance
            );
        `);

        // whatsapp_messages
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
                direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
                content TEXT,
                status VARCHAR(20) DEFAULT 'received', -- sent, delivered, read
                message_type VARCHAR(50) DEFAULT 'text',
                media_url TEXT,
                sent_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Add columns safely if they don't exist
        const addColumn = async (table: string, column: string, type: string) => {
            if (!pool) return;
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
            } catch (e) { }
        };

        await addColumn('whatsapp_conversations', 'profile_pic_url', 'TEXT');
        await addColumn('whatsapp_conversations', 'unread_count', 'INTEGER DEFAULT 0');
        await addColumn('whatsapp_messages', 'status', "VARCHAR(20) DEFAULT 'received'");
        await addColumn('whatsapp_conversations', 'instance', 'VARCHAR(100)');
        await addColumn('whatsapp_conversations', 'status', "VARCHAR(20) DEFAULT 'PENDING'");
        await addColumn('whatsapp_conversations', 'user_id', 'INTEGER REFERENCES app_users(id)');
        await addColumn('whatsapp_conversations', 'started_at', 'TIMESTAMP');
        await addColumn('whatsapp_conversations', 'closed_at', 'TIMESTAMP');
        await addColumn('whatsapp_conversations', 'last_message', 'TEXT');

        // Audit Logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_audit_logs (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES whatsapp_conversations(id),
                user_id INTEGER REFERENCES app_users(id),
                action VARCHAR(50) NOT NULL,
                details TEXT, -- using TEXT for simplicity over JSONB if pg version varies, but JSONB usually fine.
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // whatsapp_contacts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_contacts (
                id SERIAL PRIMARY KEY,
                jid VARCHAR(100) NOT NULL,
                name VARCHAR(100),
                push_name VARCHAR(100),
                profile_pic_url TEXT,
                instance VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
                -- Constraint will be enforced via Index below to be safe against existing tables
            );
        `);

        // Enforce Unique Constraint for UPSERT (Safe Migration)
        try {
            // 1. Clean up potential duplicates first
            await pool.query(`
                DELETE FROM whatsapp_contacts a USING whatsapp_contacts b 
                WHERE a.id < b.id AND a.jid = b.jid AND a.instance = b.instance;
            `);

            // 2. Create Unique Index if not exists (Required for ON CONFLICT (jid, instance))
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_jid_instance 
                ON whatsapp_contacts (jid, instance);
            `);
        } catch (e) {
            console.error("Warning: Could not enforce unique constraint on whatsapp_contacts:", e);
        }

    } catch (error) {
        console.error("Error creating WhatsApp tables:", error);
    }
};
