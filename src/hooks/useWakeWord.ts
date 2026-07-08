/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type WakeWordState = "idle" | "listening" | "detected" | "unsupported";

export interface WakeWordHookOptions {
  /** Called when a wake word is detected. */
  onDetected: (companion: "mia" | "james") => void;
  /** Only listen when this is true (e.g. when session is disconnected). */
  enabled: boolean;
}

export interface WakeWordHookResult {
  /** Current state of the wake word engine. */
  state: WakeWordState;
  /** Name of the last detected companion. */
  lastDetected: "mia" | "james" | null;
  /** Manually restart listening (e.g. after a false trigger). */
  restart: () => void;
}

/**
 * useWakeWord — continuously listens for "Mia" or "James" via the Web Speech
 * API and triggers the companion session without a button press.
 *
 * The hook transparently handles:
 *   - Browser support detection (gracefully returns "unsupported")
 *   - Microphone permission requests
 *   - Recognition lifecycle (auto-restart on idle timeout)
 *   - Fuzzy word matching for varied pronunciations
 */
export function useWakeWord({ onDetected, enabled }: WakeWordHookOptions): WakeWordHookResult {
  const [state, setState] = useState<WakeWordState>("idle");
  const [lastDetected, setLastDetected] = useState<"mia" | "james" | null>(null);

  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const onDetectedRef = useRef(onDetected);
  const enabledRef = useRef(enabled);
  onDetectedRef.current = onDetected;
  enabledRef.current = enabled;

  // Cleanup helper — idempotent
  const stopRecognition = useCallback(() => {
    clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors if already stopped
      }
      recognitionRef.current = null;
    }
  }, []);

  // Start / restart the recognition engine
  const startRecognition = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setState("unsupported");
      return;
    }

    stopRecognition();

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    let noSpeechTimer: ReturnType<typeof setTimeout>;

    const resetNoSpeechTimer = () => {
      clearTimeout(noSpeechTimer);
      noSpeechTimer = setTimeout(() => {
        restartInstance();
      }, 20000);
    };

    /** Restart the SAME recognition instance (browsers timeout after ~30s). */
    const restartInstance = () => {
      if (recognitionRef.current !== recognition) return;
      try { recognition.abort(); } catch {}
      try { recognition.start(); } catch {}
      resetNoSpeechTimer();
    };

    recognition.onresult = (event: any) => {
      resetNoSpeechTimer();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim().toLowerCase();
        if (!transcript) continue;

        console.log(`[wakeword] heard: "${transcript}" (isFinal: ${result.isFinal})`);

        const words = transcript.split(/[\s,._\-!?]+/);
        for (const word of words) {
          const clean = word.replace(/[^a-z]/g, "");
          if (!clean) continue;

          // Detect "Mia" — fuzzy match
          if (clean === "mia" || clean === "mya" || clean === "mea" || clean === "meah" || clean === "miya" || clean === "miah") {
            console.log(`[wakeword] DETECTED "Mia" from word "${clean}"`);
            setState("detected");
            setLastDetected("mia");
            onDetectedRef.current("mia");
            return;
          }

          // Detect "James" — fuzzy match
          if (clean === "james" || clean === "jaims" || clean === "jams" || clean === "jame" || clean === "jaymes" || clean === "jaimz") {
            console.log(`[wakeword] DETECTED "James" from word "${clean}"`);
            setState("detected");
            setLastDetected("james");
            onDetectedRef.current("james");
            return;
          }
        }

        // Loose phrase-level matching (catches multi-word utterances)
        const lower = transcript.toLowerCase();
        if (/\bmia\b/.test(lower) || /\bmya\b/.test(lower) || /\bmee\s*ah\b/.test(lower) || /\bmiah\b/.test(lower)) {
          console.log(`[wakeword] DETECTED "Mia" via phrase match: "${transcript}"`);
          setState("detected");
          setLastDetected("mia");
          onDetectedRef.current("mia");
          return;
        }
        if (/\bjames\b/.test(lower) || /\bjaims\b/.test(lower) || /\bjaimz\b/.test(lower)) {
          console.log(`[wakeword] DETECTED "James" via phrase match: "${transcript}"`);
          setState("detected");
          setLastDetected("james");
          onDetectedRef.current("james");
          return;
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (recognitionRef.current !== recognition) return;
      if (event.error === "no-speech" || event.error === "aborted") {
        restartInstance();
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setState("unsupported");
        return;
      }
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(restartInstance, 2000);
    };

    recognition.onend = () => {
      clearTimeout(noSpeechTimer);
      if (recognitionRef.current === recognition) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(restartInstance, 500);
      }
    };

    try {
      recognition.start();
      setState("listening");
      recognitionRef.current = recognition;
      resetNoSpeechTimer();
    } catch {
      setTimeout(restartInstance, 500);
    }
  }, [stopRecognition]);

  // Main lifecycle: start / stop based on `enabled`
  useEffect(() => {
    if (!enabled) {
      stopRecognition();
      setState((s) => (s !== "unsupported" ? "idle" : s));
      return;
    }

    const timer = setTimeout(() => {
      startRecognition();
    }, 800);

    return () => {
      clearTimeout(timer);
      stopRecognition();
    };
  }, [enabled, startRecognition, stopRecognition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
      clearTimeout(restartTimeoutRef.current);
    };
  }, [stopRecognition]);

  const restart = useCallback(() => {
    setLastDetected(null);
    if (enabledRef.current) {
      startRecognition();
    }
  }, [startRecognition]);

  return { state, lastDetected, restart };
}
