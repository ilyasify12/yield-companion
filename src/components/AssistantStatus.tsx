import { motion, AnimatePresence } from "motion/react";
import { SessionState } from "../types";

interface AssistantStatusProps {
  state: SessionState;
  companionName: string;
}

export function AssistantStatus({ state, companionName }: AssistantStatusProps) {
  const getStatusText = () => {
    switch (state) {
      case "disconnected":
        return "Disconnected";
      case "connecting":
        return "Connecting...";
      case "listening":
        return "Listening...";
      case "thinking":
        return "Thinking...";
      case "speaking":
        return "Speaking...";
      case "interrupted":
        return "Interrupted";
      case "reconnecting":
        return "Reconnecting...";
      case "error":
        return "Error Occurred";
      default:
        return "Idle";
    }
  };

  const getStatusDetails = () => {
    switch (state) {
      case "disconnected":
        return "Ready to establish voice connection";
      case "connecting":
        return "Syncing high-frequency live audio stream";
      case "listening":
        return "I am listening. Go ahead and speak!";
      case "thinking":
        return "Processing contextual response";
      case "speaking":
        return "Streaming voice response. Speak anytime to interrupt";
      case "interrupted":
        return "Preparing buffer for immediate reply";
      case "reconnecting":
        return "Re-establishing connection link";
      case "error":
        return "Network anomaly detected. Please restart";
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (state) {
      case "listening":
        return "text-[#6EE7FF]";
      case "thinking":
        return "text-purple-300";
      case "speaking":
        return "text-[#7C5CFF]";
      case "error":
        return "text-rose-500";
      case "connecting":
      case "reconnecting":
        return "text-cyan-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusColorHex = () => {
    switch (state) {
      case "listening": return "#6EE7FF";
      case "thinking": return "rgb(216, 180, 254)";
      case "speaking": return "#7C5CFF";
      case "error": return "#f43f5e";
      case "connecting": case "reconnecting": return "#22d3ee";
      default: return "#9ca3af";
    }
  };

  const isConnected = state !== "disconnected" && state !== "error";

  return (
    <div className="w-full text-center py-4 flex flex-col justify-center items-center select-none z-10">
      <AnimatePresence mode="wait">
        <motion.div
          key={state + companionName}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex flex-col items-center gap-1"
        >
          {/* Companion Name */}
          <h2 className="font-display text-2xl font-bold tracking-tight text-white/95">
            {companionName}
          </h2>

          {/* Current State Indicator */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <motion.span
                  className="absolute inline-flex h-full w-full rounded-full"
                  style={{ backgroundColor: getStatusColorHex() }}
                  animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  state === "listening" ? "bg-[#6EE7FF]" : state === "error" ? "bg-rose-500" : isConnected ? "bg-[#7C5CFF]" : "bg-gray-500"
                }`}
                style={state === "thinking" || state === "speaking" ? { backgroundColor: getStatusColorHex() } : {}}
              />
            </span>
            <span className={`text-xs font-mono font-semibold tracking-widest uppercase ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>

          {/* Subtext Detail */}
          <motion.p
            key={`detail-${state}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="text-[9px] font-mono text-gray-500 max-w-xs uppercase tracking-[0.15em] mt-1.5 leading-relaxed"
          >
            {getStatusDetails()}
          </motion.p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
