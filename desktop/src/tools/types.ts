/**
 * Core tool contracts for the YIELD COMPANION Desktop Service.
 *
 * Every desktop capability implements the `Tool` interface and is registered
 * with the ToolManager. The ToolManager exposes the merged set of tool
 * declarations to the AI (via the voice server) and routes inbound REST
 * invocations to the correct handler.
 */

/** A Gemini-compatible JSON schema fragment describing a single parameter. */
export interface ParameterSchema {
  type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY" | "OBJECT";
  description: string;
  enum?: string[];
  items?: ParameterSchema;
  properties?: Record<string, ParameterSchema>;
  required?: string[];
}

/** The `parameters` field of a Gemini function declaration. */
export interface ParametersSchema {
  type: "OBJECT";
  properties: Record<string, ParameterSchema>;
  required?: string[];
}

/** A single registered capability exposed to the AI and the REST API. */
export interface Tool {
  /** Stable, unique tool name (camelCase, e.g. `openFolder`). */
  name: string;
  /** Human-readable description consumed by the model when choosing a tool. */
  description: string;
  /** JSON schema describing the tool's arguments. */
  parameters: ParametersSchema;
  /** Permissions this tool exercises. Evaluated by the PermissionManager. */
  permissions: Permission[];
  /** Executes the tool with validated arguments. */
  handler: (args: any, ctx: ToolContext) => Promise<ToolResult>;
}

/** Result returned by every tool handler. */
export interface ToolResult {
  ok: boolean;
  /** Structured payload — forwarded to the AI as the tool output. */
  output: any;
  /**
   * Optional inline media to deliver alongside the result (e.g. a screenshot).
   * The transport layer streams this to the frontend for AI vision injection.
   */
  media?: { mimeType: string; base64: string };
  /** Human-readable summary for the audit log and toast UI. */
  summary?: string;
}

/** Runtime context handed to each handler. */
export interface ToolContext {
  /** The origin that initiated the call (REST origin or socket id). */
  origin: string;
  /** Resolved/validated permission decision for this invocation. */
  permission: PermissionDecision;
  /** AbortSignal for graceful shutdown / cancellation. */
  signal: AbortSignal;
}

/** Permission identifiers — what a sensitive tool exercises. */
export type Permission =
  | "screen.capture"
  | "app.launch"
  | "file.open"
  | "file.search"
  | "clipboard.read"
  | "clipboard.write"
  | "system.info"
  | "pc.control"
  | "media.control";

/** The resolved decision for a given invocation. */
export interface PermissionDecision {
  /** What was decided. */
  outcome: "allow" | "deny";
  /** Why (used by the audit log). */
  reason: string;
  /** The permission that was evaluated. */
  permission: Permission;
}

/** Standard error shapes a tool may produce. */
export class ToolError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ToolError";
    this.code = code;
  }
}
