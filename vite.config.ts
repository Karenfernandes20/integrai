import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // root: "client",
  server: {
    host: true,
    port: 8082,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
    dedupe: ["react", "react-dom"],
  },
  publicDir: path.resolve(__dirname, "./client/public"),
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    outDir: "dist",
  },
}));
