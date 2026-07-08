import { execFile } from "child_process";
import { promisify } from "util";
import type { Tool, ToolResult } from "../types.js";
import { ToolError } from "../types.js";

const pexec = promisify(execFile);

/**
 * Media Player Control tools.
 *
 * Sends system-wide media keys (play/pause, next, previous, stop, volume)
 * so the user can control whatever media player is currently active (Spotify,
 * YouTube in browser, VLC, Windows Media Player, etc.).
 *
 * On Windows this uses user32.dll keybd_event with the standard multimedia
 * virtual key codes, which all modern media players respond to.
 *
 * Volume is managed via the core audio API (Windows Vista+).
 */

// ---------------------------------------------------------------------------
// PowerShell helper — builds and runs a PS script safely
// ---------------------------------------------------------------------------

function runPS(script: string): Promise<string> {
  return pexec(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true }
  ).then(r => r.stdout);
}

/**
 * Send a virtual key press via keybd_event (user32.dll).
 * The script template takes a hex virtual-key code.
 */
function sendKeyPS(vkHex: string): string {
  return `$sig = @'
[DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
'@;
$k = Add-Type -memberDefinition $sig -name "MediaKeys_${vkHex}" -namespace Win32Functions -passThru;
$k::keybd_event(${vkHex}, 0, 0, [UIntPtr]::Zero);
$k::keybd_event(${vkHex}, 0, 2, [UIntPtr]::Zero);`;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const mediaPlayPauseTool: Tool = {
  name: "mediaPlayPause",
  description:
    "Toggle play/pause for the current media player (Spotify, YouTube, VLC, etc.). Sends the system media play/pause key.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["media.control"],
  async handler(_args, _ctx): Promise<ToolResult> {
    await runPS(sendKeyPS("0xB3")); // VK_MEDIA_PLAY_PAUSE
    return {
      ok: true,
      output: { status: "success", action: "play_pause" },
      summary: "Toggled play/pause",
    };
  },
};

export const mediaNextTrackTool: Tool = {
  name: "mediaNextTrack",
  description:
    "Skip to the next track in the current media player. Sends the system 'next track' media key.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["media.control"],
  async handler(_args, _ctx): Promise<ToolResult> {
    await runPS(sendKeyPS("0xB0")); // VK_MEDIA_NEXT_TRACK
    return {
      ok: true,
      output: { status: "success", action: "next" },
      summary: "Skipped to next track",
    };
  },
};

export const mediaPrevTrackTool: Tool = {
  name: "mediaPrevTrack",
  description:
    "Go back to the previous track in the current media player. Sends the system 'previous track' media key.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["media.control"],
  async handler(_args, _ctx): Promise<ToolResult> {
    await runPS(sendKeyPS("0xB1")); // VK_MEDIA_PREV_TRACK
    return {
      ok: true,
      output: { status: "success", action: "previous" },
      summary: "Went to previous track",
    };
  },
};

export const mediaStopTool: Tool = {
  name: "mediaStop",
  description:
    "Stop playback in the current media player. Sends the system 'stop' media key.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["media.control"],
  async handler(_args, _ctx): Promise<ToolResult> {
    await runPS(sendKeyPS("0xB2")); // VK_MEDIA_STOP
    return {
      ok: true,
      output: { status: "success", action: "stop" },
      summary: "Stopped playback",
    };
  },
};

export const mediaVolumeSetTool: Tool = {
  name: "mediaVolumeSet",
  description:
    "Set the system master volume to a specific level (0-100).",
  parameters: {
    type: "OBJECT",
    properties: {
      level: {
        type: "INTEGER",
        description: "Target volume level from 0 (mute) to 100 (maximum).",
      },
    },
    required: ["level"],
  },
  permissions: ["media.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const level = Math.max(0, Math.min(100, Math.floor(args.level)));
    const script = `$wshell = New-Object -ComObject wscript.shell;
for ($i = 0; $i -lt 100; $i++) { $wshell.SendKeys([char]174) }; # volume down 100x to floor
for ($i = 0; $i -lt ${level}; $i++) { $wshell.SendKeys([char]175) }; # volume up to target`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", level },
      summary: `Set volume to ${level}%`,
    };
  },
};

export const mediaVolumeUpTool: Tool = {
  name: "mediaVolumeUp",
  description:
    "Increase the system master volume by a given number of steps (default 5). Each step is roughly 1-2%.",
  parameters: {
    type: "OBJECT",
    properties: {
      steps: {
        type: "INTEGER",
        description: "Number of volume steps to increase (default 5).",
      },
    },
    required: [],
  },
  permissions: ["media.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const steps = Math.max(1, Math.min(100, Math.floor(args.steps ?? 5)));
    const script = `$wshell = New-Object -ComObject wscript.shell;
for ($i = 0; $i -lt ${steps}; $i++) { $wshell.SendKeys([char]175); Start-Sleep -Milliseconds 20 }`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", steps, direction: "up" },
      summary: `Increased volume by ${steps} steps`,
    };
  },
};

export const mediaVolumeDownTool: Tool = {
  name: "mediaVolumeDown",
  description:
    "Decrease the system master volume by a given number of steps (default 5). Each step is roughly 1-2%.",
  parameters: {
    type: "OBJECT",
    properties: {
      steps: {
        type: "INTEGER",
        description: "Number of volume steps to decrease (default 5).",
      },
    },
    required: [],
  },
  permissions: ["media.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const steps = Math.max(1, Math.min(100, Math.floor(args.steps ?? 5)));
    const script = `$wshell = New-Object -ComObject wscript.shell;
for ($i = 0; $i -lt ${steps}; $i++) { $wshell.SendKeys([char]174); Start-Sleep -Milliseconds 20 }`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", steps, direction: "down" },
      summary: `Decreased volume by ${steps} steps`,
    };
  },
};

export const mediaMuteTool: Tool = {
  name: "mediaMute",
  description:
    "Mute or unmute the system audio. Sends the system mute key to toggle.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["media.control"],
  async handler(_args, _ctx): Promise<ToolResult> {
    await runPS(sendKeyPS("0xAD")); // VK_VOLUME_MUTE
    return {
      ok: true,
      output: { status: "success", action: "mute_toggle" },
      summary: "Toggled mute",
    };
  },
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const mediaControlTools: Tool[] = [
  mediaPlayPauseTool,
  mediaNextTrackTool,
  mediaPrevTrackTool,
  mediaStopTool,
  mediaVolumeSetTool,
  mediaVolumeUpTool,
  mediaVolumeDownTool,
  mediaMuteTool,
];
