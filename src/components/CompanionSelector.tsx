/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { User, Volume2, Sparkles, BrainCircuit } from "lucide-react";
import { CompanionConfig, CompanionId } from "../types";

interface CompanionSelectorProps {
  companions: CompanionConfig[];
  selectedId: CompanionId;
  onSelect: (id: CompanionId) => void;
  disabled: boolean;
}

export function CompanionSelector({
  companions,
  selectedId,
  onSelect,
  disabled,
}: CompanionSelectorProps) {
  return (
    <div id="companion-selector" className="w-full max-w-md mx-auto my-4 px-2">
      <div className="text-center mb-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-mono">
          Select AI Companion
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-1.5 bg-white/5 border border-white/5 backdrop-blur-md rounded-2xl">
        {companions.map((companion) => {
          const isSelected = companion.id === selectedId;
          const activeColor = companion.avatarColor;

          return (
            <button
              key={companion.id}
              disabled={disabled}
              onClick={() => onSelect(companion.id)}
              className={`relative flex flex-col items-start p-4 rounded-xl text-left transition-all duration-300 select-none group outline-none focus:ring-1 focus:ring-white/20 ${
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${
                isSelected
                  ? "bg-white/10 shadow-lg border border-white/10"
                  : "bg-transparent border border-transparent hover:bg-white/5"
              }`}
            >
              {/* Active Slide highlight */}
              {isSelected && (
                <motion.div
                  layoutId="active-companion-bg"
                  className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/[0.03] to-white/[0.08] pointer-events-none"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              {/* Status Dot */}
              <div className="flex items-center justify-between w-full mb-2">
                <span
                  className="p-1.5 rounded-lg flex items-center justify-center bg-black/30"
                  style={{ color: isSelected ? activeColor : "#9ca3af" }}
                >
                  <User className="w-4 h-4" />
                </span>

                {isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: activeColor,
                      boxShadow: `0 0 8px ${activeColor}`,
                    }}
                  />
                )}
              </div>

              {/* Companion Info */}
              <h3
                className={`font-display font-semibold tracking-tight text-lg transition-colors duration-200 ${
                  isSelected ? "text-white" : "text-gray-400 group-hover:text-gray-200"
                }`}
              >
                {companion.name}
              </h3>

              <span className="text-[10px] font-mono text-gray-500 uppercase mt-0.5">
                {companion.tagline}
              </span>

              <p className="text-[11px] text-gray-400 leading-relaxed mt-2 line-clamp-2">
                {companion.description}
              </p>

              {/* Specific Traits Indicators */}
              <div className="flex items-center gap-2 mt-3 text-[9px] text-gray-500 font-mono">
                <span className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                  <Volume2 className="w-2.5 h-2.5" />
                  Voice
                </span>
                <span className="flex items-center gap-1 bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                  {companion.id === "mia" ? (
                    <Sparkles className="w-2.5 h-2.5" />
                  ) : (
                    <BrainCircuit className="w-2.5 h-2.5" />
                  )}
                  {companion.id === "mia" ? "Playful" : "Calm"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
