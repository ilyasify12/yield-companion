/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import {
  X,
  Ear,
  Monitor,
  RotateCcw,
  Info,
  Wifi,
  Server,
  Sparkles,
  Mic,
  ChevronDown,
  Lock,
  RefreshCw,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { useState, useEffect, useCallback } from "react";
import { desktopClient } from "../desktop/client";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  desktopAvailable: boolean;
  desktopState: string;
  onSetupPin?: () => void;
  onCheckUpdate?: () => void;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function SettingsPanel({
  isOpen,
  onClose,
  desktopAvailable,
  desktopState,
  onSetupPin,
  onCheckUpdate,
}: SettingsPanelProps) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const [micDevices, setMicDevices] = useState<AudioDevice[]>([]);
  const [micPickerOpen, setMicPickerOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [restartSuccess, setRestartSuccess] = useState(false);

  // Enumerate audio input devices on mount & when panel opens
  const enumerateMics = useCallback(async () => {
    try {
      // Request permission so labels are available
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter(d => d.kind === "audioinput")
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone (${d.deviceId.slice(0, 8)}...)` }));
      setMicDevices(inputs);
    } catch {
      // Silently fail — mic selection just won't show
    }
  }, []);

  useEffect(() => {
    if (isOpen) enumerateMics();
  }, [isOpen, enumerateMics]);

  // Re-enumerate when devices change (e.g. USB mic plugged in)
  useEffect(() => {
    const handler = () => enumerateMics();
    navigator.mediaDevices?.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", handler);
  }, [enumerateMics]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      className="fixed inset-y-0 right-0 w-full sm:w-[420px] h-full bg-[#080A12]/90 border-l border-white/10 z-50 flex flex-col backdrop-blur-2xl shadow-2xl"
    >
      {/* ── Header ── */}
      <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#7C5CFF]/30 to-transparent" />
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
            <Sparkles className="w-4 h-4 text-[#7C5CFF]" />
          </div>
          <div>
            <h2 className="text-xs font-display font-bold tracking-wide text-white uppercase">
              Settings
            </h2>
            <p className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">
              Companion Configuration
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.15] text-gray-400 hover:text-white transition-all duration-200 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

        {/* ---- Section: Wake Word ---- */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-[#7C5CFF]/10 border border-[#7C5CFF]/20">
              <Ear className="w-3.5 h-3.5 text-[#A288FF]" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wide">
                Wake Word
              </h3>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Hands-free activation
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-2">
            <div>
              <span className="text-xs text-gray-200">Enable Wake Word</span>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Say &ldquo;Mia&rdquo; or &ldquo;James&rdquo; to start a session hands-free
              </p>
            </div>
            <button
              onClick={() => updateSetting("wakeWordEnabled", !settings.wakeWordEnabled)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                settings.wakeWordEnabled
                  ? "bg-[#7C5CFF] shadow-[0_0_12px_rgba(124,92,255,0.3)]"
                  : "bg-white/[0.08]"
              }`}
              role="switch"
              aria-checked={settings.wakeWordEnabled}
            >
              <motion.div
                animate={{ x: settings.wakeWordEnabled ? 20 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 bg-white rounded-full shadow-md"
                style={{ width: "18px", height: "18px", marginTop: "3px" }}
              />
            </button>
          </div>

          {/* Continuous Listening toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <span className="text-xs text-gray-200">Continuous Listening</span>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Keep mic hot — talk freely after wake word activates
              </p>
            </div>
            <button
              onClick={() => updateSetting("continuousListening", !settings.continuousListening)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                settings.continuousListening
                  ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : "bg-white/[0.08]"
              }`}
              role="switch"
              aria-checked={settings.continuousListening}
            >
              <motion.div
                animate={{ x: settings.continuousListening ? 20 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 bg-white rounded-full shadow-md"
                style={{ width: "18px", height: "18px", marginTop: "3px" }}
              />
            </button>
          </div>
        </section>

        {/* ---- Section: Microphone ---- */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wide">
                Microphone
              </h3>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Select audio input device
              </p>
            </div>
          </div>

          {/* Mic picker dropdown */}
          <div className="relative">
            <button
              onClick={() => setMicPickerOpen(!micPickerOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Mic className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-gray-200 block truncate">
                    {settings.microphoneId
                      ? micDevices.find(d => d.deviceId === settings.microphoneId)?.label || "Selected mic"
                      : "System Default Microphone"}
                  </span>
                  <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                    {micDevices.length} device{micDevices.length !== 1 ? "s" : ""} available
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${micPickerOpen ? "rotate-180" : ""}`} />
            </button>

            {micPickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute z-20 left-0 right-0 mt-1 rounded-xl bg-[#0F1119] border border-white/[0.08] shadow-2xl overflow-hidden"
              >
                {/* Default option */}
                <button
                  onClick={() => { updateSetting("microphoneId", null); setMicPickerOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/[0.04] cursor-pointer ${
                    !settings.microphoneId ? "text-white bg-white/[0.06]" : "text-gray-400"
                  }`}
                >
                  <Mic className="w-3 h-3 shrink-0" />
                  <span>System Default</span>
                </button>
                {micDevices.map((dev) => (
                  <button
                    key={dev.deviceId}
                    onClick={() => { updateSetting("microphoneId", dev.deviceId); setMicPickerOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/[0.04] cursor-pointer truncate ${
                      settings.microphoneId === dev.deviceId ? "text-white bg-white/[0.06]" : "text-gray-400"
                    }`}
                  >
                    <Mic className="w-3 h-3 shrink-0" />
                    <span className="truncate">{dev.label}</span>
                  </button>
                ))}
                {micDevices.length === 0 && (
                  <div className="px-4 py-3 text-[10px] text-gray-500 font-mono">
                    No microphones detected
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>

        {/* ---- Section: Desktop Tools ---- */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wide">
                Desktop Integration
              </h3>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                PC control, media, YouTube
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-2">
            <div>
              <span className="text-xs text-gray-200">Enable Desktop Tools</span>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Let the companion control your PC, media, and more
              </p>
            </div>
            <button
              onClick={() => updateSetting("desktopToolsEnabled", !settings.desktopToolsEnabled)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                settings.desktopToolsEnabled
                  ? "bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  : "bg-white/[0.08]"
              }`}
              role="switch"
              aria-checked={settings.desktopToolsEnabled}
            >
              <motion.div
                animate={{ x: settings.desktopToolsEnabled ? 20 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 bg-white rounded-full shadow-md"
                style={{ width: "18px", height: "18px", marginTop: "3px" }}
              />
            </button>
          </div>

          {/* Desktop service status */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Server className="w-3 h-3 text-gray-500" />
              <div>
                <span className="text-xs text-gray-200">Desktop Service</span>
                <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                  Local automation server on port 3001
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  desktopAvailable
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse"
                    : "bg-rose-500/50"
                }`}
              />
              <span className="text-[10px] font-mono text-gray-400">
                {desktopState === "connected"
                  ? "Connected"
                  : desktopState === "connecting"
                  ? "Connecting"
                  : desktopState === "error"
                  ? "Offline"
                  : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Restart / Retry button */}
          {/* Show Context Panel toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-200">Screen Context Panel</span>
              </div>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Show window, clipboard & cursor info when AI examines context
              </p>
            </div>
            <button
              onClick={() => updateSetting("showContextPanel", !settings.showContextPanel)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                settings.showContextPanel
                  ? "bg-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  : "bg-white/[0.08]"
              }`}
              role="switch"
              aria-checked={settings.showContextPanel}
            >
              <motion.div
                animate={{ x: settings.showContextPanel ? 20 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 bg-white rounded-full shadow-md"
                style={{ width: "18px", height: "18px", marginTop: "3px" }}
              />
            </button>
          </div>

          {restartError && (
            <div className="mt-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-300">
              {restartError}
            </div>
          )}
          <button
            onClick={async () => {
              setRestarting(true);
              setRestartError(null);
              try {
                // 1. If in Electron, restart the actual process first
                if (window.electronAPI?.restartDesktopService) {
                  const result = await window.electronAPI.restartDesktopService();
                  if (!result.success) {
                    setRestartError(result.error || "Desktop service failed to restart. Check that the service executable exists.");
                    setRestarting(false);
                    return;
                  }
                  // 2. Wait for the service to initialize
                  await new Promise(r => setTimeout(r, 2000));
                }
                // 3. Reset the WS client and reconnect
                desktopClient.resetReconnect();
                desktopClient.disconnect();
                desktopClient.connect();
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Unknown error";
                setRestartError(`Restart failed: ${msg}`);
              } finally {
                setRestarting(false);
              }
            }}
            disabled={restarting}
            className={`mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 text-[11px] font-mono cursor-pointer ${
              restarting
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 cursor-wait"
                : restartError
                ? "bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40"
                : "bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 text-gray-400 hover:text-cyan-400"
            }`}
          >
            <RotateCcw className={`w-3 h-3 ${restarting ? "animate-spin" : ""}`} />
            {restarting ? "Restarting..." : restartError ? "Retry Restart" : "Restart Desktop Service"}
          </button>
        </section>

        {/* ---- Section: Sound Effects ---- */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wide">
                Sound Effects
              </h3>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Audio feedback for events
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <span className="text-xs text-gray-200">Enable Sounds</span>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Play sounds on connect, disconnect, and notifications
              </p>
            </div>
            <button
              onClick={() => updateSetting("soundEffectsEnabled", !settings.soundEffectsEnabled)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                settings.soundEffectsEnabled
                  ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                  : "bg-white/[0.08]"
              }`}
              role="switch"
              aria-checked={settings.soundEffectsEnabled}
            >
              <motion.div
                animate={{ x: settings.soundEffectsEnabled ? 20 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 bg-white rounded-full shadow-md"
                style={{ width: "18px", height: "18px", marginTop: "3px" }}
              />
            </button>
          </div>
        </section>

        {/* ---- Section: App Lock ---- */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-[#7C5CFF]/10 border border-[#7C5CFF]/20">
              <Lock className="w-3.5 h-3.5 text-[#A288FF]" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wide">
                App Lock
              </h3>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                PIN protection & auto-lock
              </p>
            </div>
          </div>

          {/* PIN lock toggle */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-2">
            <div>
              <span className="text-xs text-gray-200">PIN Lock</span>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                {settings.pinHash ? "Change or remove PIN" : "Set a 6-digit PIN to lock the app"}
              </p>
            </div>
            <button
              onClick={() => {
                if (settings.pinLockEnabled) {
                  // Disable PIN lock (requires re-setup next time)
                  updateSetting("pinLockEnabled", false);
                  updateSetting("pinHash", null);
                } else {
                  // Start PIN setup
                  onSetupPin?.();
                }
              }}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                settings.pinLockEnabled
                  ? "bg-[#7C5CFF] shadow-[0_0_12px_rgba(124,92,255,0.3)]"
                  : "bg-white/[0.08]"
              }`}
              role="switch"
              aria-checked={settings.pinLockEnabled}
            >
              <motion.div
                animate={{ x: settings.pinLockEnabled ? 20 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4.5 h-4.5 bg-white rounded-full shadow-md"
                style={{ width: "18px", height: "18px", marginTop: "3px" }}
              />
            </button>
          </div>

          {/* Auto-lock timeout (only visible when PIN is enabled) */}
          {settings.pinLockEnabled && (
            <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-200">Auto-Lock Timer</span>
                  <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                    Lock after {settings.autoLockMinutes > 0 ? `${settings.autoLockMinutes} min` : "never"} of inactivity
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {[0, 1, 5, 15, 30].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => updateSetting("autoLockMinutes", mins)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                      settings.autoLockMinutes === mins
                        ? "bg-[#7C5CFF]/20 text-[#A288FF] border border-[#7C5CFF]/30"
                        : "bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]"
                    }`}
                  >
                    {mins === 0 ? "Off" : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---- Section: Updates ---- */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wide">
                Updates
              </h3>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                Check for new versions
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-2">
            <div>
              <span className="text-xs text-gray-200">Check for Updates</span>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                See if a newer version is available
              </p>
            </div>
            <button
              onClick={() => onCheckUpdate?.()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C5CFF]/10 border border-[#7C5CFF]/20 hover:bg-[#7C5CFF]/20 text-[#A288FF] text-[10px] font-mono transition-all cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Check Now
            </button>
          </div>
        </section>
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 rounded-lg bg-gray-500/10 border border-gray-500/20">
              <Info className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white tracking-wide">
                About
              </h3>
              <p className="text-[9px] font-mono text-gray-500 mt-0.5">
                YIELD COMPANION
              </p>
            </div>
          </div>

          <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-400">Version</span>
              <span className="text-[11px] font-mono text-gray-200">1.2.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-400">Model</span>
              <span className="text-[11px] font-mono text-gray-200">Gemini 3.1 Flash Live</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-gray-400">Desktop Tools</span>
              <span className="text-[11px] font-mono text-gray-200">35 registered</span>
            </div>
          </div>

          {/* Reset settings */}
          <button
            onClick={resetSettings}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 text-gray-400 hover:text-rose-400 transition-all duration-200 text-[11px] font-mono cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Defaults
          </button>
        </section>

      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
        <div className="flex items-center justify-center gap-2 text-[8px] font-mono text-gray-600 uppercase tracking-wider">
          <Wifi className="w-2.5 h-2.5" />
          Settings are saved locally
        </div>
      </div>
    </motion.div>
  );
}
