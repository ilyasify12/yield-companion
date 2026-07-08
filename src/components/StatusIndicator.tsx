/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Mic, Radio, Volume2, HelpCircle, Loader2, Link2, WifiOff } from "lucide-react";
import { SessionState } from "../types";

interface StatusIndicatorProps {
  state: SessionState;
  companionName: string;
  errorMessage?: string | null;
}

export function StatusIndicator({ state, companionName, errorMessage }: StatusIndicatorProps) {
  // Get state configuration
  const getStateConfig = () => {
    switch (state) {
      case "disconnected":
        return {
          label: "Assistant Dormant",
          sub: "Tap the power ring below to establish a real-time voice link",
          color: "text-gray-400 bg-gray-500/10 border-gray-500/20",
          dotColor: "bg-gray-500",
          icon: <WifiOff className="w-3.5 h-3.5" />,
          pulse: false,
        };
      case "connecting":
        return {
          label: `Connecting with ${companionName}`,
          sub: "Syncing secure real-time audio channels...",
          color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
          dotColor: "bg-cyan-400",
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          pulse: true,
        };
      case "listening":
        return {
          label: `${companionName} is Listening`,
          sub: "Speak naturally. Simply start speaking to interact.",
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          dotColor: "bg-emerald-400",
          icon: <Mic className="w-3.5 h-3.5" />,
          pulse: true,
        };
      case "thinking":
        return {
          label: `${companionName} is processing`,
          sub: "Running contextual analysis...",
          color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
          dotColor: "bg-purple-400",
          icon: <HelpCircle className="w-3.5 h-3.5 animate-pulse" />,
          pulse: true,
        };
      case "speaking":
        return {
          label: `${companionName} is Speaking`,
          sub: "Assistant is streaming audio. Speak anytime to interrupt.",
          color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
          dotColor: "bg-blue-400",
          icon: <Volume2 className="w-3.5 h-3.5" />,
          pulse: true,
        };
      case "interrupted":
        return {
          label: "Interrupted",
          sub: "Clearing stream audio buffer for instant response...",
          color: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
          dotColor: "bg-fuchsia-400",
          icon: <Radio className="w-3.5 h-3.5" />,
          pulse: true,
        };
      case "reconnecting":
        return {
          label: "Signal Lost. Reconnecting...",
          sub: "Trying to re-establish secure voice websocket...",
          color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          dotColor: "bg-amber-400",
          icon: <Link2 className="w-3.5 h-3.5 animate-bounce" />,
          pulse: true,
        };
      case "error":
        return {
          label: "Connection Interrupted",
          sub: errorMessage || "An unexpected audio or server error occurred.",
          color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
          dotColor: "bg-rose-400",
          icon: <WifiOff className="w-3.5 h-3.5" />,
          pulse: false,
        };
    }
  };

  const config = getStateConfig();

  return (
    <div id="status-indicator-container" className="w-full text-center my-4 px-4 min-h-[5.5rem] flex flex-col justify-center items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-2"
        >
          {/* Main Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium tracking-wide shadow-md ${config.color}`}
          >
            {/* Status dot with pulsing ring */}
            <div className="relative flex h-2 w-2">
              {config.pulse && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`}
                />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
            </div>
            
            <span className="flex items-center gap-1">
              {config.icon}
              {config.label}
            </span>
          </div>

          {/* Sub description text */}
          <p className="text-xs text-gray-400 max-w-sm leading-relaxed px-4 text-center mt-1">
            {config.sub}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
