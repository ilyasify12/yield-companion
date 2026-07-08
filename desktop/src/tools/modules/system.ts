import type { Tool, ToolResult } from "../types.js";
import { getCommonFolders, listDrives } from "../util/paths.js";

/**
 * System information tools — all read-only, low-sensitivity.
 *   - getCurrentTime            : local date/time + timezone
 *   - getCurrentWorkingDirectory: the service's CWD
 *   - listDrives                : available filesystem volumes
 *   - listCommonFolders         : the well-known user folders
 */
export const getCurrentTimeTool: Tool = {
  name: "getCurrentTime",
  description: "Returns the current local date and time on the user's machine, including the timezone.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["system.info"],
  async handler(_args, _ctx): Promise<ToolResult> {
    const now = new Date();
    return {
      ok: true,
      output: {
        status: "success",
        iso: now.toISOString(),
        local: now.toLocaleString(),
        time: now.toLocaleTimeString(),
        date: now.toLocaleDateString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      summary: `It's ${now.toLocaleTimeString()} on ${now.toLocaleDateString()}`,
    };
  },
};

export const getCurrentWorkingDirectoryTool: Tool = {
  name: "getCurrentWorkingDirectory",
  description: "Returns the current working directory of the local desktop service.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["system.info"],
  async handler(_args, _ctx): Promise<ToolResult> {
    return {
      ok: true,
      output: { status: "success", cwd: process.cwd() },
      summary: `Working directory: ${process.cwd()}`,
    };
  },
};

export const listDrivesTool: Tool = {
  name: "listDrives",
  description: "List the available filesystem drives/volumes on the user's machine (e.g. C:\\, D:\\).",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["system.info"],
  async handler(_args, _ctx): Promise<ToolResult> {
    const drives = await listDrives();
    return {
      ok: true,
      output: { status: "success", drives },
      summary: `Found ${drives.length} drive${drives.length === 1 ? "" : "s"}`,
    };
  },
};

export const listCommonFoldersTool: Tool = {
  name: "listCommonFolders",
  description:
    "List the user's common folders (Desktop, Documents, Downloads, Pictures, Videos, Music, Home) with their full paths.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["system.info"],
  async handler(_args, _ctx): Promise<ToolResult> {
    const folders = getCommonFolders().map((f) => ({ key: f.key, path: f.path, aliases: f.aliases }));
    return {
      ok: true,
      output: { status: "success", folders },
      summary: `Returned ${folders.length} common folders`,
    };
  },
};

export const systemTools: Tool[] = [
  getCurrentTimeTool,
  getCurrentWorkingDirectoryTool,
  listDrivesTool,
  listCommonFoldersTool,
];
