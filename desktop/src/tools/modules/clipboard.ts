import { execFile } from "child_process";
import { promisify } from "util";
import type { Tool, ToolResult } from "../types.js";
import { ToolError } from "../types.js";

const pexec = promisify(execFile);

/**
 * Clipboard tools.
 *
 * Reading/writing the system clipboard is a privileged, sensitive action, so
 * it always carries the clipboard.* permission (audited under the default
 * "allow + log" policy).
 *
 * Native backends:
 *   - Windows: PowerShell Get-SetClipboard
 *   - macOS:   pbpaste / pbcopy
 *   - Linux:   xclip -selection clipboard
 */

export const readClipboardTool: Tool = {
  name: "readClipboard",
  description:
    "Read the current plain-text contents of the user's system clipboard. Returns the text (truncated if very long).",
  parameters: {
    type: "OBJECT",
    properties: {
      maxChars: {
        type: "INTEGER",
        description: "Maximum characters to return. Defaults to 4000.",
      },
    },
    required: [],
  },
  permissions: ["clipboard.read"],
  async handler(args, _ctx): Promise<ToolResult> {
    const max = Math.max(1, Math.min(args.maxChars ?? 4000, 20000));
    const text = await readNative();
    const truncated = text.length > max;
    return {
      ok: true,
      output: {
        status: "success",
        text: text.slice(0, max),
        truncated,
        length: text.length,
      },
      summary: truncated
        ? `Read clipboard (${text.length} chars, truncated)`
        : `Read clipboard (${text.length} chars)`,
    };
  },
};

export const writeClipboardTool: Tool = {
  name: "writeClipboard",
  description: "Copy the given text to the user's system clipboard.",
  parameters: {
    type: "OBJECT",
    properties: {
      text: {
        type: "STRING",
        description: "The exact text to place on the clipboard.",
      },
    },
    required: ["text"],
  },
  permissions: ["clipboard.write"],
  async handler(args, _ctx): Promise<ToolResult> {
    const text = typeof args.text === "string" ? args.text : String(args.text ?? "");
    if (!text) throw new ToolError("bad_input", "Text to copy is required.");
    await writeNative(text);
    return {
      ok: true,
      output: { status: "success", length: text.length },
      summary: `Copied ${text.length} characters to clipboard`,
    };
  },
};

export const clipboardTools: Tool[] = [readClipboardTool, writeClipboardTool];

async function readNative(): Promise<string> {
  if (process.platform === "win32") {
    const { stdout } = await pexec(
      "powershell",
      ["-NoProfile", "-Command", "Get-Clipboard -Raw"],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    return stdout;
  }
  if (process.platform === "darwin") {
    const { stdout } = await pexec("pbpaste", [], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    return stdout;
  }
  // Linux
  const { stdout } = await pexec("xclip", ["-selection", "clipboard", "-o"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

async function writeNative(text: string): Promise<void> {
  if (process.platform === "win32") {
    // Use a base64 transport to survive quotes / newlines / unicode safely.
    const b64 = Buffer.from(text, "utf8").toString("base64");
    await pexec(
      "powershell",
      ["-NoProfile", "-Command", `Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${b64}")))`],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    return;
  }
  if (process.platform === "darwin") {
    const child = execFile("pbcopy", [], { encoding: "utf8" });
    if (child.stdin) {
      child.stdin.end(text);
    }
    return new Promise((resolve, reject) => {
      child.on("close", (code) => (code === 0 ? resolve() : reject(new ToolError("clipboard_failed", `pbcopy exited ${code}`))));
      child.on("error", reject);
    });
  }
  // Linux
  const child = execFile("xclip", ["-selection", "clipboard"], { encoding: "utf8" });
  if (child.stdin) child.stdin.end(text);
  return new Promise((resolve, reject) => {
    child.on("close", (code) => (code === 0 ? resolve() : reject(new ToolError("clipboard_failed", `xclip exited ${code}`))));
    child.on("error", reject);
  });
}
