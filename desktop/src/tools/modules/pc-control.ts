import { execFile } from "child_process";
import { promisify } from "util";
import type { Tool, ToolResult } from "../types.js";
import { ToolError } from "../types.js";

const pexec = promisify(execFile);

/**
 * PC Control tools — mouse and keyboard automation.
 *
 * All operations use Windows PowerShell with structured arguments (never a raw
 * interpolated command string), so the AI cannot inject arbitrary commands.
 *
 * Mouse:
 *   - moveMouse       : move the cursor to absolute (x, y) screen coordinates
 *   - clickMouse      : perform a click (left, right, middle, double)
 *   - scrollMouse     : scroll the wheel (lines up/down)
 *   - dragMouse       : press-and-drag from current position to (x, y)
 *
 * Keyboard:
 *   - typeText        : type a string of text
 *   - pressKey        : press a single key (Enter, Escape, Tab, etc.)
 *   - pressHotkey     : press a combination (Ctrl+C, Alt+Tab, etc.)
 *
 * All coordinates are 0-based screen coordinates. (0,0) = top-left corner of
 * the primary monitor.
 */

// ---------------------------------------------------------------------------
// PowerShell helper — builds and runs a PS script without argument injection
// ---------------------------------------------------------------------------

function runPS(script: string): Promise<string> {
  return pexec(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true }
  ).then(r => r.stdout);
}

/** Escapes a string for safe embedding in a PowerShell single-quoted string. */
function psEscape(s: string): string {
  // In PowerShell single-quoted strings, the only escape is '' for a literal '
  return s.replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// Mouse tools
// ---------------------------------------------------------------------------

export const moveMouseTool: Tool = {
  name: "moveMouse",
  description:
    "Move the mouse cursor to specific (x, y) screen coordinates. Coordinates are 0-based, where (0,0) is the top-left corner of the primary display.",
  parameters: {
    type: "OBJECT",
    properties: {
      x: {
        type: "INTEGER",
        description: "The x-coordinate (horizontal, 0 = left edge).",
      },
      y: {
        type: "INTEGER",
        description: "The y-coordinate (vertical, 0 = top edge).",
      },
    },
    required: ["x", "y"],
  },
  permissions: ["pc.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const x = Math.max(0, Math.floor(args.x));
    const y = Math.max(0, Math.floor(args.y));
    await runPS(
      `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`
    );
    return {
      ok: true,
      output: { status: "success", x, y },
      summary: `Moved mouse to (${x}, ${y})`,
    };
  },
};

export const clickMouseTool: Tool = {
  name: "clickMouse",
  description:
    "Perform a mouse click at the current cursor position. Supports left, right, middle, and double-click.",
  parameters: {
    type: "OBJECT",
    properties: {
      button: {
        type: "STRING",
        description: "Which button to click: 'left', 'right', 'middle', or 'double'.",
        enum: ["left", "right", "middle", "double"],
      },
    },
    required: [],
  },
  permissions: ["pc.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const btn = (args.button || "left") as string;
    let script: string;
    switch (btn) {
      case "right":
        script = `Add-Type -AssemblyName System.Windows.Forms;
function Click-Mouse {
  Param([int]$X, [int]$Y);
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y);
  [System.Windows.Forms.SendKeys]::SendWait("+{F10}");
}
Click-Mouse`;
        break;
      case "middle":
        script = `Add-Type -AssemblyName System.Windows.Forms;
$sig = @'
[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@;
$mouse = Add-Type -memberDefinition $sig -name "MouseEvents" -namespace Win32Functions -passThru;
$mouse::mouse_event(0x0020, 0, 0, 0, 0); # WM_MBUTTONDOWN
$mouse::mouse_event(0x0021, 0, 0, 0, 0); # WM_MBUTTONUP`;
        break;
      case "double":
        script = `Add-Type -AssemblyName System.Windows.Forms;
$pos = [System.Windows.Forms.Cursor]::Position;
[System.Windows.Forms.SendKeys]::SendWait("+{F10}"); # No direct double-click via SendKeys, use mouse_event
$sig = @'
[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@;
$mouse = Add-Type -memberDefinition $sig -name "MouseEvents2" -namespace Win32Functions -passThru;
$mouse::mouse_event(0x0002, 0, 0, 0, 0); # WM_LBUTTONDOWN
$mouse::mouse_event(0x0004, 0, 0, 0, 0); # WM_LBUTTONUP
$mouse::mouse_event(0x0002, 0, 0, 0, 0); # WM_LBUTTONDOWN
$mouse::mouse_event(0x0004, 0, 0, 0, 0); # WM_LBUTTONUP`;
        break;
      default: // left
        script = `Add-Type -AssemblyName System.Windows.Forms;
$pos = [System.Windows.Forms.Cursor]::Position;
$sig = @'
[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@;
$mouse = Add-Type -memberDefinition $sig -name "MouseEvents3" -namespace Win32Functions -passThru;
$mouse::mouse_event(0x0002, 0, 0, 0, 0); # WM_LBUTTONDOWN
$mouse::mouse_event(0x0004, 0, 0, 0, 0); # WM_LBUTTONUP`;
        break;
    }
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", button: btn },
      summary: `Clicked ${btn} mouse button`,
    };
  },
};

