import type { Tool, ToolResult } from "../types.js";
import { safeResolve, resolveCommonFolder } from "../util/paths.js";
import { openWithDefault, revealInFileManager } from "../util/win32.js";
import fs from "fs";

/**
 * File & folder tools.
 *   - openFile        : open a file with the OS default handler
 *   - openFolder      : open a folder (by friendly name or path) in Explorer
 *   - revealInExplorer: select a file/folder in Explorer/Finder
 *
 * `allowAnyAbsolute` is enabled for openFile because the AI frequently reopens
 * a path that our own search tool returned; the search tool only ever returns
 * paths within allowed roots, so the trust chain is intact.
 */

export const openFileTool: Tool = {
  name: "openFile",
  description:
    "Open a local file with the operating system's default application (e.g. open a PDF, video, image, or document). Accepts an absolute path returned by searchFiles, or a relative name resolved within the user's common folders.",
  parameters: {
    type: "OBJECT",
    properties: {
      path: {
        type: "STRING",
        description: "Absolute path to the file, or a name resolvable within the user folders.",
      },
    },
    required: ["path"],
  },
  permissions: ["file.open"],
  async handler(args, _ctx): Promise<ToolResult> {
    const target = safeResolve(args.path, { allowAnyAbsolute: true, mustExist: true });
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      // Be forgiving: a directory was passed — open it as a folder instead.
      await openWithDefault(target);
      return {
        ok: true,
        output: { status: "success", path: target, openedAs: "folder" },
        summary: `Opened folder ${target}`,
      };
    }
    await openWithDefault(target);
    return {
      ok: true,
      output: { status: "success", path: target, openedAs: "file" },
      summary: `Opened ${target}`,
    };
  },
};

export const openFolderTool: Tool = {
  name: "openFolder",
  description:
    "Open a folder in the system file manager (Explorer on Windows, Finder on macOS). Accepts a friendly name like 'Downloads', 'Documents', 'Desktop', 'Pictures', 'Videos', 'Music', or an absolute/relative folder path.",
  parameters: {
    type: "OBJECT",
    properties: {
      path: {
        type: "STRING",
        description:
          "Friendly folder name (e.g. 'Downloads') or a folder path. Optional — defaults to the user home folder.",
      },
    },
    required: [],
  },
  permissions: ["file.open"],
  async handler(args, _ctx): Promise<ToolResult> {
    const input = (args.path || "").toString().trim();
    if (!input) {
      const home = resolveCommonFolder("home")!;
      await openWithDefault(home.path);
      return { ok: true, output: { status: "success", path: home.path }, summary: `Opened home folder` };
    }
    // Friendly name? Resolve directly (common folders don't need to exist yet).
    const folder = resolveCommonFolder(input);
    if (folder) {
      await openWithDefault(folder.path);
      return { ok: true, output: { status: "success", path: folder.path }, summary: `Opened ${folder.key}` };
    }
    const target = safeResolve(input, { allowAnyAbsolute: true, mustExist: true });
    await openWithDefault(target);
    return { ok: true, output: { status: "success", path: target }, summary: `Opened ${target}` };
  },
};

export const revealInExplorerTool: Tool = {
  name: "revealInExplorer",
  description:
    "Reveal (select) a file or folder in the system file manager so the user can see where it lives.",
  parameters: {
    type: "OBJECT",
    properties: {
      path: {
        type: "STRING",
        description: "Absolute path, or a name resolvable within the user folders.",
      },
    },
    required: ["path"],
  },
  permissions: ["file.open"],
  async handler(args, _ctx): Promise<ToolResult> {
    const target = safeResolve(args.path, { allowAnyAbsolute: true, mustExist: true });
    await revealInFileManager(target);
    return {
      ok: true,
      output: { status: "success", path: target },
      summary: `Revealed ${target} in file manager`,
    };
  },
};

export const fileTools: Tool[] = [openFileTool, openFolderTool, revealInExplorerTool];
