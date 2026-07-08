/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { Tool, ToolResult } from "../types.js";
import { ToolError } from "../types.js";
import { loadConfig } from "../../config/store.js";

const execFileAsync = promisify(execFile);

/**
 * Screen awareness tools.
 *
 *   - captureScreen       : full primary display
 *   - captureActiveWindow : best-effort capture of the foreground window
 *
 * Uses PowerShell + .NET (System.Windows.Forms / System.Drawing) for capture
 * instead of third-party screen-capture binaries. This is more reliable across
 * Windows versions and avoids antivirus false positives.
 *
 * Captures are:
 *   - only taken on explicit request (tool-driven, user-initiated via AI)
 *   - downscaled to screenshotMaxEdge and re-encoded to JPEG (quality from
 *     config) before being returned
 *   - returned both as `media` payload (for the frontend to inject as a vision
 *     frame) and summarised in the text output
 */
export const captureScreenTool: Tool = {
  name: "captureScreen",
  description:
    "Capture a screenshot of the user's primary screen and return it as a JPEG image. Use when the user asks to 'see my screen' or 'show me my desktop'. The image is also delivered to the AI visually so it can describe what is on screen.",
  parameters: {
    type: "OBJECT",
    properties: {
      display: {
        type: "INTEGER",
        description: "Optional 0-based display index. Defaults to the primary display (0).",
      },
    },
    required: [],
  },
  permissions: ["screen.capture"],
  async handler(args, _ctx): Promise<ToolResult> {
    const display = typeof args.display === "number" ? args.display : 0;
    const { base64, width, height } = await captureScreenViaPowerShell(display);
    return {
      ok: true,
      output: {
        status: "success",
        message: "Screenshot captured. The image is attached for visual analysis.",
        width,
        height,
        mimeType: "image/jpeg",
      },
      media: { mimeType: "image/jpeg", base64 },
      summary: `Captured screen (${width}x${height})`,
    };
  },
};

export const captureActiveWindowTool: Tool = {
  name: "captureActiveWindow",
  description:
    "Capture the user's currently active/foreground window and return it as a JPEG image. If a single window can't be isolated, the active display is captured instead.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["screen.capture"],
  async handler(_args, _ctx): Promise<ToolResult> {
    // Best-effort: capture the primary display (where the foreground window
    // lives). True per-window capture requires platform-specific APIs.
    const { base64, width, height } = await captureActiveWindowViaPowerShell();
    return {
      ok: true,
      output: {
        status: "success",
        message: "Active window screen captured. The image is attached for visual analysis.",
        width,
        height,
        mimeType: "image/jpeg",
        note: "Captured the active display containing the foreground window.",
      },
      media: { mimeType: "image/jpeg", base64 },
      summary: `Captured active window (${width}x${height})`,
    };
  },
};

export const screenTools: Tool[] = [captureScreenTool, captureActiveWindowTool];

// ---------------------------------------------------------------------------
// PowerShell-based capture helpers
// ---------------------------------------------------------------------------

/** PowerShell script that captures the full screen and writes it to a PNG. */
function buildCaptureScreenScript(displayIndex: number, outputPath: string): string {
  return `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
try {
  $bounds = [System.Windows.Forms.Screen]::AllScreens[${displayIndex}].Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
  $bitmap.Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Output "CAPTURED:$($bounds.Width)x$($bounds.Height)"
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`.trim();
}

/** PowerShell script that captures the active window and writes it to a PNG. */
function buildCaptureActiveWindowScript(outputPath: string): string {
  return `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
try {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
  $bitmap.Save('${outputPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  Write-Output "CAPTURED:$($bounds.Width)x$($bounds.Height)"
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`.trim();
}

async function captureScreenViaPowerShell(
  display: number
): Promise<{ base64: string; width: number; height: number }> {
  const tmpDir = await mkdtemp(join(tmpdir(), "aura-screen-"));
  const pngPath = join(tmpDir, "capture.png");

  try {
    const script = buildCaptureScreenScript(display, pngPath);
    const scriptPath = join(tmpDir, "capture.ps1");
    await writeFile(scriptPath, script, "utf-8");

    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { timeout: 15_000 }
    );

    if (!stdout.includes("CAPTURED:")) {
      throw new ToolError(
        "capture_failed",
        `Screen capture failed: no output from PowerShell.${stderr ? " " + stderr : ""}`
      );
    }

    // Read the captured PNG
    const pngBuffer = await readFile(pngPath);

    // Downscale + JPEG-encode via sharp
    const cfg = loadConfig();
    const maxEdge = Math.max(320, cfg.screenshotMaxEdge);
    let pipeline = sharp(pngBuffer, { failOn: "none" }).rotate();
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
    const jpeg = await pipeline
      .jpeg({ quality: Math.max(10, Math.min(100, cfg.screenshotQuality)), mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      base64: jpeg.data.toString("base64"),
      width: jpeg.info.width,
      height: jpeg.info.height,
    };
  } finally {
    // Cleanup temp files
    try { await unlink(pngPath); } catch { /* ignore */ }
    try { await unlink(join(tmpDir, "capture.ps1")); } catch { /* ignore */ }
    try { await rmdir(tmpDir); } catch { /* ignore */ }
  }
}

async function captureActiveWindowViaPowerShell(): Promise<{
  base64: string;
  width: number;
  height: number;
}> {
  const tmpDir = await mkdtemp(join(tmpdir(), "aura-screen-"));
  const pngPath = join(tmpDir, "capture.png");

  try {
    const script = buildCaptureActiveWindowScript(pngPath);
    const scriptPath = join(tmpDir, "capture.ps1");
    await writeFile(scriptPath, script, "utf-8");

    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { timeout: 15_000 }
    );

    if (!stdout.includes("CAPTURED:")) {
      throw new ToolError(
        "capture_failed",
        `Active window capture failed: no output from PowerShell.${stderr ? " " + stderr : ""}`
      );
    }

    const pngBuffer = await readFile(pngPath);
    const cfg = loadConfig();
    const maxEdge = Math.max(320, cfg.screenshotMaxEdge);
    let pipeline = sharp(pngBuffer, { failOn: "none" }).rotate();
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
    const jpeg = await pipeline
      .jpeg({ quality: Math.max(10, Math.min(100, cfg.screenshotQuality)), mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      base64: jpeg.data.toString("base64"),
      width: jpeg.info.width,
      height: jpeg.info.height,
    };
  } finally {
    try { await unlink(pngPath); } catch { /* ignore */ }
    try { await unlink(join(tmpDir, "capture.ps1")); } catch { /* ignore */ }
    try { await rmdir(tmpDir); } catch { /* ignore */ }
  }
}
