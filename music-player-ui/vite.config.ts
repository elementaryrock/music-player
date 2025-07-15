import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    proxy: {
      "/api/tidal": {
        target: "https://tidal.401658.xyz",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tidal/, ""),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            // console.log("Tidal proxy error:", err);
          });
          proxy.on("proxyReq", (_proxyReq, _req, _res) => {
            // console.log("Sending Request to Tidal:", req.method, req.url);
          });
          proxy.on("proxyRes", (_proxyRes, _req, _res) => {
            // console.log(
            //   "Received Response from Tidal:",
            //   proxyRes.statusCode,
            //   req.url
            // );
          });
        },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
      "/api/tidal-backup": {
        target: "https://hifi-04ed2aaea09a.herokuapp.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tidal-backup/, ""),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on("error", (_err, _req, _res) => {
            // console.log("Tidal backup proxy error:", err);
          });
          proxy.on("proxyReq", (_proxyReq, _req, _res) => {
            // console.log(
            //   "Sending Request to Tidal Backup:",
            //   req.method,
            //   req.url
            // );
          });
          proxy.on("proxyRes", (_proxyRes, _req, _res) => {
            // console.log(
            //   "Received Response from Tidal Backup:",
            //   proxyRes.statusCode,
            //   req.url
            // );
          });
        },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
    },
  },
});
