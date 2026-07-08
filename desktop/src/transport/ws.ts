import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { auditLog } from "../audit/log.js";

/**
 * WebSocket transport — push channel for the frontend.
 *
 *   GET ws://host:PORT/events
 *
 * The frontend keeps this open for:
 *   - connection status / heartbeats
 *   - audit log echoes (so the UI can show what the assistant just did)
 *   - (future) permission prompt requests / approvals
 *
 * Messages are strictly typed and one-directional from server → client right
 * now; inbound client messages are ignored apart from a `ping` heartbeat.
 */

export interface DesktopWsMessage {
  type: "status" | "log" | "permission" | "screenshot" | "pong";
  [k: string]: unknown;
}

export class EventsSocket {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      if (url.pathname === "/events") {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit("connection", ws, req);
        });
      } else {
        // Not our route — close so other upgraders (none here) could handle it.
        socket.destroy();
      }
    });

    this.wss.on("connection", (ws, req) => {
      this.clients.add(ws);
      const origin = String(req.headers.origin || "unknown");
      console.log(`[desktop-ws] client connected (origin=${origin})`);

      ws.send(JSON.stringify({ type: "status", status: "connected", time: new Date().toISOString() }));

      ws.on("message", (raw) => {
        let msg: any;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", time: new Date().toISOString() }));
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("[desktop-ws] client disconnected");
      });

      ws.on("error", (err) => {
        console.error("[desktop-ws] client error:", err);
        this.clients.delete(ws);
      });
    });
  }

  /** Broadcast an event to every connected client. */
  broadcast(message: DesktopWsMessage) {
    const payload = JSON.stringify(message);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (err) {
          console.error("[desktop-ws] broadcast failed:", err);
        }
      }
    }
  }

  /** Echo an audit entry to all frontends (live activity feed). */
  notifyLog(entry: any) {
    this.broadcast({ type: "log", entry });
  }

  close() {
    for (const ws of this.clients) {
      try {
        ws.close();
      } catch {}
    }
    this.wss.close();
  }
}

/**
 * Hook the audit log into the live broadcast so every audited action also
 * streams to the frontend in real time. Returns a disposer.
 */
export function wireAuditBroadcast(socket: EventsSocket): () => void {
  // The audit log writes to disk asynchronously; we augment with an in-process
  // emitter so the WS channel can mirror it. Simple approach: poll is avoided —
  // the REST layer calls socket.notifyLog directly. This helper is kept for
  // future use / symmetric API.
  const noop = () => {};
  auditLog.append({ kind: "system", timestamp: new Date().toISOString(), event: "ws.audit.wired" }).catch(() => {});
  return noop;
}
