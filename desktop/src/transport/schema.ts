import { z } from "zod";

/**
 * Per-tool zod validation schemas, keyed by tool name.
 *
 * The ToolManager looks up a schema by tool name and parses inbound args
 * before the handler runs. Invalid args never reach a tool handler. The
 * registration in tools/index.ts attaches each schema to its tool.
 */

const pathString = z
  .string()
  .trim()
  .min(1, "A path is required.")
  .max(1024, "Path is too long.");

const friendlyFolder = z
  .string()
  .trim()
  .max(256)
  .optional()
  .or(z.literal("").transform(() => undefined));

const urlHttps = z
  .string()
  .trim()
  .min(1, "A URL is required.")
  .url("Must be a valid URL.")
  .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://");

export const schemas: Record<string, z.ZodTypeAny> = {
  // files
  openFile: z.object({ path: pathString }),
  openFolder: z.object({ path: friendlyFolder }),
  revealInExplorer: z.object({ path: pathString }),

  // search
  searchFiles: z.object({
    query: z.string().trim().min(1, "A query is required.").max(256),
    kind: z.enum(["video", "image", "audio", "pdf", "folder", "any"]).optional(),
    folder: friendlyFolder,
    maxResults: z.number().int().min(1).max(200).optional(),
  }),

  // apps / browser
  launchApp: z.object({
    name: z.string().trim().min(1, "An app name is required.").max(128),
  }),
  openUrl: z.object({ url: urlHttps }),

  // media
  openVideo: z.object({ path: pathString }),
  openPdf: z.object({ path: pathString }),
  openImage: z.object({ path: pathString }),

  // clipboard
  readClipboard: z.object({ maxChars: z.number().int().min(1).max(20000).optional() }),
  writeClipboard: z.object({ text: z.string().min(1).max(200000, "Text is too long.") }),

  // system (no args)
  getCurrentTime: z.object({}).optional(),
  getCurrentWorkingDirectory: z.object({}).optional(),
  listDrives: z.object({}).optional(),
  listCommonFolders: z.object({}).optional(),

  // screen
  captureScreen: z.object({ display: z.number().int().min(0).max(15).optional() }),
  captureActiveWindow: z.object({}).optional(),

  // pc control
  moveMouse: z.object({ x: z.number().int().min(0), y: z.number().int().min(0) }),
  clickMouse: z.object({ button: z.enum(["left", "right", "middle", "double"]).optional() }),
  scrollMouse: z.object({ lines: z.number().int() }),
  dragMouse: z.object({ x: z.number().int().min(0), y: z.number().int().min(0) }),
  typeText: z.object({ text: z.string().min(1).max(20000) }),
  pressKey: z.object({ key: z.string().min(1).max(50) }),
  pressHotkey: z.object({ keys: z.string().min(1).max(200) }),

  // media control
  mediaPlayPause: z.object({}).optional(),
  mediaNextTrack: z.object({}).optional(),
  mediaPrevTrack: z.object({}).optional(),
  mediaStop: z.object({}).optional(),
  mediaVolumeSet: z.object({ level: z.number().int().min(0).max(100) }),
  mediaVolumeUp: z.object({ steps: z.number().int().min(1).max(100).optional() }),
  mediaVolumeDown: z.object({ steps: z.number().int().min(1).max(100).optional() }),
  mediaMute: z.object({}).optional(),

  // youtube
  youtubeSearch: z.object({ query: z.string().min(1).max(500), openFirst: z.boolean().optional() }),
  youtubePlay: z.object({ video: z.string().min(1).max(2048) }),
  youtubeGetInfo: z.object({ video: z.string().min(1).max(2048) }),
};

/** Look up a tool's validation schema (undefined if the tool takes no args). */
export function schemaFor(name: string): z.ZodTypeAny | undefined {
  return schemas[name];
}
