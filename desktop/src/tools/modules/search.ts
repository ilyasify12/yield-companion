import fs from "fs";
import path from "path";
import type { Tool, ToolResult } from "../types.js";
import { ToolError } from "../types.js";
import { getAllowedRoots, isWithin, normalize } from "../util/paths.js";
import { loadConfig } from "../../config/store.js";

/**
 * Recursive file search.
 *
 * Walks the allowed roots (common user folders by default) and returns the
 * closest matches for a query. Searches are:
 *   - bounded to allowed roots (never escapes the user's own folders)
 *   - capped by maxSearchResults
 *   - filtered by an optional extension allowlist (e.g. videos, images)
 *
 * Only file/dir *names* and metadata are returned — never file contents.
 */

export interface SearchMatch {
  path: string;
  name: string;
  kind: "file" | "folder";
  size: number;
  modified: string;
  score: number;
}

export const searchFilesTool: Tool = {
  name: "searchFiles",
  description:
    "Search the user's local files and folders by name. Returns the closest matches with their full paths, sizes, and modified dates. Use this to find a file before opening it (e.g. a video, project, or document). Search is recursive and limited to the user's common folders.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: {
        type: "STRING",
        description: "The file or folder name to search for (e.g. 'Naruto Episode 3', 'roblox project').",
      },
      kind: {
        type: "STRING",
        description:
          "Optional filter restricting results to a category: 'video', 'image', 'audio', 'pdf', 'folder', or 'any'.",
        enum: ["video", "image", "audio", "pdf", "folder", "any"],
      },
      folder: {
        type: "STRING",
        description:
          "Optional friendly folder name (e.g. 'Downloads') or path to restrict the search root.",
      },
      maxResults: {
        type: "INTEGER",
        description: "Maximum number of matches to return. Defaults to the service config (usually 50).",
      },
    },
    required: ["query"],
  },
  permissions: ["file.search"],
  async handler(args, _ctx): Promise<ToolResult> {
    const query = (args.query || "").toString().trim().toLowerCase();
    if (!query) throw new ToolError("bad_query", "A search query is required.");

    const kind: string = args.kind || "any";
    const limit = Math.max(
      1,
      Math.min(args.maxResults ?? loadConfig().maxSearchResults, loadConfig().maxSearchResults)
    );

    const roots = resolveRoots(args.folder);
    const matches: SearchMatch[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      walk(root, (abs, stat) => {
        if (matches.length >= limit * 4) return; // collect pool then rank
        if (seen.has(normalize(abs))) return;
        seen.add(normalize(abs));

        const name = path.basename(abs);
        const isDir = stat.isDirectory();
        if (kind === "folder" && !isDir) return;
        if (kind !== "any" && kind !== "folder" && isDir) return;
        if (kind !== "any" && kind !== "folder" && !matchesKind(name, kind)) return;

        const score = scoreMatch(name, query);
        if (score <= 0) return;

        matches.push({
          path: abs,
          name,
          kind: isDir ? "folder" : "file",
          size: stat.size,
          modified: stat.mtime.toISOString(),
          score,
        });
      });
    }

    matches.sort((a, b) => b.score - a.score || b.modified.localeCompare(a.modified));
    const top = matches.slice(0, limit);

    return {
      ok: true,
      output: {
        status: "success",
        query,
        count: top.length,
        results: top.map(({ score, ...rest }) => rest),
      },
      summary:
        top.length > 0
          ? `Found ${top.length} match${top.length === 1 ? "" : "es"} for "${query}"`
          : `No files matched "${query}"`,
    };
  },
};

function resolveRoots(folder?: string): string[] {
  if (!folder) return getAllowedRoots();
  // Restrict to a single requested root, but only if it's itself allowed.
  const requested = getAllowedRoots();
  // Allow a friendly name via the common-folder resolver indirectly: only
  // accept if the resolved path is within an existing allowed root.
  let candidate = folder;
  // If it's an absolute path, keep it; otherwise try to anchor against roots.
  if (!path.isAbsolute(folder)) {
    for (const root of requested) {
      const joined = path.join(root, folder);
      if (fs.existsSync(joined)) {
        candidate = joined;
        break;
      }
    }
  }
  const norm = normalize(candidate);
  const allowed = requested.some((r) => isWithin(candidate, r));
  if (!allowed) {
    throw new ToolError(
      "path_denied",
      `Search folder "${folder}" is outside the allowed user folders.`
    );
  }
  return requested.filter((r) => isWithin(r, norm)).concat([norm]).filter((v, i, a) => a.indexOf(v) === i);
}

const EXT: Record<string, string[]> = {
  video: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"],
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg", ".heic"],
  audio: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"],
  pdf: [".pdf"],
};

function matchesKind(name: string, kind: string): boolean {
  if (kind === "any" || kind === "folder") return true;
  const exts = EXT[kind];
  if (!exts) return true;
  return exts.includes(path.extname(name).toLowerCase());
}

/** Score how well a filename matches the query (0 = no match). */
function scoreMatch(name: string, query: string): number {
  const n = name.toLowerCase();
  // Tokenise the query into words; "naruto episode 3" -> ["naruto","episode","3"]
  const tokens = query.split(/[\s_.\-]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return 0;

  let score = 0;
  // Exact filename match is the strongest signal.
  if (n === query) return 1000;
  // Filename contains the whole query contiguously.
  if (n.includes(query)) score += 120;

  let matchedTokens = 0;
  for (const t of tokens) {
    if (n.includes(t)) {
      matchedTokens++;
      // Longer tokens are more meaningful.
      score += Math.min(40, t.length * 6);
    }
  }

  // Require at least half the query tokens to match (fuzzy but bounded).
  if (matchedTokens < Math.ceil(tokens.length / 2)) return 0;
  // Bonus when all tokens matched.
  if (matchedTokens === tokens.length) score += 30;
  return score;
}

/** Non-recursive-walk-friendly directory traversal with simple cycle guard. */
function walk(root: string, visit: (abs: string, stat: fs.Stats) => void) {
  let stack: string[] = [root];
  const MAX_DEPTH = 8;
  const depths = new Map<string, number>([[root, 0]]);
  const MAX_FILES = 200000; // hard guard against pathological trees
  let visited = 0;

  while (stack.length) {
    const dir = stack.pop()!;
    const depth = depths.get(dir) ?? MAX_DEPTH;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // permission errors, etc.
    }
    for (const entry of entries) {
      if (visited++ > MAX_FILES) return;
      const full = path.join(dir, entry.name);
      // Skip obvious junk / version-control dirs to stay fast and private.
      if (entry.isDirectory()) {
        if (depth + 1 > MAX_DEPTH) continue;
        if (isJunkDir(entry.name)) continue;
        try {
          const st = fs.statSync(full);
          depths.set(full, depth + 1);
          visit(full, st);
          stack.push(full);
        } catch {
          // ignore unreadable
        }
      } else if (entry.isFile()) {
        try {
          const st = fs.statSync(full);
          visit(full, st);
        } catch {
          // ignore unreadable
        }
      }
    }
  }
}

function isJunkDir(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === "node_modules" ||
    lower === ".git" ||
    lower === "$recycle.bin" ||
    lower === "system volume information" ||
    lower === ".cache" ||
    lower === "appdata" // heavily nested, rarely what the user wants by name
  );
}

export const searchTool = searchFilesTool;
