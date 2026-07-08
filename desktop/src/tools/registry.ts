import type { Tool, ToolContext, ToolResult } from "./types.js";
import { ToolError } from "./types.js";
import { z } from "zod";
import type { PermissionManager } from "../permissions/manager.js";

/**
 * A declaration in the shape Gemini's Live API expects for `tools`.
 * Exported so the voice server can merge desktop tools with its own.
 */
export interface LiveFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * The central registry for all desktop capabilities.
 *
 * Responsibilities:
 *  - register / resolve tools by name
 *  - emit the merged Gemini function declarations
 *  - validate inbound args with a per-tool zod schema before dispatch
 *  - enforce the permission decision encoded in the ToolContext
 */
export class ToolManager {
  private tools = new Map<string, Tool>();
  private schemas = new Map<string, z.ZodTypeAny>();
  private permissions: PermissionManager;

  constructor(permissions: PermissionManager) {
    this.permissions = permissions;
  }

  /** Register a tool and (optionally) its zod validation schema. */
  register(tool: Tool, schema?: z.ZodTypeAny): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    if (schema) this.schemas.set(tool.name, schema);
    return this;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  resolve(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** Build the Gemini `functionDeclarations` array for all registered tools. */
  toLiveDeclarations(): LiveFunctionDeclaration[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  /**
   * Validate args against the registered schema (if any) and run the handler.
   * Any permission the tool exercises must be "allow" in the context, else the
   * call is rejected before the handler runs.
   */
  async execute(
    name: string,
    args: any,
    ctx: ToolContext
  ): Promise<ToolResult> {
    const tool = this.resolve(name);
    if (!tool) {
      return {
        ok: false,
        output: { error: `Unknown tool: ${name}` },
        summary: `Unknown tool: ${name}`,
      };
    }

    // Permission gate: context carries the resolved decision for the FIRST
    // permission the tool exercises. (Most tools exercise exactly one.)
    if (ctx.permission.outcome === "deny") {
      const denied: ToolResult = {
        ok: false,
        output: {
          error: "Permission denied",
          reason: ctx.permission.reason,
          permission: ctx.permission.permission,
        },
        summary: `Denied: ${ctx.permission.reason}`,
      };
      return denied;
    }

    // Validate parameters.
    const schema = this.schemas.get(name);
    let validated = args || {};
    if (schema) {
      const parsed = schema.safeParse(args);
      if (!parsed.success) {
        return {
          ok: false,
          output: {
            error: "Invalid parameters",
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          summary: `Invalid parameters for ${name}`,
        };
      }
      validated = parsed.data;
    }

    try {
      const result = await tool.handler(validated, ctx);
      return result;
    } catch (err: any) {
      if (err instanceof ToolError) {
        return { ok: false, output: { error: err.message, code: err.code }, summary: err.message };
      }
      console.error(`[tool] ${name} threw:`, err);
      return {
        ok: false,
        output: { error: err?.message || "Tool execution failed" },
        summary: err?.message || "Tool execution failed",
      };
    }
  }

  /** Convenience: resolve permissions for a tool and execute in one call. */
  async invoke(
    name: string,
    args: any,
    opts: { origin: string; signal: AbortSignal }
  ): Promise<ToolResult> {
    const tool = this.resolve(name);
    if (!tool) {
      return { ok: false, output: { error: `Unknown tool: ${name}` }, summary: `Unknown tool: ${name}` };
    }
    // Evaluate every permission the tool exercises; deny if any is denied.
    let decision = ctxAllow("system.info");
    for (const perm of tool.permissions) {
      const d = this.permissions.evaluate(perm, { tool: name, origin: opts.origin, args });
      if (d.outcome === "deny") {
        decision = d;
        break;
      }
      decision = d;
    }
    const ctx: ToolContext = { origin: opts.origin, permission: decision, signal: opts.signal };
    return this.execute(name, args, ctx);
  }
}

function ctxAllow(permission: any): any {
  return { outcome: "allow" as const, reason: "No permissions required", permission };
}
