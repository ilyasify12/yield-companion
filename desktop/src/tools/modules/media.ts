import fs from "fs";
import type { Tool, ToolResult } from "../types.js";
import { ToolError } from "../types.js";
import { safeResolve } from "../util/paths.js";
import { openWithDefault } from "../util/win32.js";

/**
 * Media tools — open a local video / PDF / image with the OS default player.
 *
 * These are thin, typed wrappers over the generic file-opener. They exist as
 * distinct tools so the AI has clear, intent-named actions (the spec lists
 * "play a local video", "open a PDF", "open an image" explicitly). Each
 * validates the file exists and is within the allowed roots before launching.
 */

const EXT = {
  video: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg"],
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg", ".heic"],
  pdf: [".pdf"],
} as const;

function makeMediaOp(opts: {
  name: string;
  description: string;
  kind: keyof typeof EXT;
  verb: string;
}): Tool {
  const { name, description, kind, verb } = opts;
  return {
    name,
    description,
    parameters: {
      type: "OBJECT",
      properties: {
        path: {
          type: "STRING",
          description: `Absolute path to the ${kind} file, or a name resolvable within the user folders.`,
        },
      },
      required: ["path"],
    },
    permissions: ["file.open"],
    async handler(args, _ctx): Promise<ToolResult> {
      const target = safeResolve(args.path, { allowAnyAbsolute: true, mustExist: true });
      const stat = fs.statSync(target);
      if (!stat.isFile()) {
        throw new ToolError("not_a_file", `"${target}" is not a file.`);
      }
      const ext = require_ext(target);
      if (!(EXT[kind] as unknown as string[]).includes(ext)) {
        throw new ToolError(
          "wrong_type",
          `"${target}" (${ext}) is not a recognised ${kind} file.`
        );
      }
      await openWithDefault(target);
      return {
        ok: true,
        output: { status: "success", path: target, kind },
        summary: `${verb} ${target}`,
      };
    },
  };
}

// Avoid importing path at top just for extname; keep it self-contained.
function require_ext(p: string): string {
  const idx = p.lastIndexOf(".");
  return idx >= 0 ? p.slice(idx).toLowerCase() : "";
}

export const openVideoTool = makeMediaOp({
  name: "openVideo",
  description:
    "Play a local video file using the system's default media player. Accepts an absolute path (e.g. from searchFiles) or a name resolvable within the user folders.",
  kind: "video",
  verb: "Playing",
});

export const openPdfTool = makeMediaOp({
  name: "openPdf",
  description:
    "Open a local PDF document with the system's default PDF viewer. Accepts an absolute path or a name resolvable within the user folders.",
  kind: "pdf",
  verb: "Opening",
});

export const openImageTool = makeMediaOp({
  name: "openImage",
  description:
    "Open a local image file with the system's default image viewer. Accepts an absolute path or a name resolvable within the user folders.",
  kind: "image",
  verb: "Opening",
});

export const mediaTools: Tool[] = [openVideoTool, openPdfTool, openImageTool];
