// vite.config.ts
import { defineConfig } from "file:///C:/Users/Usuario/Desktop/KAREN/Pessoal/Integrai%20Site/integrai/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Usuario/Desktop/KAREN/Pessoal/Integrai%20Site/integrai/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///C:/Users/Usuario/Desktop/KAREN/Pessoal/Integrai%20Site/integrai/node_modules/lovable-tagger/dist/index.js";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/Usuario/Desktop/KAREN/Pessoal/Integrai%20Site/integrai/vite.config.ts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = path.dirname(__filename);
var vite_config_default = defineConfig(({ mode }) => ({
  // root: "client",
  server: {
    host: "0.0.0.0",
    // Force IPv4
    port: 8082,
    strictPort: true,
    // Fail fast instead of silently switching to another port
    // Avoid trying to open a browser automatically (breaks in headless/remote envs).
    open: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        // Force IPv4 to avoid ENETUNREACH on localhost (::1)
        changeOrigin: true,
        secure: false
      },
      "/socket.io": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        ws: true
      },
      "/uploads": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src")
    },
    dedupe: ["react", "react-dom"]
  },
  publicDir: path.resolve(__dirname, "./client/public"),
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"]
  },
  build: {
    chunkSizeWarningLimit: 5e3,
    outDir: "dist"
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc3VhcmlvXFxcXERlc2t0b3BcXFxcS0FSRU5cXFxcUGVzc29hbFxcXFxJbnRlZ3JhaSBTaXRlXFxcXGludGVncmFpXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc3VhcmlvXFxcXERlc2t0b3BcXFxcS0FSRU5cXFxcUGVzc29hbFxcXFxJbnRlZ3JhaSBTaXRlXFxcXGludGVncmFpXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Vc3VhcmlvL0Rlc2t0b3AvS0FSRU4vUGVzc29hbC9JbnRlZ3JhaSUyMFNpdGUvaW50ZWdyYWkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gXCJ1cmxcIjtcclxuXHJcbmNvbnN0IF9fZmlsZW5hbWUgPSBmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCk7XHJcbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShfX2ZpbGVuYW1lKTtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgLy8gcm9vdDogXCJjbGllbnRcIixcclxuICBzZXJ2ZXI6IHtcclxuICAgIGhvc3Q6IFwiMC4wLjAuMFwiLCAvLyBGb3JjZSBJUHY0XHJcbiAgICBwb3J0OiA4MDgyLFxyXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSwgLy8gRmFpbCBmYXN0IGluc3RlYWQgb2Ygc2lsZW50bHkgc3dpdGNoaW5nIHRvIGFub3RoZXIgcG9ydFxyXG4gICAgLy8gQXZvaWQgdHJ5aW5nIHRvIG9wZW4gYSBicm93c2VyIGF1dG9tYXRpY2FsbHkgKGJyZWFrcyBpbiBoZWFkbGVzcy9yZW1vdGUgZW52cykuXHJcbiAgICBvcGVuOiBmYWxzZSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgIFwiL2FwaVwiOiB7XHJcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6MzAwMFwiLCAvLyBGb3JjZSBJUHY0IHRvIGF2b2lkIEVORVRVTlJFQUNIIG9uIGxvY2FsaG9zdCAoOjoxKVxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBcIi9zb2NrZXQuaW9cIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjMwMDBcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgd3M6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIFwiL3VwbG9hZHNcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjMwMDBcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKV0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vY2xpZW50L3NyY1wiKSxcclxuICAgIH0sXHJcbiAgICBkZWR1cGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCJdLFxyXG4gIH0sXHJcbiAgcHVibGljRGlyOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vY2xpZW50L3B1YmxpY1wiKSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCJdLFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNTAwMCxcclxuICAgIG91dERpcjogXCJkaXN0XCIsXHJcbiAgfSxcclxufSkpO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTJYLFNBQVMsb0JBQW9CO0FBQ3haLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUI7QUFKbU4sSUFBTSwyQ0FBMkM7QUFNbFMsSUFBTSxhQUFhLGNBQWMsd0NBQWU7QUFDaEQsSUFBTSxZQUFZLEtBQUssUUFBUSxVQUFVO0FBR3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQUE7QUFBQSxFQUV6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQTtBQUFBO0FBQUEsSUFFWixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDWixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxJQUFJO0FBQUEsTUFDTjtBQUFBLE1BQ0EsWUFBWTtBQUFBLFFBQ1YsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxpQkFBaUIsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUM5RSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxXQUFXLGNBQWM7QUFBQSxJQUM3QztBQUFBLElBQ0EsUUFBUSxDQUFDLFNBQVMsV0FBVztBQUFBLEVBQy9CO0FBQUEsRUFDQSxXQUFXLEtBQUssUUFBUSxXQUFXLGlCQUFpQjtBQUFBLEVBQ3BELGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxTQUFTLGFBQWEsdUJBQXVCO0FBQUEsRUFDekQ7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLHVCQUF1QjtBQUFBLElBQ3ZCLFFBQVE7QUFBQSxFQUNWO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
