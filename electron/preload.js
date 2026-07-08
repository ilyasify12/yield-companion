/**
 * YIELD COMPANION — Preload Script
 *
 * Exposes a minimal, safe API to the renderer process via contextBridge:
 *   - window.electronAPI.getAppVersion()
 *   - window.electronAPI.onDesktopStatus(callback)
 *   - window.electronAPI.platform
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  /** Get the app version string (from package.json). */
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  /** Listen for desktop-service status updates. */
  onDesktopStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("desktop-status", handler);
    return () => ipcRenderer.removeListener("desktop-status", handler);
  },

  /** Listen for system notifications from the main process. */
  onNotification: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("notification", handler);
    return () => ipcRenderer.removeListener("notification", handler);
  },

  // ── Window controls (frameless title bar) ────────────────────────────────

  /** Minimize the window. */
  minimize: () => ipcRenderer.send("window-minimize"),

  /** Toggle maximize/restore. */
  maximize: () => ipcRenderer.send("window-maximize"),

  /** Close the window. */
  close: () => ipcRenderer.send("window-close"),

  /** Listen for maximize/unmaximize state changes. */
  onMaximizedChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on("window-maximized", handler);
    return () => ipcRenderer.removeListener("window-maximized", handler);
  },

  /** Platform string (win32 / darwin / linux). */
  platform: process.platform,

  // ── Desktop service ─────────────────────────────────────────────────────

  /** Request the main process to restart the desktop service. */
  restartDesktopService: () => ipcRenderer.invoke("restart-desktop-service"),

  // ── Update system ──────────────────────────────────────────────

  /** Check GitHub for a new version. */
  checkForUpdate: () => ipcRenderer.invoke("check-for-update"),

  /** Download the latest installer. */
  downloadUpdate: (url) => ipcRenderer.invoke("download-update", url),

  /** Launch the downloaded installer and quit. */
  installUpdate: (filePath) => ipcRenderer.send("install-update", filePath),

  /** Start periodic update checks. */
  startUpdateChecker: () => ipcRenderer.send("start-update-checker"),

  /** Stop periodic update checks. */
  stopUpdateChecker: () => ipcRenderer.send("stop-update-checker"),

  /** Listen for background update notifications. */
  onUpdateAvailable: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("update-available", handler);
    return () => ipcRenderer.removeListener("update-available", handler);
  },
});
