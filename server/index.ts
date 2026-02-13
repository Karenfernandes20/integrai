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

const startServer = async () => {
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
        await pool.query(`
            INSERT INTO legal_pages (type, content) 
            VALUES ('terms', '<h2>Termos de Serviço</h2><p>Conteúdo pendente de atualização.</p>'), 
                   ('privacy', '<h2>Política de Privacidade</h2><p>Conteúdo pendente de atualização.</p>')
            ON CONFLICT (type) DO NOTHING;
        `);

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
                UPDATE whatsapp_messages
                SET conversation_id = d.main_id
                FROM conv_merging d
                JOIN whatsapp_conversations c ON c.id = whatsapp_messages.conversation_id
                WHERE c.external_id = d.external_id AND c.company_id = d.company_id AND c.id != d.main_id;
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
    console.error("Migration/DB check failed, starting server anyway for diagnostics:", err);
  }

  httpServer.listen(Number(port), "0.0.0.0", () => {
    console.log(`Server rodando na porta ${port}`);

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
      checkAndStartScheduledCampaigns(io);
      checkSubscriptions(io);
      // runEngagementChecks(); // DISABLED TEMPORARILY TO PREVENT STARTUP CRASH
      console.log("Background tasks started.");
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
