/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Activity, ShieldAlert, Cpu } from "lucide-react";
import { SessionState } from "../types";

interface AvatarGlowProps {
  state: SessionState;
  companionName: string;
  avatarColor: string;
  glowGradients: string[];
}

export function AvatarGlow({ state, companionName, avatarColor, glowGradients }: AvatarGlowProps) {
  // Determine state-specific animation configs
  const getGlowIntensity = () => {
    switch (state) {
      case "speaking":
        return { scale: [1, 1.25, 1], opacity: [0.6, 0.95, 0.6], duration: 1.2 };
      case "listening":
        return { scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4], duration: 2.5 };
      case "thinking":
        return { scale: [1.05, 1.1, 1.05], opacity: [0.7, 0.9, 0.7], duration: 0.8 };
      case "connecting":
      case "reconnecting":
        return { scale: [0.95, 1.05, 0.95], opacity: [0.3, 0.6, 0.3], duration: 1.5 };
      case "error":
        return { scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5], duration: 1.0 };
      default:
        return { scale: [1, 1.03, 1], opacity: [0.2, 0.35, 0.2], duration: 4.0 };
    }
  };

  const anim = getGlowIntensity();
  const initials = companionName.charAt(0);

  // Background gradient calculation
  const gradientStyle = {
    background: `radial-gradient(circle, ${glowGradients[0]} 0%, ${glowGradients[1]} 50%, rgba(0,0,0,0) 70%)`
  };

  return (
    <div id="avatar-glow-root" className="relative flex items-center justify-center w-64 h-64 mx-auto my-6">
      
      {/* Outer Floating Glow Fields */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`${state}-${companionName}-glow-outer`}
          className="absolute inset-0 rounded-full blur-3xl pointer-events-none"
          style={gradientStyle}
          animate={{
            scale: anim.scale,
            opacity: anim.opacity,
          }}
          transition={{
            repeat: Infinity,
            duration: anim.duration,
            ease: "easeInOut",
          }}
        />
      </AnimatePresence>

      {/* Secondary Pulse Ring */}
      <AnimatePresence mode="popLayout">
        {state !== "disconnected" && (
          <motion.div
            key={`${state}-${companionName}-pulse`}
            className="absolute inset-4 rounded-full border border-white/10 pointer-events-none"
            style={{ borderColor: `${avatarColor}40` }}
            animate={{
              scale: [1, 1.4, 1.1],
              opacity: [0.5, 0, 0.3],
            }}
            transition={{
              repeat: Infinity,
              duration: state === "speaking" ? 1.5 : 3.0,
              ease: "easeOut",
            }}
          />
        )}
      </AnimatePresence>

      {/* Main Glass Orb container */}
      <motion.div
        id="avatar-orb"
        whileHover={{ scale: 1.05, rotate: 1 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-44 h-44 rounded-full flex items-center justify-center border border-white/15 bg-black/40 backdrop-blur-md shadow-2xl overflow-hidden cursor-pointer"
        style={{
          boxShadow: `0 0 40px ${avatarColor}25, inset 0 0 25px rgba(255, 255, 255, 0.05)`,
        }}
      >
        {/* Internal revolving lighting core */}
        <motion.div
          className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${avatarColor}, transparent, ${avatarColor}aa, transparent)`,
          }}
          animate={{
            rotate: state === "thinking" ? [0, 360] : state === "speaking" ? [0, 180] : [0, 45],
          }}
          transition={{
            repeat: Infinity,
            duration: state === "thinking" ? 1.5 : state === "speaking" ? 4.0 : 12.0,
            ease: "linear",
          }}
        />

        {/* Dynamic Center Icon or Initial */}
        <div className="z-10 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {state === "thinking" ? (
              <motion.div
                key="thinking-icon"
                initial={{ opacity: 0, scale: 0.7, rotate: -45 }}
                animate={{ opacity: 1, scale: 1.0, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.7, rotate: 45 }}
                transition={{ duration: 0.2 }}
                className="text-white"
              >
                <Cpu className="w-12 h-12 stroke-[1.5] animate-pulse" style={{ color: avatarColor }} />
              </motion.div>
            ) : state === "error" ? (
              <motion.div
                key="error-icon"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1.0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className="text-rose-500"
              >
                <ShieldAlert className="w-12 h-12 stroke-[1.5]" />
              </motion.div>
            ) : state === "speaking" ? (
              <motion.div
                key="speaking-icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1.1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1"
                style={{ color: avatarColor }}
              >
                <Activity className="w-12 h-12 stroke-[1.5]" />
              </motion.div>
            ) : (
              <motion.div
                key="initial-face"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center"
              >
                <span
                  className="text-6xl font-sans font-bold tracking-tight select-none"
                  style={{
                    color: "#ffffff",
                    textShadow: `0 0 15px ${avatarColor}`,
                  }}
                >
                  {initials}
                </span>
                
                {/* Micro sparks indicator when listening */}
                {state === "listening" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="flex items-center gap-1 mt-1 text-[10px] uppercase font-mono tracking-wider opacity-60 text-emerald-400"
                  >
                    <Sparkles className="w-3 h-3" />
                    Listening
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ambient Glass Reflections */}
        <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-white/10 to-transparent rounded-t-full pointer-events-none" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[80%] h-4 bg-gradient-to-t from-white/5 to-transparent rounded-full blur-[1px] pointer-events-none" />
      </motion.div>
    </div>
  );
}
