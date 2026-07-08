/**
 * YIELD COMPANION — Electron Main Process
 *
 * Spawns both the Voice Server (port 3000) and the Desktop Service (port 3001),
 * then opens the YIELD COMPANION UI in a native window. On quit, both child processes are
 * cleaned up gracefully.
 *
 * Modes:
 *   npm run electron:dev   — uses tsx for hot-reload on both servers
 *   npm run electron:build — uses pre-built CJS bundles from dist/
 *   npm run dist           — packages everything into a .exe installer
 *
 * NOTE: This file uses .cjs extension so it always loads as CommonJS,
 * regardless of the "type":"module" setting in the root package.json.
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, session } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

// ── Load environment variables (GEMINI_API_KEY, etc.) ─────────────────────────
// In development dotenv loads .env from the project root automatically.
// In production the user needs to place .env alongside the app.
function loadDotEnv() {
  const searchPaths = [
    // Dev: project root
    path.resolve(__dirname, "..", ".env"),
    // Prod: alongside resources (where the user can place it post-install)
    path.join(process.resourcesPath, ".env"),
    // Prod: Electron userData directory (e.g. %APPDATA%/YIELD COMPANION)
    app.isPackaged ? path.join(app.getPath("userData"), ".env") : null,
  ].filter(Boolean);

  for (const envPath of searchPaths) {
    if (!fs.existsSync(envPath)) continue;
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      let count = 0;
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx <= 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        if (!key) continue;
        let val = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
          count++;
        }
      }
      console.log(`[electron] Loaded ${count} env var(s) from ${envPath}`);
      return; // Stop at first .env found
    } catch (err) {
      console.warn(`[electron] Failed to read ${envPath}:`, err.message);
    }
  }
  console.log("[electron] No .env file found — relying on system env vars");
}

loadDotEnv();

// ── Enable Web Speech API (wake word) ────────────────────────────────────────
// Electron disables SpeechRecognition by default on Windows. These flags ensure
// the user's microphone can be accessed by the renderer for wake-word detection.
app.commandLine.appendSwitch("enable-features", "WebSpeech,WebSpeechRecognizer");
app.commandLine.appendSwitch("enable-speech-dispatcher");

// ── Permission handler: auto-allow microphone for wake word ──────────────────
app.on("ready", () => {
  // Grant microphone, camera, clipboard, and media permissions so the wake word
  // detection and desktop tools work without an extra popup.
  const allowList = ["media", "mediaKeySystem", "clipboard-read", "clipboard-write"];
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowList.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return allowList.includes(permission);
  });
});

// ── Configuration ────────────────────────────────────────────────────────────

const IS_DEV = !app.isPackaged;
const ROOT_DIR = path.resolve(__dirname, "..");

// IMPORTANT: system node.exe cannot read files from inside the asar archive.
// We must use the "unpacked" directory (or extraResources) so spawned child
// processes can access the server files and their node_modules.
//   - Dev:  <project>/   (real files on disk)
//   - Prod: <resources>/app.asar.unpacked/   (files extracted by asarUnpack)
const APP_DIR = IS_DEV
  ? ROOT_DIR
  : path.join(process.resourcesPath, "app.asar.unpacked");

// In production, extraResources land at process.resourcesPath (e.g. …/resources/desktop/).
// In dev they're at ROOT_DIR/desktop/.
const DESKTOP_DIR = IS_DEV
  ? path.join(ROOT_DIR, "desktop")
  : path.join(process.resourcesPath, "desktop");

const MAIN_PORT = 3000;
const DESKTOP_PORT = 3001;

// Where the production-built server files live
// NOTE: MAIN_SERVER and DESKTOP_SERVER use APP_DIR / DESKTOP_DIR so they
// point to REAL files on disk that system node.exe can access.
const DIST_DIR = path.join(APP_DIR, "dist");
const SERVER_DIST_DIR = path.join(APP_DIR, "server-dist");
const MAIN_SERVER = path.join(SERVER_DIST_DIR, "server.cjs");
const DESKTOP_SERVER = IS_DEV
  ? path.join(DESKTOP_DIR, "src", "server.ts")
  : path.join(DESKTOP_DIR, "dist", "server.js");

// Icon paths
const ICON_PATH = path.join(ROOT_DIR, "assets", "icon.png");
// Fallback — create a minimal icon inline if the asset doesn't exist
let TRAY_ICON = null;
try {
  TRAY_ICON = nativeImage.createFromPath(ICON_PATH);
  if (TRAY_ICON.isEmpty()) TRAY_ICON = null;
} catch { /* ignore */ }

