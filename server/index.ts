import "./env";
import { logEvent } from "./logger";
import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import { pool } from "./db";
import routes from "./routes";
import { checkAndStartScheduledCampaigns } from "./controllers/campaignController";
import { checkSubscriptions } from "./controllers/subscriptionController";
import { runEngagementChecks } from "./controllers/engagementController";
import { processFollowUps } from "./services/followUpScheduler";
import { setSystemModeInMem, systemMode } from "./systemState";
import { checkChatbotTimeouts } from "./services/chatbotService.js";



import { systemModeMiddleware } from "./middleware/systemModeMiddleware";

const app = express();
const port = process.env.PORT || 3000;

// Database connection is now handled in ./db/index.ts

// GLOBAL ERROR HANDLERS TO PREVENT CRASH
process.on('uncaughtException', (err) => {
  console.error('========================================');
  console.error('CRITICAL ERROR (Uncaught Exception):', err);
  logEvent({
    eventType: 'system_error',
    origin: 'system',
    status: 'error',
    message: `Exceção crítica no processo: ${err.message}`,
    details: { stack: err.stack }
  });
  console.error('Server will NOT exit, but check state.');
  console.error('========================================');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('========================================');
  console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
  logEvent({
    eventType: 'system_error',
    origin: 'system',
    status: 'error',
    message: `Rejeição não tratada no processo`,
    details: { reason }
  });
  console.error('========================================');
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// APPLY SYSTEM MODE MIDDLEWARE
// app.use(systemModeMiddleware); // Removed as per request to replace with granular RBAC

app.use("/api", routes);

app.get("/api/health", async (_req, res) => {
  try {
    if (!pool) {
      return res.status(200).json({ status: "ok", database: "not_configured" });
    }

    const result = await pool.query("SELECT NOW() as now");
    return res.status(200).json({
      status: "ok",
      database: "connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Erro ao verificar banco de dados:", error);
    return res.status(500).json({ status: "error", message: "DB check failed" });
  }
});


// Serve static files from the React app
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// Serve uploads
const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use("/uploads", express.static(uploadsPath));

// 404 para rotas de API não encontradas + fallback da SPA
app.use((req, res, next) => {
  // Se começar com /api e nenhuma rota respondeu até aqui, é 404 de API
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Route not found" });
  }

  // Para qualquer outra rota GET, devolve o index.html da SPA
  if (req.method === "GET") {
    const indexPath = path.join(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      console.error(`Frontend not found at: ${indexPath}`);
      return res.status(404).send("Frontend not built. Please run 'npm run build' and ensure the dist folder exists.");
    }
    return res.sendFile(indexPath);
  }

  return next();
});

import { createServer } from "http";
import { Server } from "socket.io";
import { runMigrations } from "./db/migrations";
import { runFaqMigrations } from "./db/faqMigrations";
import { runLavajatoMigrations } from "./db/lavajato_migrations";
import { runRestaurantMigrations } from "./db/restaurant_migrations";
import { runShopMigrations } from "./db/shop_migrations";
import { runOperationalProfileMigration } from "./db/migrations/add_operational_profile";
import { runInventoryUpdateMigration } from "./db/migrations/update_inventory_columns";

// Create HTTP server
const httpServer = createServer(app);

// Configure Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Em produção, restrinja isso
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Client connected via Socket.IO:", socket.id);

  socket.on("join:company", (companyId: string | number) => {
    if (companyId) {
      // If it starts with instance_ or already has company_, use it directly
      const room = (typeof companyId === 'string' && (companyId.startsWith('instance_') || companyId.startsWith('company_')))
        ? companyId
        : `company_${companyId}`;

      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Tornar io acessível nas rotas via req.app.get('io')
app.set("io", io);

const initializeDatabase = async () => {
  try {
    // SKIP MIGRATIONS FOR MOCK TESTING (To avoid crash on DB Connect Error)
    // await runMigrations();
    // await runLavajatoMigrations();
    // await runRestaurantMigrations();
    // await runShopMigrations();
    // await runOperationalProfileMigration();
    // await runInventoryUpdateMigration();
    console.log("Migrations check skipped for offline/mock mode.");

    // INITIALIZE SYSTEM MODE (Safe Check)
    if (pool) {
      try {
        console.log("Running on-the-fly migration for Multi-Instance...");
        await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS max_instances INTEGER DEFAULT 1;`);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS company_instances (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name TEXT NOT NULL, 
                instance_key TEXT NOT NULL, 
                api_key TEXT,
                status TEXT DEFAULT 'disconnected',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(company_id, name),
                UNIQUE(instance_key)
            );
        `);
        // Campaign Instance Support Migration
        await pool.query(`ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);
        await pool.query(`ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS instance_name TEXT;`);
        await pool.query(`ALTER TABLE company_instances ADD COLUMN IF NOT EXISTS phone TEXT;`);
        await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);

        // CRM Indexing for Performance
        console.log("Creating CRM Dashboard Indexes...");
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_instance_status_date ON whatsapp_conversations(instance, status, created_at, closed_at);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_instance_date ON whatsapp_messages(instance_id, direction, sent_at);`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_followups_instance_date ON crm_follow_ups(company_id, status, scheduled_at);`);

        // Unification Migrations
        console.log("Running Unification migrations...");
        await pool.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);
        await pool.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS instance_key TEXT;`);
        await pool.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS instance_name TEXT;`);
        await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS last_instance_key TEXT;`);
        await pool.query(`ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS phone TEXT;`);

        // Instagram & Communication Channels Integration Migrations
        console.log("Running Extended Communication Channels migrations...");
        await pool.query(`
            ALTER TABLE companies
            ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS messenger_enabled BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE,
            
            -- WhatsApp Official
            ADD COLUMN IF NOT EXISTS whatsapp_type VARCHAR(50) DEFAULT 'evolution',
            ADD COLUMN IF NOT EXISTS whatsapp_official_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS whatsapp_official_phone_number_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS whatsapp_official_business_account_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS whatsapp_official_access_token TEXT,
            ADD COLUMN IF NOT EXISTS whatsapp_official_api_version VARCHAR(20) DEFAULT 'v21.0',
            ADD COLUMN IF NOT EXISTS whatsapp_official_webhook_token VARCHAR(100),
            ADD COLUMN IF NOT EXISTS evolution_url TEXT,
            
            -- WhatsApp API Plus
            ADD COLUMN IF NOT EXISTS whatsapp_api_plus_token TEXT,

            -- WhatsApp Meta / API Plus (QR Code)
            ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
            ADD COLUMN IF NOT EXISTS channel_type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS connection_mode VARCHAR(50),
            ADD COLUMN IF NOT EXISTS business_manager_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS waba_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS phone_number_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS meta_app_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS meta_app_secret TEXT,
            ADD COLUMN IF NOT EXISTS access_token TEXT,
            ADD COLUMN IF NOT EXISTS verify_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS webhook_url TEXT,
            ADD COLUMN IF NOT EXISTS callback_url TEXT,
            ADD COLUMN IF NOT EXISTS api_version VARCHAR(20) DEFAULT 'v18.0',
            ADD COLUMN IF NOT EXISTS instance_key VARCHAR(100),
            ADD COLUMN IF NOT EXISTS instance_name VARCHAR(120),
            ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30),
            ADD COLUMN IF NOT EXISTS id_numero_meta VARCHAR(100),
            ADD COLUMN IF NOT EXISTS id_conta_comercial VARCHAR(100),
            ADD COLUMN IF NOT EXISTS sandbox_mode BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS server_region VARCHAR(50) DEFAULT 'sa-east-1',
            ADD COLUMN IF NOT EXISTS receive_messages BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS receive_status BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS receive_contacts BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS receive_chat_updates BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS subscription_fields JSONB DEFAULT '["messages","messaging_postbacks","message_status","message_reactions"]'::jsonb,
            ADD COLUMN IF NOT EXISTS whatsapp_meta_status VARCHAR(40) DEFAULT 'inactive',
            ADD COLUMN IF NOT EXISTS whatsapp_meta_last_sync TIMESTAMPTZ,

            -- Instagram (Already partially exists, but ensuring completeness)
            ADD COLUMN IF NOT EXISTS instagram_app_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_app_secret VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_page_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_business_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
            ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS instagram_status VARCHAR(20) DEFAULT 'INATIVO',
            ADD COLUMN IF NOT EXISTS instagram_webhook_token VARCHAR(100),
            ADD COLUMN IF NOT EXISTS instagram_instances_config JSONB DEFAULT '[]'::jsonb,
            
            -- Messenger
            ADD COLUMN IF NOT EXISTS messenger_app_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS messenger_app_secret VARCHAR(100),
            ADD COLUMN IF NOT EXISTS messenger_page_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS messenger_access_token TEXT,
            ADD COLUMN IF NOT EXISTS messenger_webhook_token VARCHAR(100),
            ADD COLUMN IF NOT EXISTS messenger_status VARCHAR(20) DEFAULT 'INATIVO',
            ADD COLUMN IF NOT EXISTS whatsapp_limit INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS instagram_limit INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS messenger_limit INTEGER DEFAULT 1;
        `);

        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_instance_key_per_company ON companies(id, instance_key) WHERE instance_key IS NOT NULL;`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_phone_number_id_unique ON companies(phone_number_id) WHERE phone_number_id IS NOT NULL AND phone_number_id <> '';`);

        await pool.query(`
            ALTER TABLE whatsapp_conversations
            ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255),
            ADD COLUMN IF NOT EXISTS messenger_user_id VARCHAR(255);
        `);




        await pool.query(`
            ALTER TABLE whatsapp_messages
            ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS instagram_message_id VARCHAR(255);
        `);

        // Chatbot V2 Migrations
        console.log("Running Chatbot V2 migrations...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbots (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'draft',
                active_version_id INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS description TEXT;

            CREATE TABLE IF NOT EXISTS chatbot_versions (
                id SERIAL PRIMARY KEY,
                chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
                version_number INTEGER NOT NULL,
                flow_json JSONB NOT NULL DEFAULT '{}',
                is_published BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Add circular reference if not exists
            DO $$ 
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'chatbots_active_version_id_fkey') THEN
                ALTER TABLE chatbots ADD CONSTRAINT chatbots_active_version_id_fkey 
                FOREIGN KEY (active_version_id) REFERENCES chatbot_versions(id) ON DELETE SET NULL;
              END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS chatbot_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
                contact_key VARCHAR(100) NOT NULL,
                instance_key VARCHAR(100) NOT NULL,
                current_node_id VARCHAR(100),
                variables JSONB DEFAULT '{}',
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(chatbot_id, contact_key, instance_key)
            );

            CREATE TABLE IF NOT EXISTS chatbot_logs (
                id SERIAL PRIMARY KEY,
                chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
                contact_key VARCHAR(100),
                instance_key VARCHAR(100),
                node_id VARCHAR(100),
                payload_received TEXT,
                response_sent TEXT,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS chatbot_instances (
                id SERIAL PRIMARY KEY,
                chatbot_id INTEGER REFERENCES chatbots(id) ON DELETE CASCADE,
                instance_key VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(chatbot_id, instance_key)
            );
        `);

        // Legal Pages Migrations
        console.log("Running Legal Pages migrations...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS legal_pages (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL UNIQUE,
                content TEXT,
                last_updated_at TIMESTAMP DEFAULT NOW(),
                last_updated_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL
            );
        `);
        const defaultTermsContent = `
            <h2>Termos de Serviço</h2>
            <p><strong>Última atualização:</strong> 16/02/2026</p>
            <p>Estes Termos de Serviço regulam o uso da plataforma Integrai, incluindo funcionalidades de CRM, automações de atendimento, chatbot, integrações com WhatsApp/Instagram, agenda, relatórios e módulos financeiros e operacionais.</p>

            <h3>1. Aceite dos termos</h3>
            <p>Ao acessar ou utilizar a plataforma, você declara que leu, compreendeu e concorda com estes Termos e com a Política de Privacidade aplicável.</p>

            <h3>2. Cadastro e responsabilidades da conta</h3>
            <ul>
                <li>Você é responsável por manter a confidencialidade das credenciais de acesso.</li>
                <li>Você se compromete a fornecer informações verdadeiras e manter seus dados cadastrais atualizados.</li>
                <li>Você é responsável pelas ações realizadas por usuários vinculados à sua empresa/conta.</li>
            </ul>

            <h3>3. Uso permitido</h3>
            <p>É proibido utilizar a plataforma para atividades ilícitas, spam, fraude, envio de conteúdo abusivo, violação de direitos de terceiros ou em desacordo com políticas das integrações conectadas (ex.: WhatsApp e Instagram).</p>

            <h3>4. Integrações de terceiros</h3>
            <p>Algumas funcionalidades dependem de serviços de terceiros. Eventuais indisponibilidades, mudanças de API, bloqueios de conta externa ou limitações desses serviços podem impactar o funcionamento de partes da plataforma.</p>

            <h3>5. Dados inseridos na plataforma</h3>
            <p>Você mantém a titularidade dos dados de clientes, conversas, agendamentos e registros operacionais inseridos no sistema. Você declara possuir base legal para coletar e tratar tais dados, inclusive para envio de mensagens.</p>

            <h3>6. Limites, disponibilidade e melhorias</h3>
            <p>A plataforma pode adotar limites técnicos e operacionais, além de realizar atualizações evolutivas e corretivas para melhorar segurança, estabilidade e desempenho.</p>

            <h3>7. Suspensão e encerramento</h3>
            <p>Podemos suspender ou encerrar acessos em caso de violação destes Termos, uso abusivo, risco à segurança da plataforma ou determinação legal/regulatória.</p>

            <h3>8. Propriedade intelectual</h3>
            <p>O software, sua arquitetura, identidade visual e componentes da plataforma são protegidos por direitos de propriedade intelectual, vedada reprodução não autorizada.</p>

            <h3>9. Limitação de responsabilidade</h3>
            <p>A plataforma é fornecida conforme disponibilidade. Não nos responsabilizamos por perdas indiretas, lucros cessantes, bloqueios por provedores externos, falhas de conectividade de terceiros ou uso indevido por usuários autorizados da sua conta.</p>

            <h3>10. Alterações destes termos</h3>
            <p>Estes Termos podem ser atualizados periodicamente. A continuidade de uso após atualização representa concordância com a versão vigente.</p>

            <h3>11. Contato</h3>
            <p>Para dúvidas sobre estes Termos, utilize os canais oficiais de suporte da sua empresa ou administrador da conta.</p>
        `;

        const defaultPrivacyContent = `
            <h2>Política de Privacidade</h2>
            <p><strong>Última atualização:</strong> 16/02/2026</p>
            <p>Esta Política descreve como os dados pessoais são tratados na plataforma Integrai para operação de CRM, comunicação com clientes, automações e gestão de atendimento.</p>

            <h3>1. Dados que podem ser tratados</h3>
            <ul>
                <li>Dados cadastrais da conta (nome, e-mail, telefone, empresa e perfil de acesso);</li>
                <li>Dados de contatos/clientes inseridos pelos usuários (nome, telefone, e-mail e histórico de interações);</li>
                <li>Dados de mensagens e atendimentos (conteúdo, status, data/hora, origem, responsável);</li>
                <li>Dados operacionais e financeiros registrados no sistema (agendamentos, ordens, pagamentos e relatórios).</li>
            </ul>

            <h3>2. Finalidades do tratamento</h3>
            <p>Os dados são utilizados para autenticação, operação da plataforma, organização de atendimentos, execução de automações, geração de relatórios, suporte técnico, segurança e cumprimento de obrigações legais.</p>

            <h3>3. Bases legais (LGPD)</h3>
            <p>O tratamento pode ocorrer com base em execução de contrato, legítimo interesse, cumprimento de obrigação legal/regulatória e, quando aplicável, consentimento.</p>

            <h3>4. Compartilhamento de dados</h3>
            <p>Os dados podem ser compartilhados com provedores de infraestrutura, armazenamento, mensageria e integrações necessárias para execução do serviço, sempre com medidas de segurança adequadas.</p>

            <h3>5. Retenção e exclusão</h3>
            <p>Os dados são mantidos pelo período necessário às finalidades informadas e para atendimento de exigências legais. Após esse período, poderão ser excluídos ou anonimizados, ressalvadas hipóteses legais de retenção.</p>

            <h3>6. Segurança da informação</h3>
            <p>Adotamos controles técnicos e administrativos para proteger dados contra acessos não autorizados, perda, alteração ou destruição indevida.</p>

            <h3>7. Direitos do titular</h3>
            <p>Nos termos da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, eliminação quando cabível, portabilidade e informações sobre compartilhamento.</p>

            <h3>8. Responsabilidade pelo uso dos dados por clientes da plataforma</h3>
            <p>Empresas que utilizam a plataforma para gerir seus próprios clientes são responsáveis por obter base legal adequada e informar seus titulares sobre o tratamento realizado.</p>

            <h3>9. Cookies e registros de uso</h3>
            <p>A aplicação pode utilizar cookies e logs técnicos para autenticação, segurança, desempenho e auditoria de uso.</p>

            <h3>10. Alterações desta política</h3>
            <p>Esta Política poderá ser atualizada para refletir melhorias da plataforma, alterações legais e operacionais.</p>

            <h3>11. Contato sobre privacidade</h3>
            <p>Solicitações relacionadas à privacidade e proteção de dados devem ser encaminhadas pelos canais oficiais de suporte da organização responsável pela conta.</p>
        `;

        await pool.query(
          `
                INSERT INTO legal_pages (type, content)
                VALUES ($1, $2), ($3, $4)
                ON CONFLICT (type) DO NOTHING;
            `,
          ['terms', defaultTermsContent, 'privacy', defaultPrivacyContent]
        );

        await pool.query(
          `
                UPDATE legal_pages
                SET content = CASE
                    WHEN type = 'terms' THEN $1
                    WHEN type = 'privacy' THEN $2
                    ELSE content
                END,
                last_updated_at = NOW()
                WHERE content ILIKE '%Conteúdo pendente%';
            `,
          [defaultTermsContent, defaultPrivacyContent]
        );

        // Handle duplicates and update constraints
        try {
          // 0. Populate phone in whatsapp_contacts if null
          await pool.query(`UPDATE whatsapp_contacts SET phone = split_part(jid, '@', 1) WHERE phone IS NULL OR phone = '';`);
          // 1. Merge whatsapp_contacts
          await pool.query(`
                DELETE FROM whatsapp_contacts a USING whatsapp_contacts b 
                WHERE a.id < b.id AND a.jid = b.jid AND a.company_id = b.company_id;
            `);
          await pool.query(`DROP INDEX IF EXISTS idx_whatsapp_contacts_jid_instance;`);
          await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_jid_company ON whatsapp_contacts (jid, company_id);`);

          // 2. Merge whatsapp_conversations
          // Create merge map for duplicates
          await pool.query(`
                CREATE TEMP TABLE IF NOT EXISTS conv_merging AS
                SELECT external_id, company_id, MIN(id) as main_id
                FROM whatsapp_conversations
                GROUP BY external_id, company_id
                HAVING COUNT(*) > 1;
            `);

          // Re-link messages
          await pool.query(`
                UPDATE whatsapp_messages wm
                SET conversation_id = d.main_id
                FROM conv_merging d, whatsapp_conversations c
                WHERE c.id = wm.conversation_id
                  AND c.external_id = d.external_id
                  AND c.company_id = d.company_id
                  AND c.id != d.main_id;
            `);

          // Delete defunct conversations
          await pool.query(`
                DELETE FROM whatsapp_conversations c
                USING conv_merging d
                WHERE c.external_id = d.external_id AND c.company_id = d.company_id AND c.id != d.main_id;
            `);

          await pool.query(`DROP TABLE IF EXISTS conv_merging;`);

          // Remove instance-based unique constraint if exists
          // This is safer via PL/pgSQL as constraint names vary
          await pool.query(`
                DO $$ 
                DECLARE 
                    cons_name TEXT;
                BEGIN 
                    SELECT conname INTO cons_name 
                    FROM pg_constraint 
                    WHERE conrelid = 'whatsapp_conversations'::regclass AND contype = 'u' AND array_length(conkey, 1) = 2;
                    
                    IF cons_name IS NOT NULL THEN
                        EXECUTE 'ALTER TABLE whatsapp_conversations DROP CONSTRAINT ' || cons_name;
                    END IF;
                EXCEPTION WHEN OTHERS THEN 
                    NULL;
                END $$;
            `);

          // Add new unique constraint (Strict Instance Separation)
          await pool.query(`
                ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_external_id_company_id_key;
                -- Ensure old constraint is gone
                ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_external_id_instance_company_id_key;
                
                -- Add CORRECT constraint: remote_jid + instance + company_id
                ALTER TABLE whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_external_id_instance_company_id_key UNIQUE (external_id, instance, company_id);
            `);

          console.log("Unification migrations completed successfully.");
        } catch (mergeErr) {
          console.error("Error during unification merge:", mergeErr);
        }

        console.log("Multi-Instance migration completed.");

        // const { rows } = await pool.query("SELECT value FROM system_settings WHERE key = 'operational_mode'");
        // if (rows.length > 0) { ... }
        console.log("System mode check skipped for offline mode.");
      } catch (e) {
        console.error("Failed to load system mode or run migration on startup:", e);
      }
    }
  } catch (err) {
    console.error("Migration/DB check failed:", err);
  }
};

const startServer = () => {
  httpServer.listen(Number(port), "0.0.0.0", () => {
    console.log(`Server rodando na porta ${port}`);

    // Call database initialization asynchronously
    initializeDatabase().then(() => {
      console.log("Database initialized successfully.");
    }).catch(err => {
      console.error("Database initialization failed:", err);
    });

    // Start Campaign Scheduler (every minute)
    console.log("Starting Campaign Scheduler...");
    setInterval(() => {
      try {
        checkAndStartScheduledCampaigns(io);
        processFollowUps(io);
      } catch (e) { }
    }, 60000);

    // Chatbot Timeout Check (Every 10 seconds)
    setInterval(() => {
      try {
        checkChatbotTimeouts(io);
      } catch (e) { }
    }, 10000);


    // Subscription Check (Every Hour)
    setInterval(() => {
      try {
        checkSubscriptions(io);
      } catch (e) { }
    }, 3600000);

    // Run immediately on start - SAFETY WRAPPER FOR OFFLINE MODE
    try {
      console.log("Starting background tasks...");
      setTimeout(() => {
        checkAndStartScheduledCampaigns(io);
        checkSubscriptions(io);
        // runEngagementChecks(); // DISABLED TEMPORARILY TO PREVENT STARTUP CRASH
        console.log("Background tasks started.");
      }, 5000);
    } catch (bgError) {
      console.error("Failed to start background tasks:", bgError);
    }

    // Engagement Checks (Every Hour)
    setInterval(() => {
      try {
        runEngagementChecks();
      } catch (e) { console.error("Engagement check failed:", e); }
    }, 3600000);

  });
};

startServer();
