import type { Permission } from "../tools/types.js";
import {
  DEFAULT_PERMISSION_CONFIG,
  type PermissionConfig,
  type PermissionDecision,
  type PermissionMode,
} from "./types.js";
import { auditLog } from "../audit/log.js";

/**
 * Evaluates whether a given permission may be exercised.
 *
 * In the default "allow" mode this always permits (and records an audit entry),
 * so the experience is frictionless — but every privileged call is still
 * observable. The plumbing for "prompt" / "deny" is fully in place so the
 * operator can harden the policy via config without touching tool code.
 */
export class PermissionManager {
  private config: PermissionConfig;

  constructor(config: PermissionConfig = DEFAULT_PERMISSION_CONFIG) {
    this.config = { ...config };
  }

  update(config: Partial<PermissionConfig>) {
    this.config = { ...this.config, ...config };
  }

  get current(): PermissionConfig {
    return this.config;
  }

  /** Resolve the effective mode for a specific permission (override wins). */
  effectiveMode(permission: Permission): PermissionMode {
    return this.config.overrides[permission] ?? this.config.mode;
  }

  /**
   * Decide whether `permission` may proceed for the given tool/origin.
   * Returns a structured decision consumed by the tool context.
   */
  evaluate(
    permission: Permission,
    opts: { tool: string; origin: string; args?: any }
  ): PermissionDecision {
    const mode = this.effectiveMode(permission);

    if (mode === "deny") {
      const decision: PermissionDecision = {
        outcome: "deny",
        reason: "Permission policy is set to deny for this action",
        permission,
      };
      this.record(decision, opts);
      return decision;
    }

    // "allow" and "prompt" both result in execution here. The difference is
    // purely UI-side in the current implementation: when mode === "prompt",
    // the frontend would surface a confirmation. For the chosen "allow" default
    // we proceed silently and rely on the audit log for observability.
    const decision: PermissionDecision = {
      outcome: "allow",
      reason: mode === "prompt" ? "Allowed (prompt mode acknowledged)" : "Allowed by policy",
      permission,
    };
    this.record(decision, opts);
    return decision;
  }

  private record(
    decision: PermissionDecision,
    opts: { tool: string; origin: string; args?: any }
  ) {
    if (!this.config.audit) return;
    auditLog.append({
      kind: "permission",
      timestamp: new Date().toISOString(),
      tool: opts.tool,
      origin: opts.origin,
      permission: decision.permission,
      outcome: decision.outcome,
      reason: decision.reason,
      args: redactArgs(opts.args),
    }).catch((err) => console.error("[audit] failed to log permission:", err));
  }
}

/** Best-effort redaction of obviously sensitive fields before logging. */
function redactArgs(args: any): any {
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
