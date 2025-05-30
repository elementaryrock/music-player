import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/tidal": {
        target: "https://tidal.401658.xyz",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tidal/, ""),
        secure: true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
      "/api/tidal-backup": {
        target: "https://hifi-04ed2aaea09a.herokuapp.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tidal-backup/, ""),
        secure: true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
    },
  },
});