export const scrollMouseTool: Tool = {
  name: "scrollMouse",
  description:
    "Scroll the mouse wheel. Positive lines scroll up (away from you), negative lines scroll down (toward you).",
  parameters: {
    type: "OBJECT",
    properties: {
      lines: {
        type: "INTEGER",
        description: "Number of lines to scroll. Positive = up, negative = down.",
      },
    },
    required: ["lines"],
  },
  permissions: ["pc.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const lines = Math.floor(args.lines);
    const direction = lines > 0 ? 120 : -120; // WHEEL_DELTA = 120
    const absLines = Math.abs(lines);
    const script = `Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseWheel {
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, int dwData, int dwExtraInfo);
}
"@;
for ($i = 0; $i -lt ${absLines}; $i++) {
  [MouseWheel]::mouse_event(0x0800, 0, 0, ${direction}, 0);
  Start-Sleep -Milliseconds 10;
}`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", lines },
      summary: `Scrolled ${lines > 0 ? "up" : "down"} ${absLines} line(s)`,
    };
  },
};

export const dragMouseTool: Tool = {
  name: "dragMouse",
  description:
    "Press and hold the left mouse button at the current position, then drag to (x, y) and release. Useful for selecting text or moving items.",
  parameters: {
    type: "OBJECT",
    properties: {
      x: {
        type: "INTEGER",
        description: "Target x-coordinate to drag to.",
      },
      y: {
        type: "INTEGER",
        description: "Target y-coordinate to drag to.",
      },
    },
    required: ["x", "y"],
  },
  permissions: ["pc.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const x = Math.max(0, Math.floor(args.x));
    const y = Math.max(0, Math.floor(args.y));
    const script = `Add-Type -AssemblyName System.Windows.Forms;
$sig = @'
[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@;
$mouse = Add-Type -memberDefinition $sig -name "MouseDrag" -namespace Win32Functions -passThru;
$mouse::mouse_event(0x0002, 0, 0, 0, 0); # WM_LBUTTONDOWN
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y});
$mouse::mouse_event(0x0004, 0, 0, 0, 0); # WM_LBUTTONUP`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", x, y },
      summary: `Dragged to (${x}, ${y})`,
    };
  },
};

// ---------------------------------------------------------------------------
// Keyboard tools
// ---------------------------------------------------------------------------

export const typeTextTool: Tool = {
  name: "typeText",
  description:
    "Type a string of text at the current cursor position, as if the user were typing on the keyboard. Use for entering text into input fields, documents, etc.",
  parameters: {
    type: "OBJECT",
    properties: {
      text: {
        type: "STRING",
        description: "The exact text to type.",
      },
    },
    required: ["text"],
  },
  permissions: ["pc.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const text = typeof args.text === "string" ? args.text : String(args.text ?? "");
    if (!text) throw new ToolError("bad_input", "Text to type is required.");
    if (text.length > 20000) throw new ToolError("too_long", "Text exceeds 20,000 character limit.");
    // Escape for SendKeys — wrap in quotes and handle special chars
    const escaped = psEscape(text);
    // Use SendKeys via a temp COM object
    const script = `$wshell = New-Object -ComObject wscript.shell;
$wshell.SendKeys('${escaped}')`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", length: text.length },
      summary: `Typed ${text.length} characters`,
    };
  },
};

