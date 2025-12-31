import "./env";
import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import { pool } from "./db";
import routes from "./routes";

const app = express();
const port = process.env.PORT || 3000;

// Database connection is now handled in ./db/index.ts

app.use(cors());
app.use(express.json());

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
      const room = `company_${companyId}`;
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

// Run migrations then start server
runMigrations().then(() => {
  httpServer.listen(Number(port), "0.0.0.0", () => {
    console.log(`Server rodando na porta ${port}`);
  });
});
