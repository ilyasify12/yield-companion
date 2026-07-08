/**
 * Type declarations for the Electron preload bridge (electronAPI).
 *
 * These are injected by the preload script when the app runs inside Electron.
 * In the browser (dev without Electron), window.electronAPI is undefined.
 */

interface ElectronAPI {
  /** Get the app version from package.json. */
  getAppVersion: () => Promise<string>;

  /** Listen for desktop-service status changes. Returns an unsubscribe function. */
  onDesktopStatus: (callback: (data: any) => void) => () => void;

  /** Listen for system notifications. Returns an unsubscribe function. */
  onNotification: (callback: (data: any) => void) => () => void;

  // ── Window controls (frameless title bar) ──────────────────────────────

  /** Minimize the window. */
  minimize: () => void;

  /** Toggle maximize/restore. */
  maximize: () => void;

  /** Close the window. */
  close: () => void;

  /** Listen for maximize/unmaximize state changes. Returns an unsubscribe function. */
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;

  /** Platform string (win32 / darwin / linux). */
  platform: NodeJS.Platform;

  // ── Desktop service ───────────────────────────────────────────────────

  /** Ask the main process to restart the desktop service process. Returns { success, error? }. */
  restartDesktopService: () => Promise<{ success: boolean; error?: string }>;

  // ── Update system ──────────────────────────────────────────────

  /** Check GitHub for a new version. */
  checkForUpdate: () => Promise<any>;

  /** Download the latest update installer. Returns { success, filePath, error? }. */
  downloadUpdate: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;

  /** Launch the downloaded installer and quit. */
  installUpdate: (filePath: string) => void;

  /** Start periodic update checking. */
  startUpdateChecker: () => void;

  /** Stop periodic update checking. */
  stopUpdateChecker: () => void;

  /** Listen for background update notifications. Returns an unsubscribe function. */
  onUpdateAvailable: (callback: (data: any) => void) => () => void;
}

export {};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
