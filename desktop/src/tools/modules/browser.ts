import type { Tool, ToolResult } from "../types.js";
import { openUrl } from "../util/win32.js";

/**
 * Browser tool — opens a URL in the system's *default* browser (not a tab
 * inside the voice-app window). This avoids the popup-blocker problem the
 * browser-side window.open() has, and respects the user's chosen browser.
 *
 * Restricted to http(s). No other schemes are permitted.
 */
export const openUrlTool: Tool = {
  name: "openUrl",
  description:
    "Open a specific website URL in the user's default system web browser (a real browser tab, not the in-app window). URL must start with http:// or https://.",
  parameters: {
    type: "OBJECT",
    properties: {
      url: {
        type: "STRING",
        description: "The complete URL to open (must start with http:// or https://).",
      },
    },
    required: ["url"],
  },
  permissions: ["app.launch"],
  async handler(args, _ctx): Promise<ToolResult> {
    await openUrl(args.url);
    return {
      ok: true,
      output: { status: "success", url: args.url },
      summary: `Opened ${args.url} in the default browser`,
    };
  },
};

export const browserTools: Tool[] = [openUrlTool];
