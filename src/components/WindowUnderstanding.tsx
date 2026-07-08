/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Monitor, Clipboard, MousePointer2, LayoutPanelTop, X,
} from "lucide-react";

interface WindowInfo {
  /** Title of the active window. */
  title: string;
  /** Process name (e.g. "chrome.exe", "Code.exe"). */
  process: string;
  /** Application name (friendly). */
  appName: string;
}

interface WindowUnderstandingProps {
  /** Current window info from the desktop service (or simulated). */
  windowInfo?: WindowInfo | null;
  /** Current clipboard content. */
  clipboard?: string | null;
  /** Cursor position. */
  cursorPos?: { x: number; y: number } | null;
  /** Whether to auto-dismiss after showing. */
  autoDismiss?: boolean;
  /** Called to dismiss. */
  onDismiss?: () => void;
}

/**
 * WindowUnderstanding — displays active window, clipboard, and cursor info.
 * Shows as a small floating panel when the AI examines the user's active context.
 */
export function WindowUnderstanding({
  windowInfo,
  clipboard,
  cursorPos,
  autoDismiss = true,
  onDismiss,
}: WindowUnderstandingProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Show when new data arrives
  useEffect(() => {
    if (windowInfo || clipboard || cursorPos) {
      setVisible(true);
      setDismissed(false);

      if (autoDismiss) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setDismissed(true);
          setTimeout(() => setVisible(false), 300);
          onDismiss?.();
        }, 4000);
      }
    }
    return () => clearTimeout(timerRef.current);
  }, [windowInfo, clipboard, cursorPos, autoDismiss, onDismiss]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-72 left-1/2 -translate-x-1/2 z-40 w-full max-w-xs pointer-events-auto"
        >
          <div className="rounded-xl bg-[#080A15]/90 border border-cyan-500/15 backdrop-blur-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <LayoutPanelTop className="w-3 h-3 text-cyan-400" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-300">
                  Context
                </span>
              </div>
              <button
                onClick={() => { setDismissed(true); onDismiss?.(); }}
                className="text-gray-500 hover:text-white/80 transition-colors p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Content */}
            <div className="px-3 py-2 space-y-2">
              {/* Active window */}
              {windowInfo && (
                <div className="flex items-start gap-2">
                  <Monitor className="w-3 h-3 text-cyan-400/70 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">
                      Active Window
                    </span>
                    <p className="text-[10px] font-mono text-white/80 truncate mt-0.5">
                      {windowInfo.title || "Unknown"}
                    </p>
                    <span className="text-[7px] font-mono text-white/30">
                      {windowInfo.process || windowInfo.appName || ""}
                    </span>
                  </div>
                </div>
              )}

              {/* Clipboard */}
              {clipboard && (
                <div className="flex items-start gap-2">
                  <Clipboard className="w-3 h-3 text-emerald-400/70 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">
                      Clipboard
                    </span>
                    <p className="text-[9px] font-mono text-white/60 truncate mt-0.5">
                      {clipboard.length > 80
                        ? clipboard.substring(0, 80) + "…"
                        : clipboard}
                    </p>
                  </div>
                </div>
              )}

              {/* Cursor position */}
              {cursorPos && (
                <div className="flex items-start gap-2">
                  <MousePointer2 className="w-3 h-3 text-amber-400/70 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">
                      Cursor
                    </span>
                    <p className="text-[9px] font-mono text-white/60 mt-0.5 tabular-nums">
                      ({cursorPos.x}, {cursorPos.y})
                    </p>
                  </div>
                </div>
              )}

              {!windowInfo && !clipboard && !cursorPos && (
                <p className="text-[9px] font-mono text-gray-500 text-center py-1">
                  No context data available
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
