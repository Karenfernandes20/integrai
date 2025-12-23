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
    port: 8080,
    open: true,
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
}));