// ── State ────────────────────────────────────────────────────────────────────

let mainWindow = null;
let tray = null;
let mainServerProcess = null;
let desktopServerProcess = null;
let isQuitting = false;

// ── Node.js resolution ───────────────────────────────────────────────────────
// In production, we use Electron's own embedded Node.js (process.execPath)
// with the ELECTRON_RUN_AS_NODE flag. This avoids requiring the end-user to
// have a separate Node.js installation — the app bundles everything it needs.
//
// process.execPath returns the path to the app's executable (e.g.
// YIELD COMPANION.exe) which bundles Electron + Node.js. When spawned with
// ELECTRON_RUN_AS_NODE=1, it runs the child as a plain Node.js script with
// zero Electron overhead — no window, no GPU, no Chrome runtime.
// This is the standard pattern used by VS Code, Discord, Slack, etc.
//
// As a fallback we also search for a system Node.js installation.

const CHILD_NODE = IS_DEV ? "npx" : process.execPath;
const IS_DEV_SHELL = IS_DEV; // dev: use shell for npx; prod: direct binary

/** Try to find a system Node.js binary (returns null if not found). */
function findSystemNode() {
  // 1. Try the system PATH.
  try {
    const result = require("child_process").execSync("where node", { encoding: "utf8", timeout: 2000 });
    const first = result.split(/\r?\n/).filter(Boolean)[0];
    if (first && first.endsWith(".exe")) return first.trim();
  } catch { /* not in PATH */ }
  // 2. Check common install locations on Windows.
  const candidates = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs", "node.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "nodejs", "node.exe"),
    path.join(process.env.LOCALAPPDATA || "", "fnm", "nodejs", "node.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Volta", "tools", "node", "node.exe"),
    path.join(process.env.APPDATA || "", "npm", "node.exe"),
    path.join(process.env.SystemRoot || "C:\\Windows", "System32", "node.exe"),
  ];
  for (const p of candidates) {
    if (require("fs").existsSync(p)) return p;
  }
  return null;
}

// ── Process Spawners ─────────────────────────────────────────────────────────

/**
 * Spawn the main voice server (server.ts / dist/server.cjs).
 * Returns { process, readyPromise } — readyPromise resolves when the server
 * responds to health checks.
 */
function spawnMainServer() {
  return new Promise((resolve, reject) => {
    const cmd = CHILD_NODE;
    const args = IS_DEV
      ? ["tsx", MAIN_SERVER]
      : [MAIN_SERVER];

    // Filter out Electron's arguments so the server doesn't get confused
    const env = {
      ...process.env,
      NODE_ENV: IS_DEV ? "development" : "production",
      DESKTOP_TOOLS: "true",
      PORT: String(MAIN_PORT),
      // Tell the server where the desktop service resources live (for dynamic import of tools)
      DESKTOP_RESOURCES: DESKTOP_DIR,
      // In production, run via Electron's embedded Node.js (no window, no GPU)
      ...(IS_DEV ? {} : { ELECTRON_RUN_AS_NODE: "1" }),
    };

    console.log(`[electron] Starting main server: ${cmd} ${args.join(" ")}`);

    mainServerProcess = spawn(cmd, args, {
      cwd: APP_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: IS_DEV_SHELL,
      windowsHide: !IS_DEV,
    });

    mainServerProcess.stdout.on("data", (data) => {
      const text = data.toString();
      process.stdout.write(`[server] ${text}`);
    });

    mainServerProcess.stderr.on("data", (data) => {
      const text = data.toString();
      process.stderr.write(`[server:err] ${text}`);
    });

    mainServerProcess.on("error", (err) => {
      console.error("[electron] Main server process error:", err);
      reject(err);
    });

    mainServerProcess.on("exit", (code) => {
      console.log(`[electron] Main server exited (code=${code})`);
      mainServerProcess = null;
      if (!isQuitting && code !== 0) {
        dialog.showErrorBox(
          "Server Crashed",
          `The main voice server exited unexpectedly (code ${code}). The app will close.`
        );
        app.quit();
      }
    });

    // Poll for server readiness (resolve on timeout — don't block window creation)
    waitForServer(MAIN_PORT, 30_000).then(resolve).catch(resolve);
  });
}