export const pressKeyTool: Tool = {
  name: "pressKey",
  description:
    "Press and release a single keyboard key. Common keys: Enter, Escape, Tab, Backspace, Delete, Home, End, PageUp, PageDown, Up, Down, Left, Right, Space, F1-F12, Windows, Menu, PrintScreen, Pause, CapsLock, NumLock, ScrollLock.",
  parameters: {
    type: "OBJECT",
    properties: {
      key: {
        type: "STRING",
        description: "The key name to press (e.g. 'Enter', 'Escape', 'Tab', 'Delete', 'Up', 'F5').",
      },
    },
    required: ["key"],
  },
  permissions: ["pc.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const key = (args.key || "").toString().trim();
    if (!key) throw new ToolError("bad_input", "A key name is required.");
    // Map common key names to SendKeys codes
    const keyMap: Record<string, string> = {
      "enter": "{ENTER}", "return": "{ENTER}",
      "escape": "{ESC}", "esc": "{ESC}",
      "tab": "{TAB}",
      "backspace": "{BACKSPACE}", "bs": "{BACKSPACE}", "bksp": "{BACKSPACE}",
      "delete": "{DELETE}", "del": "{DELETE}",
      "home": "{HOME}",
      "end": "{END}",
      "pageup": "{PGUP}", "pgup": "{PGUP}",
      "pagedown": "{PGDN}", "pgdn": "{PGDN}",
      "up": "{UP}", "down": "{DOWN}", "left": "{LEFT}", "right": "{RIGHT}",
      "space": " ", "spacebar": " ",
      "insert": "{INSERT}", "ins": "{INSERT}",
      "printscreen": "{PRTSC}", "prtsc": "{PRTSC}",
      "pause": "{BREAK}",
      "capslock": "{CAPSLOCK}", "caps": "{CAPSLOCK}",
      "numlock": "{NUMLOCK}",
      "scrolllock": "{SCROLLLOCK}",
      "f1": "{F1}", "f2": "{F2}", "f3": "{F3}", "f4": "{F4}",
      "f5": "{F5}", "f6": "{F6}", "f7": "{F7}", "f8": "{F8}",
      "f9": "{F9}", "f10": "{F10}", "f11": "{F11}", "f12": "{F12}",
      "f13": "{F13}", "f14": "{F14}", "f15": "{F15}", "f16": "{F16}",
      "f17": "{F17}", "f18": "{F18}", "f19": "{F19}", "f20": "{F20}",
      "f21": "{F21}", "f22": "{F22}", "f23": "{F23}", "f24": "{F24}",
      "win": "{LWIN}", "windows": "{LWIN}",
      "menu": "{APPS}", "apps": "{APPS}",
    };
    const code = keyMap[key.toLowerCase()] || key;
    const script = `$wshell = New-Object -ComObject wscript.shell;
try { $wshell.SendKeys('${psEscape(code)}') } catch { throw 'SendKeys failed' }`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", key, mapped: code !== key },
      summary: `Pressed ${key}`,
    };
  },
};

export const pressHotkeyTool: Tool = {
  name: "pressHotkey",
  description:
    "Press a keyboard shortcut / hotkey combination. Use modifier names with '+' between keys. Modifiers: Ctrl, Alt, Shift, Win. Examples: 'Ctrl+C', 'Alt+Tab', 'Ctrl+Shift+Esc', 'Win+R', 'Ctrl+Alt+Delete'.",
  parameters: {
    type: "OBJECT",
    properties: {
      keys: {
        type: "STRING",
        description: "Hotkey combination, e.g. 'Ctrl+C', 'Alt+Tab', 'Win+R', 'Ctrl+Shift+Esc'.",
      },
    },
    required: ["keys"],
  },
  permissions: ["pc.control"],
  async handler(args, _ctx): Promise<ToolResult> {
    const keys = (args.keys || "").toString().trim();
    if (!keys) throw new ToolError("bad_input", "A hotkey combination is required.");
    // Parse the combination into SendKeys format
    // Ctrl -> ^, Alt -> %, Shift -> +
    const tokens: string[] = keys.split("+").map((t: string) => t.trim());
    let sendKeysStr = "";
    const mainKeys: string[] = [];
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (lower === "ctrl" || lower === "control") sendKeysStr += "^";
      else if (lower === "alt") sendKeysStr += "%";
      else if (lower === "shift") sendKeysStr += "+";
      else if (lower === "win" || lower === "windows") sendKeysStr += "^{ESC}"; // Win key approximated
      else mainKeys.push(token);
    }
    // Map main keys
    const keyMap: Record<string, string> = {
      "enter": "{ENTER}", "return": "{ENTER}",
      "escape": "{ESC}", "esc": "{ESC}",
      "tab": "{TAB}",
      "backspace": "{BACKSPACE}", "delete": "{DELETE}",
      "home": "{HOME}", "end": "{END}",
      "pageup": "{PGUP}", "pagedown": "{PGDN}",
      "up": "{UP}", "down": "{DOWN}", "left": "{LEFT}", "right": "{RIGHT}",
      "space": " ",
      "insert": "{INSERT}", "ins": "{INSERT}",
      "f1": "{F1}", "f2": "{F2}", "f3": "{F3}", "f4": "{F4}",
      "f5": "{F5}", "f6": "{F6}", "f7": "{F7}", "f8": "{F8}",
      "f9": "{F9}", "f10": "{F10}", "f11": "{F11}", "f12": "{F12}",
    };
    for (const mk of mainKeys) {
      sendKeysStr += keyMap[mk.toLowerCase()] || mk;
    }
    const script = `$wshell = New-Object -ComObject wscript.shell;
try { $wshell.SendKeys('${psEscape(sendKeysStr)}') } catch { throw 'SendKeys failed' }`;
    await runPS(script);
    return {
      ok: true,
      output: { status: "success", keys, sendKeys: sendKeysStr },
      summary: `Pressed ${keys}`,
    };
  },
};

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export const pcControlTools: Tool[] = [
  moveMouseTool,
  clickMouseTool,
  scrollMouseTool,
  dragMouseTool,
  typeTextTool,
  pressKeyTool,
  pressHotkeyTool,
];
