import { execFile, spawn } from "child_process";
import path from "path";
import { ToolError } from "../types.js";

/**
 * Native OS integration helpers.
 *
 * Windows is the primary target (this project runs on win32). Every shell-out
 * passes arguments as a structured array — never a raw, interpolated command
 * string — so the AI cannot inject arbitrary commands.
 *
 * The `open` verb differs by platform but the surface here is uniform.
 */

/** Open a file or folder with the OS default handler. */
export function openWithDefault(p: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = path.normalize(p);
    if (process.platform === "win32") {
      // `start "" "<path>"` opens with the registered default handler.
      execFile("cmd", ["/c", "start", "", target], { windowsHide: true }, (err) => {
        if (err) reject(new ToolError("open_failed", `Failed to open "${target}": ${err.message}`));
        else resolve();
      });
    } else if (process.platform === "darwin") {
      execFile("open", [target], (err) => {
        if (err) reject(new ToolError("open_failed", `Failed to open "${target}": ${err.message}`));
        else resolve();
      });
    } else {
      execFile("xdg-open", [target], (err) => {
        if (err) reject(new ToolError("open_failed", `Failed to open "${target}": ${err.message}`));
        else resolve();
      });
    }
  });
}

/** Open a URL in the default browser. */
export function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let scheme: string;
    try {
      scheme = new URL(url).protocol;
    } catch {
      reject(new ToolError("bad_url", `Invalid URL: ${url}`));
      return;
    }
    if (!["http:", "https:"].includes(scheme)) {
      reject(new ToolError("bad_url", `Only http(s) URLs are allowed, got: ${scheme}`));
      return;
    }
    // Reuse openWithDefault which already enforces structured args.
    openWithDefault(url).then(resolve, reject);
  });
}

/** Reveal a file (or folder) in Explorer / Finder / file manager. */
export function revealInFileManager(p: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = path.normalize(p);
    if (process.platform === "win32") {
      execFile("explorer.exe", ["/select,", target], { windowsHide: true }, (err) => {
        if (err) reject(new ToolError("reveal_failed", `Failed to reveal "${target}": ${err.message}`));
        else resolve();
      });
    } else if (process.platform === "darwin") {
      execFile("open", ["-R", target], (err) => {
        if (err) reject(new ToolError("reveal_failed", `Failed to reveal: ${err.message}`));
        else resolve();
      });
    } else {
      execFile("xdg-open", [path.dirname(target)], (err) => {
        if (err) reject(new ToolError("reveal_failed", `Failed to reveal: ${err.message}`));
        else resolve();
      });
    }
  });
}

export interface LaunchResult {
  launched: boolean;
  /** Human-readable note for the AI (what was tried). */
  note: string;
}

/**
 * Launch an installed application by display name.
 *
 * Strategy on Windows:
 *   1. Try the UWP/protocol form via `start "" "Name"` (resolves Store apps
 *      like "Visual Studio Code" when registered).
 *   2. Probe common shortcuts on disk (Start Menu) and execute the best match.
 *   3. Fall back to a non-elevated `start shell:appsfolder`-style lookup.
 *
 * No arbitrary user-supplied command lines are ever executed — the input is
 * treated strictly as an application name / registered URI.
 */
export async function launchAppByName(name: string): Promise<LaunchResult> {
  const clean = name.trim();
  if (!clean) throw new ToolError("bad_app", "Application name is required.");

  if (process.platform === "win32") {
    return launchWin32(clean);
  }
  if (process.platform === "darwin") {
    return new Promise<LaunchResult>((resolve) => {
      execFile("open", ["-a", clean], (err) => {
        if (err)
          resolve({ launched: false, note: `Could not launch "${clean}" on macOS: ${err.message}` });
        else resolve({ launched: true, note: `Launched "${clean}".` });
      });
    });
  }
  return new Promise<LaunchResult>((resolve) => {
    // Best-effort on Linux: try the name as a binary on PATH.
    const child = spawn(clean, { detached: true, stdio: "ignore" });
    child.on("error", () =>
      resolve({ launched: false, note: `Could not launch "${clean}" on this system.` })
    );
    child.unref();
    resolve({ launched: true, note: `Attempted to launch "${clean}".` });
  });
}

/** Windows-specific application launch with shortcut probing. */
async function launchWin32(name: string): Promise<LaunchResult> {
  // 1. Probe Start Menu shortcuts for a .lnk/.exe whose name matches.
  const shortcut = await findStartMenuShortcut(name);
  if (shortcut) {
    return new Promise<LaunchResult>((resolve) => {
      execFile("cmd", ["/c", "start", "", shortcut], { windowsHide: true }, (err) => {
        if (err) resolve({ launched: false, note: `Found "${shortcut}" but failed to launch: ${err.message}` });
        else resolve({ launched: true, note: `Launched "${name}" via shortcut.` });
      });
    });
  }

  // 2. Fallback: ask the shell to resolve the name (works for Store apps and
  //    some registered protocols). This is best-effort and non-fatal.
  return new Promise<LaunchResult>((resolve) => {
    execFile("cmd", ["/c", "start", "", name], { windowsHide: true }, (err) => {
      if (err) resolve({ launched: false, note: `Could not find an app named "${name}".` });
      else resolve({ launched: true, note: `Launched "${name}".` });
    });
  });
}

/** Scan the user + system Start Menu for a shortcut matching `name`. */
async function findStartMenuShortcut(name: string): Promise<string | null> {
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");

  const dirs = [
    path.join(os.homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs"),
    "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
  ];

  const needle = name.toLowerCase();
  const candidates: Array<{ file: string; score: number }> = [];

  function walk(dir: string) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(lnk|exe)$/i.test(entry)) {
        const base = entry.replace(/\.(lnk|exe)$/i, "").toLowerCase();
        let score = 0;
        if (base === needle) score = 100;
        else if (base.includes(needle)) score = 70;
        else if (needle.includes(base) && base.length > 3) score = 40;
        if (score > 0) candidates.push({ file: full, score });
      }
    }
  }

  for (const d of dirs) walk(d);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].file;
}
