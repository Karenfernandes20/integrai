// MIGRAÇÕES PARA SISTEMA DE DISTRIBUIÇÃO E CONFIGURAÇÕES
// Execute: npx tsx server/migrations/system_settings_migration.ts

import "dotenv/config";
import { pool } from "../db/index";


async function runMigrations() {
    if (!pool) {
        console.error("❌ Pool de banco de dados não inicializado");
        process.exit(1);
    }

    console.log("🚀 Iniciando migrações do Sistema de Configurações...\n");

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Tabela system_settings
        console.log("📊 Criando tabela system_settings...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                
                -- Distribuição
                auto_distribution BOOLEAN DEFAULT false,
                distribution_type VARCHAR(50) DEFAULT 'round_robin',
                max_active_chats INTEGER DEFAULT 5,
                reassign_timeout INTEGER DEFAULT 10,
                skip_offline_users BOOLEAN DEFAULT true,
                
                -- Fila
                enable_queue BOOLEAN DEFAULT false,
                queue_max_size INTEGER DEFAULT 50,
                queue_message TEXT DEFAULT 'Você está na fila de atendimento. Aguarde alguns instantes.',
                
                -- SLA
                response_sla INTEGER DEFAULT 5,
                resolution_sla INTEGER DEFAULT 24,
                
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                
                UNIQUE(company_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_system_settings_company ON system_settings(company_id);
        `);
        console.log("✅ Tabela system_settings criada\n");

        // 2. Tabela distribution_users
        console.log("👥 Criando tabela distribution_users...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS distribution_users (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                is_active BOOLEAN DEFAULT true,
                priority INTEGER DEFAULT 2,
                max_concurrent INTEGER DEFAULT 5,
                department VARCHAR(100),
                last_assigned_at TIMESTAMP,
                total_assigned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                
                UNIQUE(company_id, user_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_distribution_users_company ON distribution_users(company_id);
            CREATE INDEX IF NOT EXISTS idx_distribution_users_active ON distribution_users(is_active);
        `);
        console.log("✅ Tabela distribution_users criada\n");

        // 3. Tabela chatbot_settings
        console.log("🤖 Criando tabela chatbot_settings...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS chatbot_settings (
                id SERIAL PRIMARY KEY,
                chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
                
                -- Retentativas
                retry_limit INTEGER DEFAULT 2,
                retry_timeout INTEGER DEFAULT 5,
                retry_message TEXT DEFAULT 'Não entendi sua resposta. Vamos tentar novamente?',
                
                -- Transferência
                transfer_after_retry BOOLEAN DEFAULT true,
                transfer_keywords TEXT,
                transfer_to_user_id INTEGER REFERENCES users(id),
                transfer_to_department VARCHAR(100),
                transfer_message TEXT DEFAULT 'Vou te encaminhar para um atendente humano.',
                
                -- Distribuição
                auto_distribute_after_flow BOOLEAN DEFAULT false,
                
                -- Horário
                business_hours_start TIME DEFAULT '08:00',
                business_hours_end TIME DEFAULT '18:00',
                business_days VARCHAR(50) DEFAULT '1,2,3,4,5',
                off_hours_message TEXT DEFAULT 'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.',
                
                -- Prioridade
                default_priority VARCHAR(20) DEFAULT 'normal',
                vip_tag VARCHAR(100),
                
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                
                UNIQUE(chatbot_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_chatbot_settings_chatbot ON chatbot_settings(chatbot_id);
        `);
        console.log("✅ Tabela chatbot_settings criada\n");

        // 4. Tabela conversation_assignments
        console.log("📋 Criando tabela conversation_assignments...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversation_assignments (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
                assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_at TIMESTAMP DEFAULT NOW(),
                assignment_type VARCHAR(50) DEFAULT 'auto',
                reason TEXT,
                
                -- Tracking
                first_response_at TIMESTAMP,
                closed_at TIMESTAMP,
                response_time INTEGER,
                resolution_time INTEGER,
                
                UNIQUE(conversation_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_conv_assignments_assigned_to ON conversation_assignments(assigned_to);
            CREATE INDEX IF NOT EXISTS idx_conv_assignments_conversation ON conversation_assignments(conversation_id);
        `);
        console.log("✅ Tabela conversation_assignments criada\n");

        // 5. Tabela chatbot_retry_log
        console.log("🔄 Criando tabela chatbot_retry_log...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS chatbot_retry_log (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
                chatbot_id INTEGER,
                step_id VARCHAR(255),
                retry_count INTEGER DEFAULT 0,
                last_retry_at TIMESTAMP DEFAULT NOW(),
                transferred BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_chatbot_retry_conversation ON chatbot_retry_log(conversation_id);
        `);
        console.log("✅ Tabela chatbot_retry_log criada\n");

        // 6. Adicionar colunas em whatsapp_conversations
        console.log("🔧 Adicionando colunas em whatsapp_conversations...");
        await client.query(`
            ALTER TABLE whatsapp_conversations 
            ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        `);

        await client.query(`
            ALTER TABLE whatsapp_conversations 
            ADD COLUMN IF NOT EXISTS queue_position INTEGER;
        `);

        await client.query(`
            ALTER TABLE whatsapp_conversations 
            ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
        `);

        await client.query(`
            ALTER TABLE whatsapp_conversations 
            ADD COLUMN IF NOT EXISTS department VARCHAR(100);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_conv_assigned_user ON whatsapp_conversations(assigned_user_id);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_conv_priority ON whatsapp_conversations(priority);
        `);
        console.log("✅ Colunas adicionadas em whatsapp_conversations\n");

        // 7. Criar configuração padrão para empresas existentes
        console.log("⚙️ Criando configurações padrão...");
        await client.query(`
            INSERT INTO system_settings (company_id)
            SELECT id FROM companies
            WHERE id NOT IN (SELECT company_id FROM system_settings WHERE company_id IS NOT NULL)
            ON CONFLICT (company_id) DO NOTHING;
        `);
        console.log("✅ Configurações padrão criadas\n");

        await client.query('COMMIT');

        console.log("🎉 MIGRAÇÕES CONCLUÍDAS COM SUCESSO!\n");
        console.log("📋 Tabelas criadas:");
        console.log("   - system_settings");
        console.log("   - distribution_users");
        console.log("   - chatbot_settings");
        console.log("   - conversation_assignments");
        console.log("   - chatbot_retry_log");
        console.log("\n✨ Sistema de Distribuição está pronto para uso!");

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Erro durante migração:", error);
        throw error;
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

runMigrations().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});

