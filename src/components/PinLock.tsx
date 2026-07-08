/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Lock, Unlock, AlertCircle, Sparkles } from "lucide-react";

interface PinLockProps {
  /** Whether the lock screen is visible. */
  locked: boolean;
  /** The SHA256 hash of the correct PIN. */
  pinHash: string;
  /** Called when the correct PIN is entered. */
  onUnlock: () => void;
  /** Called to set a new PIN (null if not in setup mode). */
  onSetPin?: (hash: string) => void;
  /** Whether to show setup flow instead of unlock. */
  setupMode?: boolean;
  /** Called to cancel setup. */
  onCancelSetup?: () => void;
}

/** Simple SHA256 hash function using the Web Crypto API. */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function PinLock({
  locked,
  pinHash,
  onUnlock,
  onSetPin,
  setupMode,
  onCancelSetup,
}: PinLockProps) {
  const [pin, setPin] = useState<string[]>(Array(6).fill(""));
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmPin, setConfirmPin] = useState<string[] | null>(null);
  const [shaking, setShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const reset = useCallback(() => {
    setPin(Array(6).fill(""));
    setActiveIndex(0);
    setError(null);
    setConfirmPin(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === "Backspace") {
        if (pin[index] !== "") {
          const newPin = [...pin];
          newPin[index] = "";
          setPin(newPin);
        } else if (index > 0) {
          setActiveIndex(index - 1);
          inputRefs.current[index - 1]?.focus();
        }
        return;
      }

      const digit = e.key;
      if (!/^[0-9]$/.test(digit)) return;

      const newPin = [...pin];
      newPin[index] = digit;
      setPin(newPin);

      if (index < 5) {
        setActiveIndex(index + 1);
        inputRefs.current[index + 1]?.focus();
      }
    },
    [pin]
  );

  // When all 6 digits are entered, validate
  useEffect(() => {
    const pinStr = pin.join("");
    if (pinStr.length !== 6) return;
    if (pinStr.includes("")) return;
    if (pin.indexOf("") !== -1) return;

    const allFilled = pin.every((d) => d !== "");
    if (!allFilled) return;

    const doValidate = async () => {
      if (setupMode) {
        // Setup flow: first entry, ask for confirmation
        if (!confirmPin) {
          setConfirmPin(pin);
          setPin(Array(6).fill(""));
          setActiveIndex(0);
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
          return;
        }
        // Confirmation: compare
        const first = confirmPin.join("");
        const second = pin.join("");
        if (first !== second) {
          setShaking(true);
          setError("PINs don't match. Try again.");
          setTimeout(() => {
            setShaking(false);
            reset();
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
          }, 600);
          return;
        }
        const h = await hashPin(first);
        onSetPin?.(h);
        reset();
        return;
      }

      // Unlock flow
      const h = await hashPin(pinStr);
      if (h === pinHash) {
        onUnlock();
        reset();
      } else {
        setShaking(true);
        setError("Incorrect PIN");
        setTimeout(() => {
          setShaking(false);
          reset();
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }, 600);
      }
    };

    doValidate();
  }, [pin, pinHash, onUnlock, onSetPin, setupMode, confirmPin, reset]);

  const title = setupMode
    ? confirmPin
      ? "Confirm your PIN"
      : "Set a 6-digit PIN"
    : "Enter PIN";

  const subtitle = setupMode
    ? confirmPin
      ? "Enter the same PIN again to confirm"
      : "This will be required to unlock the app"
    : "App is locked";

  return (
    <AnimatePresence>
      {locked || setupMode ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050508]/95 backdrop-blur-2xl"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="flex flex-col items-center gap-8 px-8 py-10 rounded-3xl bg-[#0A0A12]/90 border border-white/[0.06] shadow-2xl max-w-sm w-full mx-4"
          >
            {/* Lock icon */}
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-[#7C5CFF]/30 via-[#6EE7FF]/10 to-[#ec4899]/20 blur-lg"
              />
              <div className="relative p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                {setupMode ? (
                  <Sparkles className="w-8 h-8 text-[#A288FF]" />
                ) : (
                  <Lock className="w-8 h-8 text-[#A288FF]" />
                )}
              </div>
            </div>

            {/* Title */}
            <div className="text-center">
              <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
              <p className="text-xs text-gray-500 mt-1 font-mono">{subtitle}</p>
            </div>

            {/* PIN dots */}
            <motion.div
              animate={shaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="flex gap-3"
            >
              {pin.map((digit, i) => (
                <div
                  key={i}
                  className={`w-12 h-14 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${
                    i === activeIndex
                      ? "border-[#7C5CFF]/60 bg-[#7C5CFF]/5 shadow-[0_0_12px_rgba(124,92,255,0.15)]"
                      : digit
                      ? "border-white/[0.15] bg-white/[0.04]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  {digit ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-3 h-3 rounded-full bg-[#A288FF] shadow-[0_0_8px_rgba(162,136,255,0.5)]"
                    />
                  ) : null}
                </div>
              ))}
            </motion.div>

            {/* Hidden input for keyboard capture */}
            <input
              ref={(el) => (inputRefs.current[0] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              onKeyDown={(e) => handleKeyDown(e, activeIndex)}
              value=""
              readOnly
            />

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-mono"
              >
                <AlertCircle className="w-3 h-3 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Cancel setup */}
            {setupMode && onCancelSetup && (
              <button
                onClick={() => {
                  reset();
                  onCancelSetup();
                }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono cursor-pointer"
              >
                Cancel
              </button>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