/**
 * Spawn the desktop service (desktop/src/server.ts).
 * Returns a promise that resolves when the server responds to health checks,
 * or rejects if the process crashes or fails to start within timeout.
 * Collects stderr for diagnostic messages.
 */
function spawnDesktopService() {
  return doSpawnDesktopService(CHILD_NODE, !IS_DEV);
}

/**
 * Low-level spawn logic for the desktop service.
 * @param {string} nodeBin - Path to the Node.js binary
 * @param {boolean} useElectronRunAsNode - Whether to set ELECTRON_RUN_AS_NODE=1
 */
function doSpawnDesktopService(nodeBin, useElectronRunAsNode) {
  return new Promise((resolve, reject) => {
    const args = IS_DEV
      ? ["tsx", DESKTOP_SERVER]
      : [DESKTOP_SERVER];

    const env = {
      ...process.env,
      DESKTOP_PORT: String(DESKTOP_PORT),
      ALLOWED_ORIGINS: `http://localhost:${MAIN_PORT}`,
      NODE_ENV: IS_DEV ? "development" : "production",
    };

    // Only set ELECTRON_RUN_AS_NODE when spawning the Electron binary itself
    if (useElectronRunAsNode) {
      env.ELECTRON_RUN_AS_NODE = "1";
    }

    console.log(`[electron] Starting desktop service: ${nodeBin} ${args.join(" ")}`);

    const child = spawn(nodeBin, args, {
      cwd: DESKTOP_DIR,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: IS_DEV_SHELL,
      windowsHide: !IS_DEV,
    });

    desktopServerProcess = child;

    let settled = false;
    let stderrAccum = "";

    child.stdout.on("data", (data) => {
      process.stdout.write(`[desktop] ${data}`);
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderrAccum += text;
      process.stderr.write(`[desktop:err] ${text}`);
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      const msg = `Desktop service failed to start: ${err.message}`;
      console.error("[electron]", msg);
      if (mainWindow) {
        mainWindow.webContents.send("desktop-status", { status: "error", message: msg });
      }
      reject(err);
    });

    child.on("exit", (code) => {
      desktopServerProcess = null;
      if (settled) return;
      if (code !== 0) {
        settled = true;
        const detail = (stderrAccum.trim().slice(-600) || `(no stderr output)`)
            .replace(/\n/g, ' ⏎ ')
            .slice(0, 600);
        const msg = `Desktop service exited with code ${code}: ${detail}`;
        console.warn("[electron]", msg);
        if (mainWindow) {
          mainWindow.webContents.send("desktop-status", { status: "error", message: msg });
        }
        reject(new Error(msg));
      }
      // code === 0: clean exit during shutdown, no error
    });

    // Race health-check against timeout (reject on timeout)
    waitForServerOrCrash(DESKTOP_PORT, 15_000)
      .then(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          if (child.exitCode === null && !child.killed) {
            const msg = `Desktop service failed to become ready within 15s`;
            console.warn("[electron]", msg);
            reject(new Error(msg));
          }
        }
      });
  });
}

/**
 * Poll a server until it responds to GET /api/health or timeout (rejects on timeout).
 */
