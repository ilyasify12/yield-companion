/**
 * Desktop Service Client
 *
 * Singleton that communicates with the YIELD COMPANION Desktop Service (localhost:3001).
 * Provides:
 *   - REST POST /api/tools/:name for tool execution
 *   - Auto-reconnecting WebSocket to /events for status/broadcasts
 *
 * The client is resilient to the desktop service being offline — all REST
 * calls gracefully return an error result instead of throwing.
 */

const DESKTOP_BASE = "http://127.0.0.1:3001";
const WS_URL = "ws://127.0.0.1:3001/events";

export type DesktopConnectionState = "connected" | "disconnected" | "error";

export interface DesktopEvent {
  type: "status" | "log" | "permission" | "screenshot" | "pong" | "wakeword";
  status?: string;
  companion?: string;
  [k: string]: unknown;
}

export type EventCallback = (event: DesktopEvent) => void;

class DesktopClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _state: DesktopConnectionState = "disconnected";
  private listeners = new Set<EventCallback>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseUrl: string;

  constructor(baseUrl: string = DESKTOP_BASE) {
    this.baseUrl = baseUrl;
  }

  get state(): DesktopConnectionState {
    return this._state;
  }

  /** Subscribe to events. Returns an unsubscribe function. */
  onEvent(cb: EventCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(event: DesktopEvent) {
    for (const cb of this.listeners) cb(event);
  }

  /**
   * Call a desktop tool via REST.
   * Always returns a structured result — never throws.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    try {
      const url = `${this.baseUrl}/api/tools/${encodeURIComponent(name)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          ok: false,
          output: { error: body.error || `HTTP ${res.status}` },
          summary: `HTTP ${res.status}`,
        };
      }
      return await res.json();
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        return {
          ok: false,
          output: { error: "Desktop service timed out" },
          summary: "Desktop service timed out",
        };
      }
      return {
        ok: false,
        output: { error: err?.message || "Desktop service unreachable" },
        summary: "Desktop service unreachable",
      };
    }
  }

  /** Connect the event WebSocket with exponential-backoff reconnection. */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.connectWs();
  }

  private connectWs() {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log("[desktop-client] Event WS connected");
        this._state = "connected";
        this.reconnectAttempts = 0;
        this.emit({ type: "status", status: "connected" as any });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as DesktopEvent;
          this.emit(data);
        } catch {
          // ignore malformed frames
        }
      };

      this.ws.onclose = () => {
        console.log("[desktop-client] Event WS disconnected");
        this._state = "disconnected";
        this.emit({ type: "status", status: "disconnected" as any });
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        console.error("[desktop-client] Event WS error");
        this._state = "error";
        this.emit({ type: "status", status: "error" as any });
        // onclose will fire next, triggering reconnect
      };
    } catch (err) {
      console.error("[desktop-client] Failed to create WS:", err);
      this._state = "error";
      this.emit({ type: "status", status: "error" as any });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[desktop-client] Max reconnect attempts reached — giving up");
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    console.log(
      `[desktop-client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, delay);
  }

  /** Reset reconnect attempts so connect() retries with full backoff. */
  resetReconnect() {
    this.reconnectAttempts = 0;
  }

  /** Disconnect the WS and stop reconnecting. */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._state = "disconnected";
    this.emit({ type: "status", status: "disconnected" as any });
  }
}

/** Application-wide singleton. Created lazily on first import. */
export const desktopClient = new DesktopClient();
