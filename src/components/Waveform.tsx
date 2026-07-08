/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { SessionState } from "../types";

interface WaveformProps {
  micVolume: number; // 0 to 1
  assistantAnalyser: AnalyserNode | null;
  state: SessionState;
  color?: string; // e.g. #7C5CFF or #6EE7FF
}

export function Waveform({
  micVolume,
  assistantAnalyser,
  state,
  color = "#7C5CFF",
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap effective pixel ratio to 1 on low-end devices to reduce fill-rate
    const dpr = Math.min(window.devicePixelRatio, 1.5);

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    resizeCanvas();
    // Only rescale on resize; skip ctx.scale to avoid per-frame divisions

    let dataArray = new Uint8Array(0);
    if (assistantAnalyser) {
      assistantAnalyser.fftSize = 128; // halved from 256 — fewer points to draw
      const bufferLength = assistantAnalyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : { r: 124, g: 92, b: 255 };
    };

    // Throttle — skip every other frame when idle to halve CPU
    let skipFrame = false;

    const render = () => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerY = height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      phaseRef.current += state === "speaking" ? 0.12 : 0.06;
      const phase = phaseRef.current;
      const rgb = hexToRgb(color);

      // Skip every other idle/connecting frame
      if (state === "disconnected" || state === "connecting" || state === "error") {
        skipFrame = !skipFrame;
        if (skipFrame) {
          animationRef.current = requestAnimationFrame(render);
          return;
        }
      }

      if (state === "speaking" && assistantAnalyser) {
        // ── SPEAKING: audio spectrum with simplified drawing ──
        assistantAnalyser.getByteFrequencyData(dataArray);
        const len = Math.floor(dataArray.length * 0.85);

        // Build wave points (reduced resolution — draw every other)
        const step = 2;
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < len; i += step) {
          const percent = dataArray[i] / 255;
          const amplitude = percent * (height * 0.42);
          const x = (i / (len - 1)) * width;
          const y = centerY + Math.sin(i * 0.2 + phase) * amplitude;
          points.push({ x, y });
        }

        // Gradient fill
        if (points.length > 1) {
          const gradient = ctx.createLinearGradient(0, centerY, 0, height);
          gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
          gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
          ctx.lineTo(points[points.length - 1].x, height);
          ctx.lineTo(points[0].x, height);
          ctx.closePath();
          ctx.fill();
        }

        // Main wave stroke (lighter shadow)
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          if (i === 0) ctx.moveTo(points[i].x, points[i].y);
          else ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Sparkle dots — only every 4th point
        for (let i = 0; i < points.length; i += 4) {
          const idx = i * step;
          const percent = idx < dataArray.length ? dataArray[idx] / 255 : 0;
          if (percent > 0.6) {
            ctx.beginPath();
            ctx.arc(points[i].x, points[i].y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${(percent - 0.6) * 2.5})`;
            ctx.fill();
          }
        }

      } else if (state === "listening") {
        // ── LISTENING: 2 sine layers (down from 3) ──
        const volumeScale = Math.min(1.0, micVolume * 7);
        const baseAmplitude = 12 + volumeScale * (height * 0.4);

        const layers = [
          { amp: baseAmplitude, freq: 0.016, speed: phase, opacity: 0.9, width: 3 },
          { amp: baseAmplitude * 0.45, freq: 0.032, speed: -phase * 1.3, opacity: 0.4, width: 1.5 },
        ];

        layers.forEach((layer) => {
          ctx.shadowBlur = 6;
          ctx.shadowColor = "#6EE7FF";
          ctx.strokeStyle = `rgba(110, 231, 255, ${layer.opacity})`;
          ctx.lineWidth = layer.width;
          ctx.beginPath();
          // Step by 2 pixels
          for (let x = 0; x < width; x += 2) {
            const envelope = Math.sin((x / width) * Math.PI);
            const y = centerY + Math.sin(x * layer.freq + layer.speed) * layer.amp * envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        });

      } else if (state === "thinking") {
        // ── THINKING: 2 orbital rings (down from 3), lighter shadow ──
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        const maxRadius = Math.min(width, height) * 0.28;

        for (let r = 0; r < 2; r++) {
          const p = phase * (1 - r * 0.15) * 0.4;
          const radius = maxRadius * (0.55 + r * 0.22) + Math.sin(phase * 1.8 + r) * 4;
          ctx.beginPath();
          const opacity = r === 0 ? 0.8 : 0.35;
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
          ctx.lineWidth = r === 0 ? 2 : 1;

          // Coarser angle step
          for (let angle = 0; angle <= Math.PI * 2; angle += 0.1) {
            const morph = Math.sin(angle * 4 + phase * 2.5) * 5;
            const x = width / 2 + Math.cos(angle + p) * (radius + morph);
            const y = centerY + Math.sin(angle + p) * (radius + morph);
            if (angle === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

      } else if (state === "connecting" || state === "reconnecting") {
        // ── CONNECTING: simpler pulse ──
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
        ctx.lineWidth = 2;

        const pulse = (phase * 12) % (width * 0.45);
        ctx.beginPath();
        ctx.arc(width / 2, centerY, Math.max(10, pulse), 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Center dot
        ctx.beginPath();
        ctx.arc(width / 2, centerY, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

      } else if (state === "error") {
        // ── ERROR: simpler erratic pulse ──
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#f43f5e";
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Step by 3
        for (let x = 0; x < width; x += 3) {
          let y = centerY;
          if (x > width * 0.2 && x < width * 0.8) {
            const seed = Math.sin(x * 0.25 + phase * 12);
            if (Math.abs(seed) > 0.6) y += seed * 20;
          }
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

      } else {
        // ── DISCONNECTED / IDLE: simple breathing line ──
        const breathe = Math.sin(phase * 0.5) * 0.15 + 0.5;
        ctx.shadowBlur = 3;
        ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`;
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        // Step by 3
        for (let x = 0; x < width; x += 3) {
          const breathingY = centerY + Math.sin(x * 0.01 + phase * 0.3) * breathe * 3;
          if (x === 0) ctx.moveTo(x, breathingY);
          else ctx.lineTo(x, breathingY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, assistantAnalyser, micVolume, color]);

  return (
    <div id="reusable-waveform-container" className="w-full h-16 relative overflow-hidden bg-transparent border-0 transform-gpu">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
