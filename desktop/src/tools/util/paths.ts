import fs from "fs";
import os from "os";
import path from "path";
import { ToolError } from "../types.js";
import { loadConfig } from "../../config/store.js";

/**
 * Path safety + well-known location helpers.
 *
 * All file/folder tools resolve user-supplied paths here so that:
 *   - relative paths are anchored against an allowed root (never CWD)
 *   - path traversal (`..`, symlink escapes) is rejected
 *   - the common user folders are discoverable by friendly name
 */

export interface CommonFolder {
  key: string;
  /** Friendly names the AI / user may use (lowercased). */
  aliases: string[];
  path: string;
}

/** Resolve the OS-native "known folder" paths. Windows-first, with stubs. */
export function getCommonFolders(): CommonFolder[] {
  const home = os.homedir();
  const folders: CommonFolder[] = [
    { key: "home", aliases: ["home", "user", "user folder", "profile"], path: home },
    { key: "desktop", aliases: ["desktop"], path: path.join(home, "Desktop") },
    { key: "documents", aliases: ["documents", "docs", "my documents"], path: path.join(home, "Documents") },
    { key: "downloads", aliases: ["downloads", "downloads folder"], path: path.join(home, "Downloads") },
    { key: "pictures", aliases: ["pictures", "photos", "images"], path: path.join(home, "Pictures") },
    { key: "videos", aliases: ["videos", "movies", "films"], path: path.join(home, "Videos") },
    { key: "music", aliases: ["music", "audio", "songs"], path: path.join(home, "Music") },
  ];

  // On Windows, prefer the real Known Folder paths when available via env.
  if (process.platform === "win32") {
    const userprofile = process.env.USERPROFILE;
    if (userprofile) {
      // USERPROFILE-based defaults are reliable on every modern Windows build.
      folders[0].path = userprofile;
    }
  }

  return folders;
}

/** Look up a common folder by key or friendly alias (case-insensitive). */
export function resolveCommonFolder(name: string): CommonFolder | undefined {
  const n = name.trim().toLowerCase();
  return getCommonFolders().find((f) => f.key === n || f.aliases.includes(n));
}

/**
 * The set of roots the file tools are permitted to touch.
 * Defaults to the common user folders (plus any configured ALLOWED_ROOTS).
 */
export function getAllowedRoots(): string[] {
  const cfg = loadConfig();
  if (cfg.allowedRoots.length) return cfg.allowedRoots.map(normalize);
  return getCommonFolders().map((f) => normalize(f.path));
}

/** Normalize a path for comparison (resolve, lowercase on Windows). */
export function normalize(p: string): string {
  const resolved = path.resolve(p);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/**
 * Resolve a user-supplied path into an absolute, traversal-safe path.
 *
 * Rules:
 *   - Absolute paths are accepted only if they fall within an allowed root,
 *     UNLESS `allowAnyAbsolute` is set (for explicit user paths in tools like
 *     search-then-open, where the path came from our own search results).
 *   - Relative paths are anchored against an allowed root if they name a
 *     common folder, otherwise rejected.
 *   - `..` segments that escape the chosen root are rejected.
 *
 * Throws ToolError("path_denied" | "path_not_found") on failure.
 */
export function safeResolve(
  input: string,
  opts: { allowAnyAbsolute?: boolean; mustExist?: boolean } = {}
): string {
  if (!input || typeof input !== "string" || !input.trim()) {
    throw new ToolError("path_denied", "A file or folder path is required.");
  }

  const raw = input.trim();

  // First, reject obvious traversal attempts regardless of root.
  const rooted = path.resolve(raw);
  const containsTraversal = raw.split(/[\\/]/).some((seg) => seg === "..");
  if (containsTraversal) {
    throw new ToolError(
      "path_denied",
      "Path traversal ('..') is not permitted."
    );
  }

  // If the caller allows arbitrary absolute paths (e.g. reopening a path our
  // own search returned), trust it but still normalize.
  if (opts.allowAnyAbsolute && path.isAbsolute(raw)) {
    return checkExists(rooted, opts.mustExist);
  }

  // Absolute path: must live under an allowed root.
  if (path.isAbsolute(raw)) {
    const allowedRoots = getAllowedRoots();
    const normRooted = normalize(rooted);
    const inside = allowedRoots.some((root) => isWithin(rooted, root));
    if (!inside) {
      throw new ToolError(
        "path_denied",
        `Path is outside the allowed user folders: ${rooted}`
      );
    }
    return checkExists(rooted, opts.mustExist);
  }

  // Relative path: try to read it as a common-folder alias first.
  const folder = resolveCommonFolder(raw);
  if (folder) {
    return checkExists(folder.path, opts.mustExist);
  }

  // Relative path that is not an alias: anchor under each allowed root and
  // accept the first existing match (lets the AI say "open resume.pdf").
  for (const root of getAllowedRoots()) {
    const candidate = path.join(root, raw);
    if (fs.existsSync(candidate)) {
      const normCandidate = normalize(candidate);
      if (normCandidate === normalize(root) || normCandidate.startsWith(normalize(root) + path.sep)) {
        return candidate;
      }
    }
  }

  throw new ToolError(
    "path_not_found",
    `Could not resolve "${raw}" within the allowed user folders.`
  );
}

/** True if `target` is equal to or strictly nested under `root`. */
export function isWithin(target: string, root: string): boolean {
  const nTarget = normalize(target);
  const nRoot = normalize(root);
  return nTarget === nRoot || nTarget.startsWith(nRoot + path.sep);
}

function checkExists(p: string, mustExist?: boolean): string {
  if (mustExist && !fs.existsSync(p)) {
    throw new ToolError("path_not_found", `Path does not exist: ${p}`);
  }
  return p;
}

/** List available drives/volumes on the current platform. */
export async function listDrives(): Promise<string[]> {
  if (process.platform === "win32") {
    // Use the WMIC-free PowerShell approach (works on Win10/11).
    try {
      const { execFileSync } = await import("child_process");
      const out = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", "-c:Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"],
        { encoding: "utf8", timeout: 5000 }
      );
      return out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch (err) {
      console.error("[paths] drive enumeration failed:", err);
      return [];
    }
  }
  // POSIX: a single root.
  return ["/"];
}
