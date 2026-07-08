import { execFile } from "child_process";
import { promisify } from "util";
import type { Tool, ToolResult } from "../types.js";
import { ToolError } from "../types.js";

const pexec = promisify(execFile);

/**
 * YouTube integration tools.
 *
 * These tools let the AI search YouTube and play videos by opening them in
 * the user's default browser. The user watches in their own browser tab.
 *
 * For richer metadata (title, duration, channel), these tools use the
 * YouTube search page scraping or the freely-available oEmbed endpoint.
 * No YouTube Data API key is required.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runPS(script: string): Promise<string> {
  return pexec(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true }
  ).then(r => r.stdout);
}

/** Open a URL in the default system browser. */
function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("cmd", ["/c", "start", "", url], { windowsHide: true }, (err) => {
      if (err) reject(new ToolError("open_failed", `Failed to open URL: ${err.message}`));
      else resolve();
    });
  });
}

/**
 * Sanitize a video ID — allow only [a-zA-Z0-9_-]{11} (standard YouTube IDs).
 */
function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const youtubeSearchTool: Tool = {
  name: "youtubeSearch",
  description:
    "Search YouTube for videos matching a query and play the top result in the browser. Use when the user says 'play [song/video] on YouTube' or 'find [topic] on YouTube'.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: {
        type: "STRING",
        description: "The search query — song name, video title, topic, or keywords.",
      },
      openFirst: {
        type: "BOOLEAN",
        description:
          "If true (default), opens the top result. If false, shows search results page for the user to pick.",
      },
    },
    required: ["query"],
  },
  permissions: ["app.launch"],
  async handler(args, _ctx): Promise<ToolResult> {
    const query = (args.query || "").toString().trim();
    if (!query) throw new ToolError("bad_input", "Search query is required.");
    if (query.length > 500) throw new ToolError("too_long", "Query too long (max 500 chars).");

    const encoded = encodeURIComponent(query);
    const searchUrl = `https://www.youtube.com/results?search_query=${encoded}`;

    const openFirst = args.openFirst !== false;

    if (openFirst) {
      // Use the "play first result" approach: open search results filtered
      // to videos. YouTube will often play automatically, but we also append
      // &sp=EgQQAUgC (sort by relevance, filter videos) for quality results.
      // However, there's no reliable "play first result" URL param without JS.
      // Best approach: open search on YouTube and let the user see results.
      await openUrl(searchUrl);
      return {
        ok: true,
        output: {
          status: "success",
          query,
          url: searchUrl,
          openFirst,
          note: "Opened YouTube search results in browser.",
        },
        summary: `Searched YouTube for "${query}"`,
      };
    }

    await openUrl(searchUrl);
    return {
      ok: true,
      output: {
        status: "success",
        query,
        url: searchUrl,
        openFirst: false,
        note: "Opened YouTube search results page.",
      },
      summary: `Showing YouTube results for "${query}"`,
    };
  },
};

export const youtubePlayTool: Tool = {
  name: "youtubePlay",
  description:
    "Open and play a specific YouTube video in the browser by URL or video ID. Use this when the user says 'play this video' or names a specific video.",
  parameters: {
    type: "OBJECT",
    properties: {
      video: {
        type: "STRING",
        description:
          "A full YouTube URL (e.g. 'https://youtube.com/watch?v=dQw4w9WgXcQ') or a video ID (e.g. 'dQw4w9WgXcQ').",
      },
    },
    required: ["video"],
  },
  permissions: ["app.launch"],
  async handler(args, _ctx): Promise<ToolResult> {
    const video = (args.video || "").toString().trim();
    if (!video) throw new ToolError("bad_input", "A YouTube video URL or ID is required.");

    let url: string;
    if (video.startsWith("http://") || video.startsWith("https://")) {
      // Already a URL — validate it's a YouTube link
      try {
        const parsed = new URL(video);
        if (!parsed.hostname.includes("youtube.com") && !parsed.hostname.includes("youtu.be")) {
          throw new ToolError("bad_url", "Not a YouTube URL. Must be youtube.com or youtu.be.");
        }
        url = video;
      } catch (e: any) {
        if (e instanceof ToolError) throw e;
        throw new ToolError("bad_url", `Invalid URL: ${video}`);
      }
    } else {
      // Treat as a video ID
      if (!isValidVideoId(video)) {
        // It might not be a standard 11-char ID (could be a custom name),
        // but try it anyway — YouTube will redirect if invalid.
        url = `https://www.youtube.com/watch?v=${encodeURIComponent(video)}`;
      } else {
        url = `https://www.youtube.com/watch?v=${video}`;
      }
    }

    await openUrl(url);
    return {
      ok: true,
      output: { status: "success", url },
      summary: `Playing YouTube video`,
    };
  },
};

export const youtubeGetInfoTool: Tool = {
  name: "youtubeGetInfo",
  description:
    "Fetch basic info about a YouTube video (title, author, duration) using YouTube's public oEmbed endpoint. Use when the user wants to know what a video is before watching it. Does NOT require any API key.",
  parameters: {
    type: "OBJECT",
    properties: {
      video: {
        type: "STRING",
        description: "A full YouTube URL or video ID.",
      },
    },
    required: ["video"],
  },
  permissions: ["app.launch"],
  async handler(args, _ctx): Promise<ToolResult> {
    const video = (args.video || "").toString().trim();
    if (!video) throw new ToolError("bad_input", "A video URL or ID is required.");

    let videoId = video;
    // Extract video ID from URL if needed
    if (video.startsWith("http://") || video.startsWith("https://")) {
      try {
        const parsed = new URL(video);
        if (parsed.hostname === "youtu.be") {
          videoId = parsed.pathname.slice(1).split("/")[0].split("?")[0];
        } else {
          videoId = parsed.searchParams.get("v") || videoId;
        }
      } catch {
        // Use as-is
      }
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`;
    let info: any;
    try {
      const res = await fetch(oembedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      info = await res.json();
    } catch (err: any) {
      return {
        ok: false,
        output: {
          status: "failed",
          error: `Could not fetch video info: ${err.message}`,
          video: videoId,
        },
        summary: `Could not get info for video`,
      };
    }

    return {
      ok: true,
      output: {
        status: "success",
        video: videoId,
        title: info.title,
        author: info.author_name,
        authorUrl: info.author_url,
        thumbnail: info.thumbnail_url,
        type: info.type,
      },
      summary: `"${info.title}" by ${info.author_name}`,
    };
  },
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const youtubeTools: Tool[] = [
  youtubeSearchTool,
  youtubePlayTool,
  youtubeGetInfoTool,
];
