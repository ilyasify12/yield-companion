/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Plugin System — allows third-party scripts to extend companion capabilities.
 *
 * Architecture:
 *   - Plugins are stored in the user's plugins directory (%APPDATA%/YIELD COMPANION/plugins/)
 *   - Each plugin is a folder with a plugin.json manifest + optional JS/TS files
 *   - Plugins can register tools, hooks (onMessage, onToolCall), and config UI
 *   - The PluginManager loads, validates, and sandboxes plugins
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Puzzle, Plus, Trash2, Play, Square, AlertCircle,
  CheckCircle, RefreshCw, ExternalLink, FolderOpen,
  Settings2, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

export interface PluginManifest {
  /** Unique plugin ID (kebab-case). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Version (semver). */
  version: string;
  /** Short description. */
  description: string;
  /** Author name or handle. */
  author?: string;
  /** Minimum app version required. */
  minAppVersion?: string;
  /** Tools the plugin exposes (name → function declarations). */
  tools?: Record<string, PluginToolDeclaration>;
  /** Hooks the plugin listens to. */
  hooks?: {
    onSessionStart?: boolean;
    onSessionEnd?: boolean;
    onToolCall?: boolean;
    onTranscript?: boolean;
  };
  /** Config schema (simple JSON schema). */
  config?: Record<string, PluginConfigField>;
}

export interface PluginConfigField {
  type: "string" | "boolean" | "number" | "select";
  label: string;
  default?: any;
  options?: { label: string; value: any }[];
  description?: string;
}

export interface PluginToolDeclaration {
  description: string;
  parameters: Record<string, any>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  loaded: boolean;
  config: Record<string, any>;
  error?: string;
}

// ── Hook context ──────────────────────────────────────────────────────

export interface PluginHooks {
  onToolCall?: (toolName: string, args: any) => Promise<any>;
  onTranscript?: (role: "user" | "companion", text: string) => Promise<void>;
  onSessionStart?: () => Promise<void>;
  onSessionEnd?: () => Promise<void>;
}

// ── Plugin Manager ────────────────────────────────────────────────────

const STORAGE_KEY = "aura-plugins";

function loadPlugins(): PluginInstance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function savePlugins(plugins: PluginInstance[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
  } catch { /* ignore */ }
}

/** Check if a plugin should be auto-built during install. */
function detectBuiltinPlugins(): PluginInstance[] {
  const DEFAULT_PLUGINS: PluginManifest[] = [
    {
      id: "calculator",
      name: "Calculator",
      version: "1.0.0",
      description: "Perform calculations, unit conversions, and math operations",
      author: "YIELD",
      config: {
        precision: {
          type: "number",
          label: "Decimal Precision",
          description: "Number of decimal places for results",
          default: 4,
        },
      },
    },
    {
      id: "translate",
      name: "Quick Translate",
      version: "1.0.0",
      description: "Translate text between languages using AI",
      author: "YIELD",
      config: {
        defaultTargetLang: {
          type: "select",
          label: "Default target language",
          options: [
            { label: "Arabic", value: "ar" },
            { label: "Chinese", value: "zh" },
            { label: "French", value: "fr" },
            { label: "German", value: "de" },
            { label: "Japanese", value: "ja" },
            { label: "Spanish", value: "es" },
          ],
          default: "ar",
        },
      },
    },
    {
      id: "timer",
      name: "Timer & Alarms",
      version: "1.0.0",
      description: "Set timers, countdowns, and alarms via voice",
      author: "YIELD",
    },
  ];

  const existing = loadPlugins();
  const existingIds = new Set(existing.map((p) => p.manifest.id));

  for (const builtin of DEFAULT_PLUGINS) {
    if (!existingIds.has(builtin.id)) {
      existing.push({
        manifest: builtin,
        enabled: true,
        loaded: true,
        config: {},
      });
    }
  }

  // Merge config defaults for existing plugins that might be missing config keys
  for (const p of existing) {
    const builtin = DEFAULT_PLUGINS.find((b) => b.id === p.manifest.id);
    if (builtin?.config) {
      for (const [key, field] of Object.entries(builtin.config)) {
        if (p.config[key] === undefined && field.default !== undefined) {
          p.config[key] = field.default;
        }
      }
    }
  }

  savePlugins(existing);
  return existing;
}

// ── React Component ───────────────────────────────────────────────────

interface PluginSystemProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Plugin System panel — manage, install, and configure plugins.
 */
