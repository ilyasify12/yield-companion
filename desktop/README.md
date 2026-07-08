# Aura Desktop Companion Service

A secure, local-only HTTP + WebSocket service that gives the Aura Voice AI
safe access to the user's desktop environment — files, apps, clipboard, and
screen capture.

## Architecture

```
┌──────────────────┐      REST (3001)      ┌──────────────────────┐
│  Aura Voice AI   │ ───────────────────→  │  Desktop Service     │
│  (server.ts)     │ ←───────────────────  │  (desktop/src/)      │
│                  │     tool_result        │                      │
│  merges desktop  │                        │  ToolManager          │
│  tool decls      │      WS /events        │   ├─ schema (zod)    │
│  into LIVE_TOOLS │ ←────────────────────  │   ├─ permissions     │
│                  │                        │   └─ handler         │
│  inject_image ───│─────────────────────→  │                      │
│  (screenshot)    │   WS (port 3000)       │  Audit log (JSONL)   │
└──────────────────┘                        └──────────────────────┘
```

## Quick Start

```bash
# 1. Install dependencies
cd desktop
npm install

# 2. Configure (optional — defaults work out of the box)
cp .env.example .env
# Edit .env to change DESKTOP_PORT or PERMISSION_MODE

# 3. Run
npm run dev        # tsx watch (hot-reload)
# OR
npm start          # plain tsx
```

The service starts on **http://127.0.0.1:3001** by default.

## Available Tools

| Tool                    | Permission       | Description                              |
|-------------------------|------------------|------------------------------------------|
| `openFile`              | file.open        | Open a file with the OS default handler  |
| `openFolder`            | file.open        | Open a folder in Explorer/Finder         |
| `revealInExplorer`      | file.open        | Select a file in Explorer/Finder         |
| `searchFiles`           | file.search      | Recursive file search by name            |
| `openUrl`               | file.open        | Open a URL in the system default browser |
| `launchApp`             | app.launch       | Launch an app from the Start Menu        |
| `openVideo`             | file.open        | Open a video file (typed wrapper)        |
| `openPdf`               | file.open        | Open a PDF file (typed wrapper)          |
| `openImage`             | file.open        | Open an image file (typed wrapper)       |
| `readClipboard`         | clipboard.read   | Read the system clipboard                |
| `writeClipboard`        | clipboard.write  | Write text to the system clipboard       |
| `getCurrentTime`        | system.info      | Return current date/time                 |
| `getCurrentWorkingDirectory` | system.info | Return the CWD                           |
| `listDrives`            | system.info      | List available drives                    |
| `listCommonFolders`     | system.info      | List common user folders (Desktop, Documents, etc.) |
| `captureScreen`         | screen.capture   | Screenshot the primary display           |
| `captureActiveWindow`   | screen.capture   | Screenshot the active window             |

## Permission Model

Default: **allow silently** + full audit logging. Every tool execution is
recorded in `audit/audit.jsonl`. The `permissions.manager.ts` supports
`allow` / `prompt` / `deny` modes per-tool, so hardening the policy never
requires tool code changes.

Set `PERMISSION_MODE=deny` or `PERMISSION_MODE=prompt` in `.env` to tighten.

## Design Decisions

- **Separate process on port 3001** — the desktop service runs alongside the
  voice server (port 3000), keeping privileged OS access isolated.
- **screenshot-desktop + sharp** for screen capture — fast, cross-platform,
  with auto-orient and JPEG downscaling.
- **Path traversal protection** — all file tools use `safeResolve()` which
  prevents escaping the user's allowed directories.
- **No arbitrary shell execution** — `launchApp` probes the Start Menu; it
  cannot run arbitrary commands.
- **Existing browser tools unchanged** — `openWebsite`, `searchGoogle`,
  `playSong`, `copyToClipboard`, `getCurrentTime` stay in the browser.
  Only new desktop tools route through this service.

## Frontend Integration

The voice server (`server.ts` at the project root):
1. Imports `getToolDeclarations()` from `desktop/src/tools/index.js`
2. Merges them into the `LIVE_TOOLS` array so Gemini knows about desktop tools
3. When a desktop tool is called: the frontend POSTs to the Desktop Service,
   then sends results back to Gemini via `tool_result`
4. Screen captures also send `inject_image` — the image is injected into the
   Gemini Live session as a vision frame

## API Endpoints

```
GET  /api/health          → service status + version
GET  /api/tools           → registered tool declarations
POST /api/tools/:name     → execute a tool
GET  /events              → WebSocket for live log/status events
```
