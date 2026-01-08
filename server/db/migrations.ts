
import { pool } from './index';

export const runMigrations = async () => {
    if (!pool) return;
    try {
        console.log("Running migrations...");
        console.log("*************************************************");
        console.log("STARTING DB MIGRATIONS - CHECKING BASE TABLES");
        console.log("*************************************************");

        // 0. Base Tables

        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS cities (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    state VARCHAR(2) NOT NULL,
                    active BOOLEAN DEFAULT TRUE
                );
            `);
            console.log("Verified table: cities");
        } catch (e) { console.error("Error creating cities:", e); }

        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS companies (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    cnpj VARCHAR(50),
                    city VARCHAR(100),
                    state VARCHAR(2),
                    phone VARCHAR(50),
                    logo_url TEXT,
                    evolution_instance VARCHAR(100),
                    evolution_apikey VARCHAR(255),
                    evolution_apikey VARCHAR(255),
                    operation_type VARCHAR(20) DEFAULT 'clientes',
                    onboarding_step INTEGER DEFAULT 1, -- 1: Company, 2: User, 3: Channel, 4: AI, 5: Complete
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: companies");
        } catch (e) { console.error("Error creating companies:", e); }

        try {
            await pool.query(`
                 CREATE TABLE IF NOT EXISTS app_users (
                    id SERIAL PRIMARY KEY,
                    full_name VARCHAR(255),
                    email VARCHAR(255) UNIQUE,
                    phone VARCHAR(50),
                    password_hash TEXT,
                    role VARCHAR(20) DEFAULT 'USUARIO',
                    company_id INTEGER REFERENCES companies(id),
                    city_id INTEGER REFERENCES cities(id),
                    state VARCHAR(2),
                    user_type VARCHAR(50),
                    email_validated BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_login TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: app_users");
        } catch (e) { console.error("Error creating app_users:", e); }

        // 1. Create financial_transactions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS financial_transactions (
                id SERIAL PRIMARY KEY,
                description TEXT NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('payable', 'receivable')),
                amount DECIMAL(12, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                due_date TIMESTAMP,
                issue_date TIMESTAMP DEFAULT NOW(),
                paid_at TIMESTAMP,
                city_id INTEGER,
                category VARCHAR(100),
                notes TEXT,
                company_id INTEGER REFERENCES companies(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Add columns if missing
        const addColumnSimple = async (col: string, type: string) => {
            if (!pool) return;
            try {
                await pool.query(`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS ${col} ${type};`);
            } catch (e) { }
        };

        await addColumnSimple('category', 'VARCHAR(100)');
        await addColumnSimple('paid_at', 'TIMESTAMP');
        await addColumnSimple('notes', 'TEXT');
        await addColumnSimple('company_id', 'INTEGER REFERENCES companies(id)');
        await addColumnSimple('cost_center', 'VARCHAR(255)');

        // 3. Financial Categories
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS financial_categories (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
            console.log("Verified table: financial_categories");
        } catch (e) { console.error("Error creating financial_categories:", e); }

        // 3.5. Financial Cost Centers
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS financial_cost_centers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name, company_id)
                );
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_cost_centers_company ON financial_cost_centers(company_id)');
            console.log("Verified table: financial_cost_centers");
        } catch (e) { console.error("Error creating financial_cost_centers:", e); }

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
                company_id INTEGER REFERENCES companies(id),
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

        try {
            await pool.query(`
                DO $$ 
                BEGIN 
                    ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#0e99b0';
                    ALTER TABLE companies ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(20) DEFAULT '#1e293b';
                    ALTER TABLE companies ADD COLUMN IF NOT EXISTS system_name VARCHAR(100) DEFAULT 'Viamovecar Hub';
                    ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
                END $$;
            `);
            console.log("White Label columns updated.");
        } catch (e) {
            console.error("Error adding White Label columns:", e);
        }

        // 6. User Permissions
        try {
            await pool.query(`ALTER TABLE app_users ADD COLUMN permissions JSONB DEFAULT '[]'`);
        } catch (e: any) {
            // Ignore if exists
        }

        await runWhatsappMigrations();

        // 7. Remove restrictive user_type check constraint
        try {
            await pool.query('ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_user_type_check');
            console.log("Dropped app_users_user_type_check");
        } catch (e) { console.error("Error dropping constraint:", e); }

        // 8. System Settings
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS system_settings (
                    key VARCHAR(255) PRIMARY KEY,
                    value JSONB NOT NULL,
                    updated_at TIMESTAMP DEFAULT NOW(),
                    updated_by INTEGER REFERENCES app_users(id)
                );
            `);
            await pool.query(`
                INSERT INTO system_settings (key, value)
                VALUES ('operational_mode', '"normal"')
                ON CONFLICT (key) DO NOTHING;
            `);
            console.log("Verified table: system_settings");
        } catch (e) { console.error("Error creating system_settings:", e); }

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
                external_id VARCHAR(100), -- WhatsApp message key id
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
        await addColumn('whatsapp_messages', 'external_id', 'VARCHAR(100)');
        await addColumn('whatsapp_conversations', 'company_id', 'INTEGER REFERENCES companies(id)');
        await addColumn('whatsapp_contacts', 'company_id', 'INTEGER REFERENCES companies(id)');
        await addColumn('whatsapp_conversations', 'is_group', 'BOOLEAN DEFAULT FALSE');
        await addColumn('whatsapp_conversations', 'group_name', 'VARCHAR(255)');
        await addColumn('whatsapp_messages', 'user_id', 'INTEGER REFERENCES app_users(id)');
        await addColumn('whatsapp_messages', 'message_type', "VARCHAR(50) DEFAULT 'text'");
        await addColumn('whatsapp_messages', 'media_url', 'TEXT');
        await addColumn('whatsapp_messages', 'sender_jid', 'VARCHAR(100)');
        await addColumn('whatsapp_messages', 'sender_jid', 'VARCHAR(100)');
        await addColumn('whatsapp_messages', 'sender_name', 'VARCHAR(255)');
        await addColumn('whatsapp_conversations', 'last_message_source', 'VARCHAR(20)');
        await addColumn('whatsapp_messages', 'company_id', 'INTEGER REFERENCES companies(id)');

        // Ensure campaign columns exist (safely)
        await addColumn('whatsapp_campaigns', 'media_url', 'TEXT');
        await addColumn('whatsapp_campaigns', 'media_type', 'VARCHAR(20)');
        await addColumn('whatsapp_campaigns', 'completed_at', 'TIMESTAMP');
        await addColumn('whatsapp_messages', 'campaign_id', 'INTEGER');
        await addColumn('whatsapp_messages', 'follow_up_id', 'INTEGER');

        // Ensure message uniqueness by external_id (WhatsApp message ID)
        try {
            // 1. Clean duplicates
            await pool.query(`
                DELETE FROM whatsapp_messages a USING whatsapp_messages b 
                WHERE a.id < b.id AND a.external_id = b.external_id AND a.external_id IS NOT NULL;
            `);
            // 2. Create unique index for ON CONFLICT (external_id)
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_external_id 
                ON whatsapp_messages (external_id);
            `);
        } catch (e) {
            console.error("Warning: Could not enforce unique constraint on whatsapp_messages:", e);
        }

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

        // Follow-ups Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_follow_ups (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                description TEXT,
                type VARCHAR(50) NOT NULL, -- call, whatsapp, wait_reply, reactivate, billing, post_sale, custom
                status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, overdue, completed, cancelled
                scheduled_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                lead_id INTEGER REFERENCES crm_leads(id) ON DELETE SET NULL,
                conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
                user_id INTEGER REFERENCES app_users(id), -- responsible
                company_id INTEGER REFERENCES companies(id),
                origin VARCHAR(50), -- Atendimento, Campanha, Manual
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Add priority column safely
        const addPriorityColumn = async () => {
            if (!pool) return;
            try {
                await pool.query(`ALTER TABLE crm_follow_ups ADD COLUMN priority VARCHAR(20) DEFAULT 'medium'`); // low, medium, high
            } catch (e) { }
        };
        await addPriorityColumn();

        // Add message field for automated follow-ups
        await addColumn('crm_follow_ups', 'message', 'TEXT');
        await addColumn('crm_follow_ups', 'phone', 'VARCHAR(50)');
        await addColumn('crm_follow_ups', 'contact_name', 'VARCHAR(255)');

        // Index for performance
        await pool.query('CREATE INDEX IF NOT EXISTS idx_follow_ups_company_user ON crm_follow_ups(company_id, user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_follow_ups_status_date ON crm_follow_ups(status, scheduled_at)');

        // WhatsApp Campaigns (Bulk Messaging)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                message_template TEXT NOT NULL,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES app_users(id),
                status VARCHAR(20) DEFAULT 'draft', -- draft, scheduled, running, paused, completed, cancelled
                scheduled_at TIMESTAMP,
                start_time TIME, -- Daily start time (e.g., 09:00)
                end_time TIME, -- Daily end time (e.g., 18:00)
                frequency VARCHAR(20) DEFAULT 'once', -- once, daily, weekly, monthly
                delay_min INTEGER DEFAULT 5, -- Min seconds between messages
                delay_max INTEGER DEFAULT 15, -- Max seconds between messages
                total_contacts INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                delivered_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                response_count INTEGER DEFAULT 0,
                media_url TEXT,
                media_type VARCHAR(20), -- image, video, audio, document
                variables JSONB DEFAULT '[]', -- [{name: 'nome', example: 'João'}]
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_campaign_contacts (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
                phone VARCHAR(50) NOT NULL,
                name VARCHAR(255),
                variables JSONB DEFAULT '{}', -- {nome: 'João', empresa: 'ABC'}
                status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed, responded
                sent_at TIMESTAMP,
                delivered_at TIMESTAMP,
                error_message TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query('CREATE INDEX IF NOT EXISTS idx_campaigns_company ON whatsapp_campaigns(company_id, status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON whatsapp_campaign_contacts(campaign_id, status)');

        // Admin Tasks Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_tasks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed
                priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
                due_date TIMESTAMP,
                responsible_id INTEGER REFERENCES app_users(id),
                company_id INTEGER REFERENCES companies(id),
                created_by INTEGER REFERENCES app_users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_task_history (
                id SERIAL PRIMARY KEY,
                task_id INTEGER REFERENCES admin_tasks(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES app_users(id),
                action TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_tasks_status ON admin_tasks(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_tasks_priority ON admin_tasks(priority)');

        // System Logs Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                event_type VARCHAR(50) NOT NULL,
                origin VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL,
                conversation_id INTEGER,
                phone VARCHAR(50),
                message TEXT,
                details JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_system_logs_status ON system_logs(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_system_logs_phone ON system_logs(phone)');

        // Admin Alerts Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_alerts (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                log_id INTEGER REFERENCES system_logs(id),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_alerts_is_read ON admin_alerts(is_read)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON admin_alerts(created_at)');

        console.log("Admin tasks migrations finished.");
        console.log("System logs migrations finished.");
        console.log("Admin alerts migrations finished.");
        // AI Agents Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ai_agents (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                prompt TEXT NOT NULL,
                provider VARCHAR(50) DEFAULT 'openai',
                model VARCHAR(100) DEFAULT 'gpt-4o',
                status VARCHAR(20) DEFAULT 'active', -- active, paused
                apikey TEXT,
                temperature DECIMAL(3,2) DEFAULT 0.7,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Insert default global agent if no agents exist
        const aiCheck = await pool.query('SELECT COUNT(*) FROM ai_agents');
        if (parseInt(aiCheck.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO ai_agents (name, prompt, status) 
                VALUES ('Agente Geral Integrai', 'Você é um assistente virtual prestativo da Integrai. Responda de forma clara e profissional.', 'active')
            `);
        }

        // Audit Logs Table (Universal)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES app_users(id),
                company_id INTEGER REFERENCES companies(id),
                action VARCHAR(20) NOT NULL, -- create, update, delete
                resource_type VARCHAR(50) NOT NULL, -- user, task, document, setting, etc.
                resource_id VARCHAR(100),
                old_values JSONB DEFAULT '{}',
                new_values JSONB DEFAULT '{}',
                details TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');

        // System Workflows Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_workflows (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                name VARCHAR(255) NOT NULL,
                event_type VARCHAR(50) NOT NULL, -- message_received, error_detected, task_created, document_updated
                conditions JSONB DEFAULT '[]',
                actions JSONB DEFAULT '[]',
                status VARCHAR(20) DEFAULT 'active', -- active, inactive
                is_test_mode BOOLEAN DEFAULT FALSE,
                created_by INTEGER REFERENCES app_users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Workflow Executions Table (History)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id SERIAL PRIMARY KEY,
                workflow_id INTEGER REFERENCES system_workflows(id) ON DELETE CASCADE,
                event_data JSONB,
                actions_taken JSONB,
                status VARCHAR(20), -- success, failed
                error_message TEXT,
                executed_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Entity Relationships Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS entity_links (
                id SERIAL PRIMARY KEY,
                source_type VARCHAR(50) NOT NULL, -- task, document, conversation, user, contract
                source_id VARCHAR(100) NOT NULL,
                target_type VARCHAR(50) NOT NULL,
                target_id VARCHAR(100) NOT NULL,
                link_type VARCHAR(50) DEFAULT 'related',
                created_by INTEGER REFERENCES app_users(id),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_type, source_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_type, target_id)');

        // Multi-Tenant Isolation Updates
        console.log("Applying Multi-Tenant Isolation Updates...");
        try {
            await pool.query(`ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_system_logs_company ON system_logs(company_id)`);

            await pool.query(`ALTER TABLE entity_links ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_entity_links_company ON entity_links(company_id)`);

            // Backfill entity_links company_id from source if possible? 
            // Too complex for auto-migration without logic. Leaving null for old links or manual fix.
        } catch (e) {
            console.error("Error applying multi-tenant updates:", e);
        }

        // Global Templates Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS global_templates (
                id SERIAL PRIMARY KEY,
                parent_id INTEGER REFERENCES global_templates(id) ON DELETE SET NULL,
                company_id INTEGER REFERENCES companies(id),
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL, -- message, document, task, contract
                content TEXT NOT NULL,
                variables JSONB DEFAULT '[]',
                version INTEGER DEFAULT 1,
                is_active BOOLEAN DEFAULT TRUE,
                created_by INTEGER REFERENCES app_users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_templates_company ON global_templates(company_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_templates_type ON global_templates(type)');

        console.log("Global Templates migrations finished.");

        // Roadmap Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roadmap_items (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'planned', -- planned, in_development, in_test, completed
                priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
                target_date TIMESTAMP,
                created_by INTEGER REFERENCES app_users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_roadmap_company ON roadmap_items(company_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_roadmap_status ON roadmap_items(status)');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS roadmap_comments (
                id SERIAL PRIMARY KEY,
                roadmap_item_id INTEGER REFERENCES roadmap_items(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES app_users(id),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_roadmap_comments_item ON roadmap_comments(roadmap_item_id)');

        // Plans & Limits Migration
        console.log("Applying Plans and Limits Migration...");
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS plans (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    max_users INTEGER DEFAULT 1,
                    max_whatsapp_users INTEGER DEFAULT 1, -- New granular limit
                    max_connections INTEGER DEFAULT 1, -- WhatsApp connections
                    max_queues INTEGER DEFAULT 3, 
                    max_open_sessions INTEGER DEFAULT 1, -- Active chats
                    use_campaigns BOOLEAN DEFAULT FALSE,
                    use_schedules BOOLEAN DEFAULT FALSE,
                    use_internal_chat BOOLEAN DEFAULT FALSE,
                    use_external_api BOOLEAN DEFAULT FALSE,
                    use_kanban BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `);

            // Seed default plans if empty
            const plansCount = await pool.query('SELECT COUNT(*) FROM plans');
            if (parseInt(plansCount.rows[0].count) === 0) {
                await pool.query(`
                    INSERT INTO plans (name, max_users, max_connections, max_queues, use_campaigns, use_schedules, use_internal_chat, use_external_api, use_kanban) VALUES 
                    ('Plano 1', 5, 2, 5, true, true, true, true, true),
                    ('Plano 2', 10, 4, 10, true, true, true, true, true),
                    ('Plano 3', 100, 10, 100, true, true, true, true, true); 
                `); // Using generic names as placeholders, user requested Basic/Pro/Enterprise logic but we can map them.
                // Let's actually use the requested names: Basic, Profissional, Enterprise.

                await pool.query('DELETE FROM plans'); // Clear placeholders
                await pool.query(`
                    INSERT INTO plans (name, max_users, max_whatsapp_users, max_connections, max_queues, use_campaigns, use_schedules, use_internal_chat, use_external_api, use_kanban) VALUES 
                    ('Básico', 5, 5, 1, 10, true, true, true, true, true),
                    ('Avançado', 9999, 9999, 3, 9999, true, true, true, true, true);
                `);
            }

            // company_limits / usage (Though we might just query live for counts, except messages)
            // But we need to link company to plan.
            await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id)`);
            await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS due_date DATE`);
            await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) DEFAULT 'MENSAL'`); // MENSAL, ANUAL

            // Set default plan for existing companies (Basic) if null
            // First get Basic plan ID
            const basicPlan = await pool.query("SELECT id FROM plans WHERE name = 'Básico' LIMIT 1");
            if (basicPlan.rows.length > 0) {
                await pool.query("UPDATE companies SET plan_id = $1 WHERE plan_id IS NULL", [basicPlan.rows[0].id]);
            }

            // Add missing columns if they don't exist
            try {
                await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_ai_agents INTEGER DEFAULT 1`);
                await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_automations INTEGER DEFAULT 5`);
                await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_messages_month INTEGER DEFAULT 1000`);
            } catch (e) { }

            // Company Usage Tracking
            await pool.query(`
                CREATE TABLE IF NOT EXISTS company_usage (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    month_year VARCHAR(7) NOT NULL, -- 'YYYY-MM'
                    messages_count INTEGER DEFAULT 0,
                    ai_tokens_used INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(company_id, month_year)
                );
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_company_usage_period ON company_usage(company_id, month_year)');

        } catch (e) {
            console.error("Error applying plans migration:", e);
        }
        console.log("Workflows migrations finished.");
        console.log("Universal Audit logs migration finished.");
        console.log("AI Agents migrations finished.");
        console.log("WhatsApp migrations finished.");

        // Billing & Subscriptions
        console.log("Applying Billing & Subscriptions Migration...");
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id SERIAL PRIMARY KEY,
                    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                    plan_id INTEGER REFERENCES plans(id),
                    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
                    current_period_start TIMESTAMPTZ,
                    current_period_end TIMESTAMPTZ,
                    cancel_at_period_end BOOLEAN DEFAULT FALSE,
                    trial_end TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(company_id) -- One active subscription per company for now
                );
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS invoices (
                    id SERIAL PRIMARY KEY,
                    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
                    company_id INTEGER REFERENCES companies(id),
                    amount NUMERIC(10,2) NOT NULL,
                    currency CHAR(3) DEFAULT 'BRL',
                    status VARCHAR(20) NOT NULL CHECK (status IN ('paid', 'open', 'void', 'uncollectible', 'draft')),
                    due_date TIMESTAMPTZ,
                    paid_at TIMESTAMPTZ,
                    pdf_url TEXT,
                    items JSONB DEFAULT '[]', -- breakdown of charges
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            await pool.query('CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id)');
            await pool.query('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');

            console.log("Billing migrations finished.");
        } catch (e) {
            console.error("Error creating Billing tables:", e);
        }

    } catch (error) {
        console.error("Error creating WhatsApp/Admin tables:", error);
    }
};
