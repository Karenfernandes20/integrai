import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: "client",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt"],
      manifest: {
        name: "ViaMoveCar Admin",
        short_name: "ViaMoveCar",
        description:
          "ViaMoveCar Admin: painel central de gestão com CRM, financeiro, atendimento WhatsApp e dashboard.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0b5ed7",
        icons: [
          {
            src: "/favicon.ico",
            sizes: "32x32 48x48 64x64",
            type: "image/x-icon",
          },
        ],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
  publicDir: path.resolve(__dirname, "./public"),
}));
