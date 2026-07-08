import type { Tool, ToolResult } from "../types.js";
import { launchAppByName } from "../util/win32.js";

/**
 * Application launch tool.
 *
 * Launches an installed application by its display name (e.g.
 * "Visual Studio Code", "Spotify", "Notepad"). On Windows the launcher probes
 * the Start Menu shortcuts and registered Store apps; no arbitrary command
 * lines are accepted — the input is treated strictly as an app name.
 */
export const launchAppTool: Tool = {
  name: "launchApp",
  description:
    "Launch an installed desktop application by its name (e.g. 'Visual Studio Code', 'Spotify', 'Notepad', 'Calculator'). Uses the application's registered shortcut — does not accept command-line arguments.",
  parameters: {
    type: "OBJECT",
    properties: {
      name: {
        type: "STRING",
        description: "The display name of the application to launch.",
      },
    },
    required: ["name"],
  },
  permissions: ["app.launch"],
  async handler(args, _ctx): Promise<ToolResult> {
    const result = await launchAppByName(args.name);
    return {
      ok: result.launched,
      output: { status: result.launched ? "success" : "failed", note: result.note, name: args.name },
      summary: result.note,
    };
  },
};

export const appTools: Tool[] = [launchAppTool];
