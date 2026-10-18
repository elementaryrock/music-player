import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The historical Tidal proxy targets redirect to a GitHub repository (or no
 * longer resolve), so they must not be installed by default.  A deployment
 * can opt into a known-good proxy with VITE_TIDAL_PROXY_TARGET; the service
 * then points at /api/tidal through VITE_TIDAL_API_URL.
 */
const isKnownUnavailableTarget = (target: string): boolean => {
  try {
    const hostname = new URL(target).hostname.toLowerCase();
    return hostname === "hifi.401658.xyz" ||
      hostname === "tidal.401658.xyz" ||
      hostname === "api.allorigins.win" ||
      hostname === "github.com";
  } catch {
    return false;
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const configuredTarget = env.VITE_TIDAL_PROXY_TARGET?.trim();
  const tidalProxy = configuredTarget && !isKnownUnavailableTarget(configuredTarget)
    ? {
        "/api/tidal": {
          target: configuredTarget,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/tidal/, ""),
          secure: true,
          headers: {
            Accept: "application/json",
          },
        },
      }
    : undefined;

  return {
    plugins: [react()],
    server: {
      cors: true,
      // No Tidal proxy is created unless an explicit, non-legacy target is
      // configured.  In particular, /api/tidal-backup is intentionally gone.
      ...(tidalProxy ? { proxy: tidalProxy } : {}),
    },
  };
});
