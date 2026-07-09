/**
 * Tool registration hub.
 *
 * Imports every module, wires each tool + its zod schema into a single
 * ToolManager instance, and exports:
 *   - toolManager  : the live, fully-wired manager (used by the REST transport)
 *   - getToolDeclarations() : Gemini-compatible functionDeclarations array
 *                              (used by the voice server to merge with its own tools)
 */

import { ToolManager } from "./registry.js";
import { PermissionManager } from "../permissions/manager.js";
import { schemaFor } from "../transport/schema.js";

// --- modules ---------------------------------------------------------------
import { fileTools } from "./modules/files.js";
import { searchTool } from "./modules/search.js";
import { browserTools } from "./modules/browser.js";
import { appTools } from "./modules/apps.js";
import { mediaTools } from "./modules/media.js";
import { clipboardTools } from "./modules/clipboard.js";
import { systemTools } from "./modules/system.js";
import { screenTools } from "./modules/screen.js";
import { pcControlTools } from "./modules/pc-control.js";
import { mediaControlTools } from "./modules/media-control.js";
import { youtubeTools } from "./modules/youtube.js";
import { vitalsTools } from "./modules/vitals.js";

// --- wiring -----------------------------------------------------------------

const permissions = new PermissionManager();
const toolManager = new ToolManager(permissions);

/** Every module in one flat list. */
const allModules: typeof fileTools = [
  ...fileTools,
  searchTool,
  ...browserTools,
  ...appTools,
  ...mediaTools,
  ...clipboardTools,
  ...systemTools,
  ...screenTools,
  ...pcControlTools,
  ...mediaControlTools,
  ...youtubeTools,
  ...vitalsTools,
];

for (const tool of allModules) {
  const schema = schemaFor(tool.name);
  toolManager.register(tool, schema);
}

console.log(
  `[tools] Registered ${toolManager.list().length} desktop tools:`,
  toolManager.list().map((t) => t.name).join(", ")
);

// --- exports ----------------------------------------------------------------

export { toolManager, permissions };

/** Gemini Live-compatible functionDeclarations (the voice server merges these). */
export function getToolDeclarations() {
  return toolManager.toLiveDeclarations();
}
