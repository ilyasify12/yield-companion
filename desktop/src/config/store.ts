import fs from "fs";
import path from "path";
import {
  DEFAULT_PERMISSION_CONFIG,
  type PermissionConfig,
  type PermissionMode,
} from "../permissions/types.js";

/**
 * Persisted service configuration.
 *
 * Stored as JSON next to the service so the operator can edit permissions,
 * allowed roots, etc. without touching environment variables. Values provided
 * via environment variables take precedence on first run / when the file is
 * absent or malformed.
 */
const CONFIG_DIR = path.join(process.cwd(), "config");
const CONFIG_FILE = path.join(CONFIG_DIR, "data.json");

export interface ServiceConfig {
  permissions: PermissionConfig;
  /** Roots the file/search tools are allowed to touch. Auto-derived if empty. */
  allowedRoots: string[];
  /** Maximum results returned by a single search invocation. */
  maxSearchResults: number;
  /** Longest edge (px) for a captured screenshot before downscaling. */
  screenshotMaxEdge: number;
  /** JPEG quality (1-100) for encoded screenshots. */
  screenshotQuality: number;
}

export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  permissions: DEFAULT_PERMISSION_CONFIG,
  allowedRoots: [],
  maxSearchResults: 50,
  screenshotMaxEdge: 1600,
  screenshotQuality: 75,
};

function readEnvMode(): PermissionMode | undefined {
  const raw = (process.env.PERMISSION_MODE || "").toLowerCase();
  if (raw === "allow" || raw === "prompt" || raw === "deny") return raw;
  return undefined;
}

function readEnvRoots(): string[] | undefined {
  const raw = process.env.ALLOWED_ROOTS || "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export function loadConfig(): ServiceConfig {
  let fileConfig: Partial<ServiceConfig> = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch (err) {
    console.warn("[config] failed to read config file, using defaults:", err);
  }

  // Environment overrides take precedence.
  const envMode = readEnvMode();
  const envRoots = readEnvRoots();

  const merged: ServiceConfig = {
    ...DEFAULT_SERVICE_CONFIG,
    ...fileConfig,
    permissions: {
      ...DEFAULT_SERVICE_CONFIG.permissions,
      ...(fileConfig.permissions || {}),
      ...(envMode ? { mode: envMode } : {}),
    },
    allowedRoots: envRoots ?? fileConfig.allowedRoots ?? DEFAULT_SERVICE_CONFIG.allowedRoots,
    maxSearchResults: fileConfig.maxSearchResults ?? DEFAULT_SERVICE_CONFIG.maxSearchResults,
    screenshotMaxEdge: fileConfig.screenshotMaxEdge ?? DEFAULT_SERVICE_CONFIG.screenshotMaxEdge,
    screenshotQuality: fileConfig.screenshotQuality ?? DEFAULT_SERVICE_CONFIG.screenshotQuality,
  };

  return merged;
}

export function saveConfig(config: ServiceConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("[config] failed to save config:", err);
  }
}
