/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, Eye, X, Image } from "lucide-react";

export interface ScreenCapture {
  id: string;
  /** Base64 image data (JPEG/PNG). */
  data: string;
  /** MIME type (e.g. "image/jpeg"). */
  mimeType: string;
  /** Description from the AI about what it sees. */
  description?: string;
  /** Timestamp of capture. */
  timestamp: Date;
}

interface ScreenCaptureDisplayProps {
  captures: ScreenCapture[];
  onRemove: (id: string) => void;
}

export function ScreenCaptureDisplay({ captures, onRemove }: ScreenCaptureDisplayProps) {
  // Auto-dismiss after 4 seconds
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    for (const cap of captures) {
      if (!timers.has(cap.id)) {
        const timer = setTimeout(() => {
          onRemove(cap.id);
          timers.delete(cap.id);
        }, 4000);
        timers.set(cap.id, timer);
      }
    }
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, [captures, onRemove]);

  // Show max 1 recent capture
  const latest = captures[0];

  return (
    <div id="screen-capture-dock" className="fixed bottom-48 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 flex flex-col gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {latest && (
          <motion.div
            key={latest.id}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="rounded-xl overflow-hidden bg-[#080A15]/90 border border-violet-500/20 backdrop-blur-lg shadow-2xl pointer-events-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Camera className="w-3 h-3 text-violet-400" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-violet-300">
                  Screen Captured
                </span>
              </div>
              <button
                onClick={() => onRemove(latest.id)}
                className="text-gray-500 hover:text-white/80 transition-colors p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Image preview */}
            <div className="relative aspect-video bg-black/40 overflow-hidden">
              <img
                src={`data:${latest.mimeType};base64,${latest.data}`}
                alt="Screen capture"
                className="w-full h-full object-contain"
              />
              {/* Overlay gradient */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

              {/* AI description */}
              {latest.description && (
                <div className="absolute bottom-0 inset-x-0 px-3 py-2">
                  <p className="text-[9px] font-mono text-white/70 truncate leading-relaxed flex items-center gap-1">
                    <Eye className="w-2.5 h-2.5 shrink-0 text-violet-300" />
                    {latest.description}
                  </p>
                </div>
              )}
            </div>

            {/* Timestamp */}
            <div className="px-3 py-1.5 flex items-center justify-between border-t border-white/5">
              <span className="text-[7px] font-mono text-gray-600">
                {latest.timestamp.toLocaleTimeString()}
              </span>
              <Image className="w-2.5 h-2.5 text-gray-600" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
