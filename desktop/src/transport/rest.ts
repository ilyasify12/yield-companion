import { Router, type Request, type Response, type NextFunction } from "express";
import type { ToolManager } from "../tools/registry.js";
import { auditLog } from "../audit/log.js";

/**
 * REST transport.
 *
 *   GET  /api/health             -> liveness + capability list
 *   GET  /api/tools              -> registered tool declarations
 *   POST /api/tools/:name        -> execute a tool
 *   GET  /api/config             -> current service config (non-secret)
 *
 * The POST handler resolves the tool, invokes it through the ToolManager
 * (which applies schema validation + permission gating), and returns a
 * structured JSON result. Screen-capture tools additionally carry a `media`
 * field; the frontend handles forwarding it as a vision frame.
 */
export function createApiRouter(tools: ToolManager, signal: AbortSignal): Router {
  const router = Router();

  // Lightweight JSON body parser scoped to /api only (mounted in server.ts).
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "POST") return next();
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        // 5MB cap; screenshots are responses, not requests.
        data = "";
        res.status(413).json({ ok: false, error: "Request body too large." });
        req.destroy();
        return;
      }
    });
    req.on("end", () => {
      if (!data) {
        (req as any).body = {};
        next();
        return;
      }
      try {
        (req as any).body = JSON.parse(data);
        next();
      } catch {
        res.status(400).json({ ok: false, error: "Invalid JSON body." });
      }
    });
  });

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "yield-companion-desktop-service",
      version: "1.0.0",
      platform: process.platform,
      uptime: process.uptime(),
      toolCount: tools.list().length,
    });
  });

  router.get("/tools", (_req, res) => {
    res.json({
      status: "ok",
      tools: tools.toLiveDeclarations(),
    });
  });

  router.post("/tools/:name", async (req, res) => {
    const name = req.params.name;
    const args = (req as any).body ?? {};
    const origin = String(req.headers.origin || req.ip || "unknown");

    if (!tools.has(name)) {
      res.status(404).json({ ok: false, error: `Unknown tool: ${name}` });
      return;
    }

    const startedAt = new Date().toISOString();
    const result = await tools.invoke(name, args, { origin, signal });
    const finishedAt = new Date().toISOString();

    auditLog
      .append({
        kind: "tool",
        timestamp: finishedAt,
        tool: name,
        origin,
        ok: result.ok,
        summary: result.summary,
        startedAt,
        args: redact(args),
      })
      .catch((e) => console.error("[audit] tool log failed:", e));

    res.json(result);
  });

  return router;
}

function redact(args: any): any {
  if (!args || typeof args !== "object") return args;
  try {
    const clone = JSON.parse(JSON.stringify(args));
    for (const key of Object.keys(clone)) {
      if (/token|secret|password|api[_-]?key/i.test(key)) clone[key] = "[redacted]";
    }
    return clone;
  } catch {
    return "[unserializable]";
  }
}
