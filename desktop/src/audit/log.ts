/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal audit logging — writes structured JSONL entries to a local file.
 */

import { appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ── Types ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  kind: "tool" | "permission" | "system";
  timestamp: string;
  /** Optional fields carried by specific entry kinds. */
  tool?: string;
  origin?: string;
  ok?: boolean;
  summary?: string;
  startedAt?: string;
  args?: any;
  event?: string;
  /** Permission-specific */
  permission?: string;
  granted?: boolean;
  outcome?: string;
  reason?: string;
}

// ── Logger ────────────────────────────────────────────────────────────

const LOG_DIR = path.join(process.cwd(), "audit");
const LOG_FILE = path.join(LOG_DIR, "audit.jsonl");

function ensureDir() {
  if (!existsSync(LOG_DIR)) {
    mkdir(LOG_DIR, { recursive: true }).catch(() => {});
  }
}

export const auditLog = {
  /** Write one entry to the audit log (fire-and-forget, never throws). */
  async append(entry: AuditEntry): Promise<void> {
    ensureDir();
    try {
      await appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
    } catch {
      // audit logging must never crash the app
    }
  },
};
