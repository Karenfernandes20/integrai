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
app.use(express.json());

// APPLY SYSTEM MODE MIDDLEWARE
app.use(systemModeMiddleware);

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

        // Unification Migrations
        console.log("Running Unification migrations...");
        await pool.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS instance_id INTEGER REFERENCES company_instances(id) ON DELETE SET NULL;`);
        await pool.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS instance_key TEXT;`);
        await pool.query(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS instance_name TEXT;`);
        await pool.query(`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS last_instance_key TEXT;`);
        await pool.query(`ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS phone TEXT;`);

        // Instagram Integration Migrations
        console.log("Running Instagram Integration migrations...");
        await pool.query(`
            ALTER TABLE companies
            ADD COLUMN IF NOT EXISTS instagram_enabled BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS instagram_app_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_app_secret VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_page_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_business_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
            ADD COLUMN IF NOT EXISTS instagram_token_expires_at TIMESTAMP;
        `);
        await pool.query(`
            ALTER TABLE whatsapp_conversations
            ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS instagram_user_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS instagram_username VARCHAR(255);
        `);
        await pool.query(`
            ALTER TABLE whatsapp_messages
            ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS instagram_message_id VARCHAR(255);
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
                UPDATE whatsapp_messages m
                SET conversation_id = d.main_id
                FROM conv_merging d
                JOIN whatsapp_conversations c ON c.id = m.conversation_id
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

          // Add new unique constraint
          await pool.query(`
                ALTER TABLE whatsapp_conversations DROP CONSTRAINT IF EXISTS whatsapp_conversations_external_id_company_id_key;
                ALTER TABLE whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_external_id_company_id_key UNIQUE (external_id, company_id);
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
      processFollowUps(io);
      checkSubscriptions(io);
      runEngagementChecks();
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
