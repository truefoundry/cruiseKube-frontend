import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Temporary stub for POST /api/auth/login during local dev so the UI can call the
 * same path that will eventually be served by the backend (always succeeds).
 */
function attachDummyAuthLoginMiddleware(
  server: { middlewares: { use: (handler: (req: unknown, res: unknown, next: () => void) => void) => void } }
) {
  server.middlewares.use((req, res, next) => {
    const r = req as import("http").IncomingMessage;
    const s = res as import("http").ServerResponse;
    const pathname = (r.url ?? "").split("?")[0] ?? "";
    if (pathname !== "/api/auth/login" || r.method !== "POST") {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    r.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    r.on("end", () => {
      let username = "user";
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        if (text) {
          const body = JSON.parse(text) as { username?: string };
          if (typeof body.username === "string" && body.username.trim()) {
            username = body.username.trim();
          }
        }
      } catch {
        /* ignore malformed body; still accept login */
      }
      s.setHeader("Content-Type", "application/json");
      s.statusCode = 200;
      s.end(
        JSON.stringify({
          token: "dummy-dev-token",
          user: { id: "1", name: username },
        })
      );
    });
    r.on("error", () => {
      s.statusCode = 500;
      s.end();
    });
  });
}

function dummyAuthLoginPlugin(): Plugin {
  return {
    name: "cruisekube-dummy-auth-login",
    configureServer(server) {
      attachDummyAuthLoginMiddleware(server);
    },
    configurePreviewServer(server) {
      attachDummyAuthLoginMiddleware(server);
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    /** Allow requests when shared via ngrok (Host header is ngrok URL, not localhost). */
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
  plugins: [dummyAuthLoginPlugin(), react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
