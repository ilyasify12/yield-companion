/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Minus, Square, X } from "lucide-react";

/**
 * Custom title bar for the frameless Electron window.
 *
 * Provides:
 *   - A draggable region (`-webkit-app-region: drag`) so the user can move
 *     the window by dragging this bar.
 *   - Minimize / Maximize / Close buttons that talk to the main process via
 *     the preload bridge (`window.electronAPI`).
 *
 * The bar is only rendered when running inside Electron (window.electronAPI
 * is present).
 */
export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.onMaximizedChange) return;
    const unsub = window.electronAPI.onMaximizedChange((maximized: boolean) => {
      setIsMaximized(maximized);
    });
    return typeof unsub === "function" ? unsub : undefined;
  }, []);

  // Don't render anything in the browser (non-Electron) — the native
  // title bar is already provided by Windows / macOS / Linux.
  if (!window.electronAPI?.minimize) return null;

  return (
    <div
      className="relative z-50 flex items-center justify-between h-8 bg-[#080A12]/80 backdrop-blur-xl border-b border-white/[0.04] select-none shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Spacer on the left so window controls sit on the right */}
      <div className="flex items-center gap-2 px-3">
        <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
          YIELD COMPANION v1.0
        </span>
      </div>

      {/* Window control buttons — no-drag so clicks work */}
      <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          onClick={() => window.electronAPI?.minimize?.()}
          className="flex items-center justify-center w-11 h-full text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
          aria-label="Minimize"
        >
          <Minus className="w-3 h-3" />
        </button>

        <button
          onClick={() => window.electronAPI?.maximize?.()}
          className="flex items-center justify-center w-11 h-full text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          <Square className={`w-2.5 h-2.5 ${isMaximized ? "opacity-60" : ""}`} />
        </button>

        <button
          onClick={() => window.electronAPI?.close?.()}
          className="flex items-center justify-center w-11 h-full text-gray-400 hover:text-white hover:bg-rose-500/80 transition-colors duration-150 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
