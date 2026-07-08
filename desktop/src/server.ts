#!/usr/bin/env tsx
/**
 * YIELD COMPANION Desktop Service — entry point.
 *
 * A local-only Express + WebSocket service that exposes the desktop tool
 * API to the frontend.  Run with:
 *
 *   npm run dev    (hot-reload via tsx watch)
 *   npm start      (plain tsx)
 *
 * All privileged operations go through the ToolManager, which validates
 * parameters (zod) and enforces the permission policy (allow + audit).
 *
 * NOTE: Tools (including screen.ts → sharp) are loaded lazily. If sharp
 * or another native module fails, the WebSocket + wake word detection
 * still function — only PC control / screen tools degrade.
 */

import dotenv from "dotenv";
import express from "express";
import http from "http";
import cors from "cors";
import path from "path";

// ── Load .env from multiple locations ────────────────────────────────────────
// This ensures GEMINI_API_KEY (and other vars) are available to spawned tools.
dotenv.config({ path: path.join(process.cwd(), ".env") });
// Also check the user's appData location (for production packaged Electron)
const possibleEnvPaths = [
  process.env.DESKTOP_ENV_PATH,                    // Explicit path from parent
  path.join(process.cwd(), ".env"),                 // cwd (resources/desktop/ in prod)
  path.resolve(process.cwd(), "..", "..", ".env"), // two levels up (resources/ in prod)
  path.join(process.env.APPDATA || "", "YIELD COMPANION", ".env"), // %APPDATA%
  path.join(process.env.LOCALAPPDATA || "", "YIELD COMPANION", ".env"), // %LOCALAPPDATA%
].filter(Boolean);
for (const envPath of [...new Set(possibleEnvPaths)]) {
  dotenv.config({ path: envPath });
}

import { EventsSocket } from "./transport/ws.js";
import { auditLog, type AuditEntry } from "./audit/log.js";
import { startWakeWordDetection, stopWakeWordDetection } from "./tools/modules/wakeword.js";

const PORT = parseInt(process.env.DESKTOP_PORT || "3001", 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ── Tool system (lazy loaded) ────────────────────────────────────────────────
// Screen.ts imports sharp (native module) which may fail. We load tools
// lazily so the WebSocket + wake word keep working even if tools degrade.

let toolManager: any = null;
let permissions: any = null;
let toolsLoaded = false;

async function loadTools() {
  if (toolsLoaded) return true;
  try {
    const tools = await import("./tools/index.js");
    toolManager = tools.toolManager;
    permissions = tools.permissions;
    toolsLoaded = true;
    console.log(`[desktop] Loaded ${toolManager.list().length} desktop tools`);
    return true;
  } catch (err: any) {
    console.warn("[desktop] Tool system unavailable:", err?.message);
    // Create stub instances so the server doesn't crash
    const { ToolManager } = await import("./tools/registry.js").catch(() => ({ ToolManager: null }));
    const { PermissionManager } = await import("./permissions/manager.js").catch(() => ({ PermissionManager: null }));
    if (ToolManager && PermissionManager) {
      permissions = new PermissionManager();
      toolManager = new ToolManager(permissions);
      toolsLoaded = true;
    }
    return false;
  }
}

// --- bootstrap --------------------------------------------------------------

const app = express();
const server = http.createServer(app);

// CORS — restrict to the voice-app origin in production.
const corsOpts: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Allow when there's no origin (e.g. server-to-server calls, curl).
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`Origin ${origin} not allowed`));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};
app.use(cors(corsOpts));
app.options("*", cors(corsOpts));

// --- API routes (must be set up after tools load) ---------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, tools: toolsLoaded ? toolManager?.list().length ?? 0 : "loading" });
});

// --- WebSocket events -------------------------------------------------------

const eventsSocket = new EventsSocket(server);

// Wire audit echoes so the WS broadcasts every tool execution to the frontend.
// The REST router already logs to audit; we hook the broadcast here via a
// simple monkey-patch on auditLog.append.
const origAppend = auditLog.append.bind(auditLog);
auditLog.append = async (entry: AuditEntry) => {
  await origAppend(entry);
  if (entry.kind === "tool" || entry.kind === "permission") {
    eventsSocket.notifyLog(entry);
  }
};

// --- lifecycle --------------------------------------------------------------

server.listen(PORT, "127.0.0.1", async () => {
  console.log(`\n  ⬡  YIELD COMPANION Desktop Service running on http://127.0.0.1:${PORT}`);
  console.log(`     CORS origins : ${ALLOWED_ORIGINS.join(", ") || "open"}`);
  console.log(`     Tools       : loading…`);
  console.log(`     Permission  : pending`);
  console.log(`     Audit log   : ${path.join(process.cwd(), "audit", "audit.jsonl")}\n`);

  // Start wake-word detection via Windows Speech API (Electron fallback)
  // This listens for "Mia" or "James" and notifies the frontend via WS.
  // We start this BEFORE tools so it works even if sharp fails.
  if (process.platform === "win32" && process.env.WAKEWORD !== "false") {
    try {
      const broadcast = (msg: any) => eventsSocket.broadcast(msg);
      startWakeWordDetection(
        (companion) => {
          console.log(`[server] Wake word detected: "${companion}" — broadcasting`);
        },
        broadcast
      );
      console.log(`     Wake word   : active (Mia / James)`);
    } catch (err) {
      console.warn("[server] Failed to start wake-word detection:", err);
    }
  }

  // Load tools lazily (non-blocking for server startup)
  await loadTools();
  if (toolsLoaded && toolManager) {
    console.log(`\n  ✓  Tools ready: ${toolManager.list().length} registered`);

    // Mount the REST API router now that tools are loaded
    const { createApiRouter } = await import("./transport/rest.js");
    const routes = createApiRouter(toolManager, AbortSignal.abort());
    app.use("/api", routes);
  }

  // Catch-all 404 — must come AFTER all other routes
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: "Not found. Try /api/health or /api/tools." });
  });
});

// Graceful shutdown.
process.on("SIGINT", () => {
  console.log("\n[desktop] SIGINT — shutting down…");
  stopWakeWordDetection();
  eventsSocket.close();
  server.close(() => {
    console.log("[desktop] server closed.");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n[desktop] SIGTERM — shutting down…");
  stopWakeWordDetection();
  eventsSocket.close();
  server.close(() => {
    console.log("[desktop] server closed.");
    process.exit(0);
  });
});
