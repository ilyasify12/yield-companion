/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { base64ToBuffer, int16ToFloat32 } from "../utils/audio";

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const nextStartTime = useRef<number>(0);
  const activeSources = useRef<AudioBufferSourceNode[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize output audio context
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      // 24 kHz is the sample rate of Gemini Live audio output
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
    }
    
    // Resume context if suspended (browser security policy)
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    
    return {
      ctx: audioContextRef.current,
      analyser: analyserRef.current!,
    };
  };

  const playChunk = (base64Data: string) => {
    try {
      const { ctx, analyser } = getAudioContext();
      
      // Decode base64 to Float32 array
      const rawBuffer = base64ToBuffer(base64Data);
      const floatData = int16ToFloat32(rawBuffer);

      if (floatData.length === 0) return;

      // Create AudioBuffer
      const audioBuffer = ctx.createBuffer(1, floatData.length, 24000);
      audioBuffer.getChannelData(0).set(floatData);

      // Create AudioBufferSourceNode
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);

      const currentTime = ctx.currentTime;
      let playTime = nextStartTime.current;

      // If we fell behind or this is the first chunk, schedule it slightly in the future (50ms) to buffer
      if (playTime < currentTime) {
        playTime = currentTime + 0.05;
      }

      source.start(playTime);
      nextStartTime.current = playTime + audioBuffer.duration;

      // Track active source for potential interruption
      activeSources.current.push(source);
      setIsPlaying(true);

      source.onended = () => {
        activeSources.current = activeSources.current.filter((s) => s !== source);
        if (activeSources.current.length === 0) {
          setIsPlaying(false);
        }
      };
    } catch (err) {
      console.error("Error playing audio chunk:", err);
    }
  };

  const interrupt = () => {
    console.log("Interrupting audio playback and clearing queue");
    activeSources.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    activeSources.current = [];
    nextStartTime.current = 0;
    setIsPlaying(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeSources.current.forEach((source) => {
        try {
          source.stop();
        } catch (e) {}
      });
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((e) => console.error("Error closing player context:", e));
      }
    };
  }, []);

  return {
    playChunk,
    interrupt,
    isPlaying,
    getAnalyser: () => analyserRef.current,
    getAudioContext,
  };
}