function waitForServerOrCrash(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let resolved = false;

    function check() {
      if (resolved) return;

      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolved = true;
          console.log(`[electron] Server on port ${port} is ready`);
          resolve();
        } else {
          retry();
        }
      });

      req.on("error", () => retry());
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (resolved) return;
      if (Date.now() - start > timeoutMs) {
        resolved = true;
        reject(new Error(`Server on port ${port} did not become ready within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 500);
    }

    check();
  });
}

/**
 * Poll a server until it responds to GET /api/health or timeout (resolves on timeout).
 * Used for the main server — the window opens regardless.
 */
function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let resolved = false;

    function check() {
      if (resolved) return;

      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolved = true;
          console.log(`[electron] Server on port ${port} is ready`);
          resolve();
        } else {
          retry();
        }
      });

      req.on("error", () => retry());
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (resolved) return;
      if (Date.now() - start > timeoutMs) {
        resolved = true;
        console.warn(`[electron] Server on port ${port} did not start within ${timeoutMs}ms — continuing anyway`);
        resolve();
        return;
      }
      setTimeout(check, 500);
    }

    check();
  });
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "YIELD COMPANION",
    icon: TRAY_ICON || undefined,
    backgroundColor: "#0f0f0f",
    show: false,
    // Frameless window — remove native Windows title bar for a custom look.
    // CSS `-webkit-app-region: drag` in the app's title bar restores dragging.
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show when ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  // Load the app
  mainWindow.loadURL(`http://localhost:${MAIN_PORT}`);

  // Let the title bar know when maximized state changes
  mainWindow.on("maximize", () => mainWindow.webContents.send("window-maximized", true));
  mainWindow.on("unmaximize", () => mainWindow.webContents.send("window-maximized", false));

  // Handle external links — open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      require("electron").shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      // Minimize to tray instead of closing
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── System Tray ──────────────────────────────────────────────────────────────

function createTray() {
  // Create a simple 16x16 tray icon
  const iconSize = 16;
  let trayIcon;

  if (TRAY_ICON) {
    trayIcon = TRAY_ICON.resize({ width: iconSize, height: iconSize });
  } else {
    // Create a simple colored square as fallback
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("YIELD COMPANION — Voice AI");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show YIELD COMPANION",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Toggle Desktop Service",
      type: "checkbox",
      checked: true,
      click: (menuItem) => {
        if (menuItem.checked) {
          startDesktopService();
        } else {
          stopDesktopService();
        }
      },
    },
    { type: "separator" },
    {
      label: "Open YIELD COMPANION in Browser",
      click: () => {
        require("electron").shell.openExternal(`http://localhost:${MAIN_PORT}`);
      },
    },
    {
      label: "Audit Log Folder",
      click: () => {
        const auditDir = path.join(DESKTOP_DIR, "audit");
        require("electron").shell.openPath(auditDir);
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log("[electron] App ready — starting servers...");

  // IPC handlers
  ipcMain.handle("get-app-version", () => {
    try { return require(path.join(ROOT_DIR, "package.json")).version; }
    catch { return "1.0.0"; }
  });

  // ── Update checking ────────────────────────────────────────────
  let updateCheckInterval = null;

  /** Fetch latest version info from the app's own backend API. */
  ipcMain.handle("check-for-update", async () => {
    try {
      const url = `http://127.0.0.1:${MAIN_PORT}/api/check-update`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return { updateAvailable: false, error: `HTTP ${response.status}` };
      return await response.json();
    } catch (err) {
      return { updateAvailable: false, error: err.message || "Update check failed" };
    }
  });

  /** Download the latest update installer to a temp location and return the path. */
  ipcMain.handle("download-update", async (_event, downloadUrl) => {
    try {
      const tmpDir = app.getPath("temp");
      const fileName = `YIELD-COMPANION-Update-${Date.now()}.exe`;
      const destPath = path.join(tmpDir, fileName);

      const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      require("fs").writeFileSync(destPath, buffer);

      return { success: true, filePath: destPath };
    } catch (err) {
      return { success: false, error: err.message || "Download failed" };
    }
  });

  /** Launch the downloaded installer. */
  ipcMain.on("install-update", (_event, filePath) => {
    if (!filePath || !require("fs").existsSync(filePath)) return;
    // Spawn the installer detached — it will replace the app on next launch
    require("child_process").spawn(filePath, ["/S"], {
      detached: true,
      stdio: "ignore",
    }).unref();
    app.quit();
  });

  /** Start periodic update checking (every N hours). */
  ipcMain.on("start-update-checker", () => {
    if (updateCheckInterval) clearInterval(updateCheckInterval);
    // Check every 6 hours
    updateCheckInterval = setInterval(async () => {
      try {
        const info = await checkUpdate();
        if (info.updateAvailable && mainWindow) {
          mainWindow.webContents.send("update-available", info);
        }
      } catch { /* silent */ }
    }, 6 * 60 * 60 * 1000);
  });

  ipcMain.on("stop-update-checker", () => {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
      updateCheckInterval = null;
    }
  });

  async function checkUpdate() {
    const url = `http://127.0.0.1:${MAIN_PORT}/api/check-update`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { updateAvailable: false };
    return await response.json();
  }

  // Window control handlers for the frameless title bar
  ipcMain.on("window-minimize", () => mainWindow?.minimize());
  ipcMain.on("window-maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window-close", () => mainWindow?.close());

  // Desktop service restart requested from the Settings panel
  ipcMain.handle("restart-desktop-service", async () => {
    console.log("[electron] Restarting desktop service (IPC request)...");
    stopDesktopService();
    // Wait for the old process to fully release the port
    await new Promise(r => setTimeout(r, 1000));

    // Try primary method: process.execPath + ELECTRON_RUN_AS_NODE
    try {
      await doSpawnDesktopService(CHILD_NODE, true);
      console.log("[electron] Desktop service restarted successfully");
      return { success: true };
    } catch (primaryErr) {
      console.warn("[electron] Primary desktop spawn failed:", primaryErr.message);
      // Fallback: try system Node.js (without ELECTRON_RUN_AS_NODE)
      const sysNode = findSystemNode();
      if (sysNode) {
        console.log("[electron] Retrying desktop service with system Node.js:", sysNode);
        stopDesktopService();
        await new Promise(r => setTimeout(r, 1000));
        try {
          await doSpawnDesktopService(sysNode, false);
          return { success: true };
        } catch (fallbackErr) {
          const msg = `process.execPath: ${primaryErr.message} | system node: ${fallbackErr.message}`;
          console.error("[electron] Both spawn methods failed:", msg);
          return { success: false, error: msg };
        }
      }
      return { success: false, error: primaryErr.message || "Desktop service failed to start" };
    }
  });

  // Start servers in parallel
  const serverStart = spawnMainServer();
  const desktopStart = spawnDesktopService().catch((err) => {
    console.warn("[electron] Desktop service failed to start:", err.message);
    // Non-fatal
  });

  // Wait for main server at minimum
  await serverStart;
  console.log("[electron] Main server ready — creating window...");

  createWindow();
  createTray();

  // Desktop service can finish starting in the background
  try { await desktopStart; } catch { /* handled above */ }
});

app.on("window-all-closed", () => {
  // Don't quit on macOS (dock pattern)
  if (process.platform !== "darwin") {
    // On Windows, we keep running in the tray
    // Only quit if user explicitly chose Quit
  }
});

app.on("activate", () => {
  // macOS: re-create window when dock icon is clicked
  if (!mainWindow) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  console.log("[electron] Shutting down...");
  cleanup();
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

function cleanup() {
  if (mainServerProcess) {
    console.log("[electron] Stopping main server...");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(mainServerProcess.pid), "/f", "/t"]);
    } else {
      mainServerProcess.kill("SIGTERM");
    }
    mainServerProcess = null;
  }

  if (desktopServerProcess) {
    console.log("[electron] Stopping desktop service...");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(desktopServerProcess.pid), "/f", "/t"]);
    } else {
      desktopServerProcess.kill("SIGTERM");
    }
    desktopServerProcess = null;
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
}

// ── Utility: start/stop desktop service from tray ────────────────────────────

async function startDesktopService() {
  if (desktopServerProcess) return;
  try {
    await spawnDesktopService();
  } catch (err) {
    console.error("[electron] Failed to restart desktop service:", err);
  }
}

function stopDesktopService() {
  if (!desktopServerProcess) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(desktopServerProcess.pid), "/f", "/t"]);
  } else {
    desktopServerProcess.kill("SIGTERM");
  }
  desktopServerProcess = null;
}
