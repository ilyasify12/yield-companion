import { motion } from "motion/react";
import { Mic, PhoneOff } from "lucide-react";

interface MicButtonProps {
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}

export function MicButton({ isActive, onClick, disabled = false, color = "#7C5CFF" }: MicButtonProps) {
  return (
    <div className="relative flex items-center justify-center z-10 select-none">
      {/* Background Pulsing Outer Rings — organic, multi-layered */}
      {isActive && (
        <>
          <motion.span
            className="absolute w-24 h-24 rounded-full border pointer-events-none"
            style={{ borderColor: `${color}40` }}
            animate={{
              scale: [1, 2.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <motion.span
            className="absolute w-24 h-24 rounded-full border pointer-events-none"
            style={{ borderColor: `${color}25` }}
            animate={{
              scale: [1, 2.8, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.6,
            }}
          />
          <motion.span
            className="absolute w-24 h-24 rounded-full border pointer-events-none"
            style={{ borderColor: `${color}15` }}
            animate={{
              scale: [1, 3.4, 1],
              opacity: [0.2, 0, 0.2],
            }}
            transition={{
              duration: 4.4,
              repeat: Infinity,
              ease: "easeOut",
              delay: 1.2,
            }}
          />
        </>
      )}

      {/* Main Interactive Button */}
      <motion.button
        id="reusable-mic-button"
        onClick={onClick}
        disabled={disabled}
        whileHover={disabled ? {} : { scale: 1.06 }}
        whileTap={disabled ? {} : { scale: 0.92 }}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 outline-none shadow-[0_0_40px_rgba(0,0,0,0.6)] ${
          disabled
            ? "bg-gray-800 text-gray-500 cursor-not-allowed shadow-none border border-white/5"
            : isActive
            ? "text-white"
            : "bg-white text-slate-950 hover:bg-gray-100 shadow-white/15 border border-white/10"
        }`}
        style={{
          background: disabled
            ? undefined
            : isActive
            ? `linear-gradient(135deg, ${color}cc, ${color}88)`
            : undefined,
          boxShadow: disabled
            ? "none"
            : isActive
            ? `0 0 25px ${color}55, 0 0 50px ${color}30, inset 0 0 15px rgba(255,255,255,0.2)`
            : `0 0 30px ${color}30`,
        }}
      >
        {isActive ? (
          <PhoneOff className="w-7 h-7 stroke-[2]" />
        ) : (
          <Mic className="w-7 h-7 stroke-[2]" />
        )}

        {/* Dynamic Glow Ring */}
        {!disabled && (
          <motion.span
            className="absolute -inset-1.5 rounded-full border pointer-events-none"
            style={{ borderColor: `${color}30` }}
            animate={{
              borderColor: isActive
                ? [
                    `${color}15`,
                    `${color}50`,
                    `${color}15`,
                  ]
                : [
                    `${color}10`,
                    `${color}35`,
                    `${color}10`,
                  ],
              boxShadow: isActive
                ? [
                    `0 0 8px ${color}10`,
                    `0 0 18px ${color}30`,
                    `0 0 8px ${color}10`,
                  ]
                : [
                    `0 0 4px ${color}08`,
                    `0 0 10px ${color}20`,
                    `0 0 4px ${color}08`,
                  ],
            }}
            transition={{
              duration: 2.0,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </motion.button>
    </div>
  );
}
