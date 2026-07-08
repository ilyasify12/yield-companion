/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface AppSettings {
  /** Enable hands-free wake word detection ("Mia" / "James"). */
  wakeWordEnabled: boolean;
  /** Enable desktop automation tool integration (PC control, media, YouTube). */
  desktopToolsEnabled: boolean;
  /** Selected microphone device ID (null = system default). */
  microphoneId: string | null;
  /** Whether PIN lock is enabled. */
  pinLockEnabled: boolean;
  /** SHA256 hash of the PIN code. */
  pinHash: string | null;
  /** Auto-lock after N minutes of inactivity (0 = never). */
  autoLockMinutes: number;
  /** Enable sound effects (connect/disconnect/notification). */
  soundEffectsEnabled: boolean;
  /** Enable periodic update checking. */
  autoUpdateCheck: boolean;
}

const DEFAULTS: AppSettings = {
  wakeWordEnabled: true,
  desktopToolsEnabled: true,
  microphoneId: null,
  pinLockEnabled: false,
  pinHash: null,
  autoLockMinutes: 0,
  soundEffectsEnabled: false,
  autoUpdateCheck: true,
};

const STORAGE_KEY = "aura-settings";

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with DEFAULTS so new keys aren't missing
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // Ignore corrupt localStorage
  }
  return { ...DEFAULTS };
}

function persistSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // Persist on every change
  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULTS });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
