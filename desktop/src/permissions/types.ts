import type { Permission, PermissionDecision } from "../tools/types.js";

/**
 * Permission policy knobs.
 *
 *  - "allow"  : run every action silently, log everything (DEFAULT per user choice).
 *  - "prompt" : ask the user before each sensitive action (event over WS).
 *  - "deny"   : block sensitive actions outright.
 */
export type PermissionMode = "allow" | "prompt" | "deny";

export interface PermissionConfig {
  mode: PermissionMode;
  /** Per-permission overrides, keyed by Permission. */
  overrides: Partial<Record<Permission, PermissionMode>>;
  /** When true, also writes every decision to the JSONL audit log. */
  audit: boolean;
}

export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  mode: "allow",
  overrides: {},
  audit: true,
};

export type { Permission, PermissionDecision };
