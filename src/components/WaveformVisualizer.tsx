/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { SessionState } from "../types";

interface WaveformVisualizerProps {
  micVolume: number; // 0 to 1
  assistantAnalyser: AnalyserNode | null;
  state: SessionState;
  companionColor: string; // Hex or CSS color for neon glows
}

export function WaveformVisualizer({
  micVolume,
  assistantAnalyser,
  state,
  companionColor,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Setup analyzer buffer
    let dataArray = new Uint8Array(0);
    if (assistantAnalyser) {
      assistantAnalyser.fftSize = 128;
      const bufferLength = assistantAnalyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      phaseRef.current += 0.08;
      const phase = phaseRef.current;

      // Draw customized visuals based on state
      if (state === "speaking" && assistantAnalyser) {
        // --- SPEAKING STATE: Draw real audio spectrum from AnalyserNode ---
        assistantAnalyser.getByteFrequencyData(dataArray);
        const len = dataArray.length;

        ctx.shadowBlur = 15;
        ctx.shadowColor = companionColor;
        ctx.strokeStyle = companionColor;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        // Main waveform drawing
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const percent = dataArray[i] / 255;
          const amplitude = percent * (height * 0.4);
          
          // Generate a smooth mirror wave from center
          const x = (i / (len - 1)) * width;
          const y = centerY + Math.sin(i * 0.3 + phase) * amplitude;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw a secondary, softer offset wave for luxury depth
        ctx.shadowBlur = 5;
        ctx.strokeStyle = companionColor + "66"; // 40% opacity
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = len - 1; i >= 0; i--) {
          const percent = dataArray[i] / 255;
          const amplitude = percent * (height * 0.25);
          const x = (1 - i / (len - 1)) * width;
          const y = centerY + Math.cos(i * 0.4 - phase) * amplitude;

          if (i === len - 1) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

      } else if (state === "listening") {
        // --- LISTENING STATE: Smooth, layered sine waves scaling with Mic volume ---
        // Boost raw mic volume slightly for visual prominence
        const volumeScale = Math.min(1.0, micVolume * 6);
        const baseAmplitude = 10 + volumeScale * (height * 0.35);
        
        ctx.shadowBlur = 12;
        ctx.shadowColor = companionColor;

        // Draw 3 layers of harmonic sine waves
        const layers = [
          { amp: baseAmplitude, freq: 0.015, speed: phase, opacity: "FF", width: 3 },
          { amp: baseAmplitude * 0.6, freq: 0.03, speed: -phase * 1.2, opacity: "88", width: 1.5 },
          { amp: baseAmplitude * 0.3, freq: 0.05, speed: phase * 0.7, opacity: "44", width: 1.0 }
        ];

        layers.forEach((layer) => {
          ctx.strokeStyle = companionColor + layer.opacity;
          ctx.lineWidth = layer.width;
          ctx.beginPath();

          for (let x = 0; x < width; x++) {
            // Apply a nice envelope so the wave pinches down at both edges (elegant)
            const envelope = Math.sin((x / width) * Math.PI);
            const y = centerY + Math.sin(x * layer.freq + layer.speed) * layer.amp * envelope;

            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        });

      } else if (state === "thinking") {
        // --- THINKING STATE: Animated, spinning cognitive harmonic structures ---
        ctx.shadowBlur = 20;
        ctx.shadowColor = companionColor;
        ctx.strokeStyle = companionColor;
        ctx.lineWidth = 2.5;

        const maxRadius = Math.min(width, height) * 0.25;
        const count = 3;

        for (let r = 0; r < count; r++) {
          const p = phase * (1 - r * 0.15) * 0.5;
          const radius = maxRadius * (0.6 + r * 0.2) + Math.sin(phase * 2 + r) * 5;
          ctx.beginPath();
          ctx.strokeStyle = companionColor + (r === 0 ? "FF" : r === 1 ? "aa" : "55");
          
          for (let angle = 0; angle <= Math.PI * 2; angle += 0.05) {
            // Morph the circle slightly based on sin wave
            const morph = Math.sin(angle * 4 + phase * 3) * 6;
            const x = width / 2 + Math.cos(angle + p) * (radius + morph);
            const y = centerY + Math.sin(angle + p) * (radius + morph);

            if (angle === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.stroke();
        }

      } else if (state === "connecting" || state === "reconnecting") {
        // --- CONNECTING STATE: Pulsing circular scanning sonar waves ---
        ctx.shadowBlur = 10;
        ctx.shadowColor = companionColor;
        ctx.strokeStyle = companionColor + "44";
        ctx.lineWidth = 2;

        const pulse = (phase * 15) % (width * 0.4);
        ctx.beginPath();
        ctx.arc(width / 2, centerY, Math.max(10, pulse), 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = companionColor;
        ctx.arc(width / 2, centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = companionColor;
        ctx.fill();

      } else if (state === "error") {
        // --- ERROR STATE: Erratic jagged flatline ---
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#f43f5e"; // Rose-500
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          let y = centerY;
          // Create sharp erratic peaks in the center area
          if (x > width * 0.35 && x < width * 0.65) {
            const seed = Math.sin(x * 0.2 + phase * 10);
            if (Math.abs(seed) > 0.8) {
              y += seed * (Math.random() > 0.5 ? 20 : -20);
            }
          }
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

      } else {
        // --- DISCONNECTED: Stable flat resting line ---
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#4b5563"; // gray-600
        ctx.strokeStyle = "#4b5563";
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      }

      ctx.shadowBlur = 0; // Reset shadow
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, assistantAnalyser, micVolume, companionColor]);

  return (
    <div id="waveform-container" className="w-full h-40 relative rounded-2xl overflow-hidden bg-black/10 border border-white/5 backdrop-blur-sm">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