export function PluginSystem({ isOpen, onClose }: PluginSystemProps) {
  const [plugins, setPlugins] = useState<PluginInstance[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

  useEffect(() => {
    setPlugins(detectBuiltinPlugins());
  }, [isOpen]);

  const refreshPlugins = useCallback(() => {
    setPlugins(detectBuiltinPlugins());
  }, []);

  const togglePlugin = useCallback((id: string) => {
    setPlugins((prev) => {
      const next = prev.map((p) =>
        p.manifest.id === id ? { ...p, enabled: !p.enabled } : p
      );
      savePlugins(next);
      return next;
    });
  }, []);

  const removePlugin = useCallback((id: string) => {
    setPlugins((prev) => {
      const next = prev.filter((p) => p.manifest.id !== id);
      savePlugins(next);
      return next;
    });
    if (selectedPlugin === id) setSelectedPlugin(null);
  }, [selectedPlugin]);

  const updateConfig = useCallback((pluginId: string, key: string, value: any) => {
    setPlugins((prev) => {
      const next = prev.map((p) => {
        if (p.manifest.id !== pluginId) return p;
        return { ...p, config: { ...p.config, [key]: value } };
      });
      savePlugins(next);
      return next;
    });
  }, []);

  const currentPlugin = plugins.find((p) => p.manifest.id === selectedPlugin);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 260, damping: 25 }}
          className="fixed bottom-20 right-4 z-30 w-[300px]"
        >
          <div className="relative overflow-hidden rounded-2xl bg-[#0A0A12]/95 border border-[#7C5CFF]/15 shadow-2xl backdrop-blur-2xl">
            {/* Gradient accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7C5CFF] via-[#6EE7FF] to-[#7C5CFF]" />

            <div className="p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#7C5CFF]/10 border border-[#7C5CFF]/20">
                    <Puzzle className="w-3.5 h-3.5 text-[#A288FF]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A288FF]">
                    Plugins
                  </span>
                  <span className="text-[8px] font-mono text-gray-500">
                    {plugins.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={refreshPlugins}
                    className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                    title="Refresh"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Plugin list */}
              <div className="space-y-1 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.04) transparent" }}>
                {plugins.length === 0 ? (
                  <div className="py-6 flex flex-col items-center gap-2">
                    <Puzzle className="w-8 h-8 text-gray-600" />
                    <p className="text-[10px] font-mono text-gray-500">No plugins installed</p>
                    <p className="text-[8px] font-mono text-gray-600 text-center px-4">
                      Built-in plugins will appear here automatically
                    </p>
                  </div>
                ) : (
                  plugins.map((plugin) => {
                    const isSelected = selectedPlugin === plugin.manifest.id;
                    return (
                      <div
                        key={plugin.manifest.id}
                        onClick={() => setSelectedPlugin(isSelected ? null : plugin.manifest.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? "bg-[#7C5CFF]/8 border border-[#7C5CFF]/20"
                            : "hover:bg-white/[0.04] border border-transparent"
                        }`}
                      >
                        {/* Status dot */}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          plugin.enabled && plugin.loaded
                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                            : "bg-gray-600"
                        }`} />

                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-mono text-white/80 block truncate">
                            {plugin.manifest.name}
                          </span>
                          <span className="text-[7px] font-mono text-white/30 block">
                            v{plugin.manifest.version}
                            {plugin.manifest.author ? ` · ${plugin.manifest.author}` : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); togglePlugin(plugin.manifest.id); }}
                            className={`p-1 rounded-lg transition-all cursor-pointer ${
                              plugin.enabled
                                ? "text-emerald-400 hover:bg-emerald-500/10"
                                : "text-gray-500 hover:text-white hover:bg-white/[0.06]"
                            }`}
                          >
                            {plugin.enabled ? (
                              <Play className="w-2.5 h-2.5" />
                            ) : (
                              <Square className="w-2.5 h-2.5" />
                            )}
                          </button>

                          {/* Remove */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removePlugin(plugin.manifest.id); }}
                            className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected plugin detail */}
              {currentPlugin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 pt-2 border-t border-white/5"
                >
                  <p className="text-[8px] font-mono text-gray-400 leading-relaxed mb-2">
                    {currentPlugin.manifest.description}
                  </p>

                  {/* Config fields */}
                  {currentPlugin.manifest.config && Object.keys(currentPlugin.manifest.config).length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[7px] uppercase tracking-wider text-gray-500 font-mono">Settings</span>
                      {Object.entries(currentPlugin.manifest.config).map(([key, field]) => {
                        const f = field as PluginConfigField;
                        return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-[8px] font-mono text-gray-400">{f.label || key}</span>
                          {f.type === "boolean" ? (
                            <button
                              onClick={() => updateConfig(currentPlugin.manifest.id, key, !currentPlugin.config[key])}
                              className={`px-2 py-0.5 rounded text-[8px] font-mono transition-all cursor-pointer ${
                                currentPlugin.config[key]
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-white/[0.04] text-gray-500 border border-white/[0.08]"
                              }`}
                            >
                              {currentPlugin.config[key] ? "ON" : "OFF"}
                            </button>
                          ) : f.type === "select" ? (
                            <select
                              value={currentPlugin.config[key] || f.default || ""}
                              onChange={(e) => updateConfig(currentPlugin.manifest.id, key, e.target.value)}
                              className="bg-white/[0.06] border border-white/[0.1] rounded text-[8px] font-mono text-white/70 px-1.5 py-0.5 outline-none cursor-pointer"
                            >
                              {f.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              value={currentPlugin.config[key] ?? f.default ?? ""}
                              onChange={(e) => updateConfig(currentPlugin.manifest.id, key, parseFloat(e.target.value) || 0)}
                              className="w-12 bg-[#0A0A12] border border-white/[0.1] rounded text-[8px] font-mono text-white/70 px-1 py-0.5 outline-none text-right"
                            />
                          )}
                        </div>
                      );
                    })
                  }
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}