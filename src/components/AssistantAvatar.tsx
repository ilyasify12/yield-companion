import { motion } from "motion/react";
import { SessionState } from "../types";
import { AssistantVideoPlayer } from "./AssistantVideoPlayer";

interface AssistantAvatarProps {
  state: SessionState;
  companionColor?: string;
}

export function AssistantAvatar({ state, companionColor = "#7C5CFF" }: AssistantAvatarProps) {
  // Determine state-specific glow parameters based on companion color
  const getGlowStyles = () => {
    switch (state) {
      case "speaking":
        return {
          shadow: `0 0 50px ${companionColor}75`,
          borderColor: "transparent",
          glowColor: companionColor.replace(")", ", 0.25)").replace("rgb", "rgba"),
          scale: 1.01,
          brightness: "brightness(1.05) contrast(1.02)",
        };
      case "thinking":
        return {
          shadow: `0 0 45px rgba(110, 231, 255, 0.35)`,
          borderColor: "transparent",
          glowColor: "rgba(110, 231, 255, 0.15)",
          scale: 1.0,
          brightness: "brightness(0.98) contrast(1.0)",
        };
      default:
        return {
          shadow: `0 0 35px ${companionColor}35`,
          borderColor: "transparent",
          glowColor: `${companionColor}15`,
          scale: 1.0,
          brightness: "brightness(1.0) contrast(1.0)",
        };
    }
  };

  const glowStyles = getGlowStyles();
  const isConnected = state !== "disconnected" && state !== "error";

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none z-10">

      {/* Background Radial Ambient Glow */}
      <motion.div
        className="absolute -inset-10 blur-3xl pointer-events-none z-0"
        animate={{
          backgroundColor: [glowStyles.glowColor, "rgba(0,0,0,0)", glowStyles.glowColor],
          scale: state === "speaking" ? [1.0, 1.12, 1.0] : state === "thinking" ? [1.0, 1.05, 1.0] : [0.95, 1.0, 0.95],
        }}
        transition={{
          repeat: Infinity,
          duration: state === "speaking" ? 1.5 : state === "thinking" ? 3.0 : 5.0,
          ease: "easeInOut",
        }}
      />

      {/* Floating particles — different patterns per state */}
      {state === "speaking" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`speak-particle-${i}`}
              className="absolute w-1.5 h-1.5 rounded-full blur-[0.5px]"
              style={{ backgroundColor: companionColor }}
              initial={{
                x: Math.random() * 300 + 50,
                y: Math.random() * 200 + 150,
                opacity: 0,
                scale: 0.3,
              }}
              animate={{
                y: [200, 20],
                x: (Math.random() - 0.5) * 80 + 200,
                opacity: [0, 0.9, 0.7, 0],
                scale: [0.3, 1.5, 1, 0.3],
              }}
              transition={{
                duration: Math.random() * 1.5 + 1.2,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {state === "thinking" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`think-particle-${i}`}
              className="absolute w-1.5 h-1.5 rounded-full bg-[#6EE7FF]/70 blur-[0.5px]"
              initial={{
                x: Math.random() * 240 + 80,
                y: Math.random() * 200 + 100,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{
                y: [250, 30],
                opacity: [0, 0.8, 0.8, 0],
                scale: [0.5, 1.3, 0.8],
              }}
              transition={{
                duration: Math.random() * 2 + 2,
                repeat: Infinity,
                delay: i * 0.35,
                ease: "linear",
              }}
            />
          ))}
          {/* Orbiting glow dots */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={`orbit-${i}`}
              className="absolute w-2 h-2 rounded-full bg-cyan-400/40 blur-[1px]"
              animate={{
                x: [200 + Math.cos((i * Math.PI * 2) / 3) * 60, 200 + Math.cos((i * Math.PI * 2) / 3 + Math.PI * 2) * 60],
                y: [150 + Math.sin((i * Math.PI * 2) / 3) * 60, 150 + Math.sin((i * Math.PI * 2) / 3 + Math.PI * 2) * 60],
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </div>
      )}

      {!isConnected && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={`idle-particle-${i}`}
              className="absolute w-1 h-1 rounded-full blur-[0.5px]"
              style={{ backgroundColor: companionColor, opacity: 0.4 }}
              initial={{
                x: Math.random() * 220 + 90,
                y: Math.random() * 150 + 150,
                opacity: 0,
                scale: 0.5,
              }}
              animate={{
                y: [180, 90],
                opacity: [0, 0.5, 0],
              }}
              transition={{
                duration: Math.random() * 3 + 3,
                repeat: Infinity,
                delay: i * 0.7,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Main Container Panel with floating/breathing physics */}
      <motion.div
        className="relative w-full h-full flex items-center justify-center overflow-hidden z-10"
        animate={{
          y: state === "speaking" ? [0, -4, 0] : state === "thinking" ? [0, -3, 0] : [0, -6, 0],
          boxShadow: glowStyles.shadow,
          scale: glowStyles.scale,
        }}
        style={{
          filter: glowStyles.brightness,
        }}
        transition={{
          y: {
            repeat: Infinity,
            duration: state === "speaking" ? 2.5 : state === "thinking" ? 4.5 : 6.0,
            ease: "easeInOut",
          },
          boxShadow: { duration: 0.3 },
          scale: { duration: 0.3 },
        }}
      >
        <AssistantVideoPlayer state={state} />
      </motion.div>
    </div>
  );
}
