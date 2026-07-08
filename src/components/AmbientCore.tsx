import { useEffect, useRef } from "react";
import { SessionState } from "../types";

interface AmbientCoreProps {
  state: SessionState;
  companionColor?: string;
  analyser?: AnalyserNode | null;
  micVolume?: number;
}

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  size: number; alpha: number; speed: number;
  baseX: number; baseY: number; baseZ: number;
  freqBand: number; // which frequency bin this particle maps to
}

export function AmbientCore({
  state,
  companionColor = "#7C5CFF",
  analyser,
  micVolume = 0,
}: AmbientCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const phase = useRef(0);
  const animId = useRef(0);
  const dataArray = useRef(new Uint8Array(0));
  const smoothedMag = useRef(0);

  const isSpeaking = state === "speaking";
  const isThinking = state === "connecting" || state === "thinking";
  const isListening = state === "listening";
  const isIdle = !isSpeaking && !isThinking && !isListening && state !== "disconnected" && state !== "error";
  const isOff = state === "disconnected" || state === "error";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 1.5);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();

    // Init analyser buffer
    if (analyser) {
      analyser.fftSize = 128;
      dataArray.current = new Uint8Array(analyser.frequencyBinCount);
    }

    const hexToRgb = (hex: string) => {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r
        ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
        : { r: 124, g: 92, b: 255 };
    };

    // ── Init particles ──
    const COUNT = 180;
    const pArr: Particle[] = [];
    for (let i = 0; i < COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 70 + (Math.random() - 0.5) * 20;
      // Map index to a frequency band (0 = bass, 1 = mids, 2 = highs)
      const freqBand = i < COUNT * 0.3 ? 0 : i < COUNT * 0.65 ? 1 : 2;
      pArr.push({
        x: Math.sin(phi) * Math.cos(theta) * r,
        y: Math.sin(phi) * Math.sin(theta) * r,
        z: Math.cos(phi) * r,
        vx: 0, vy: 0, vz: 0,
        size: 1.2 + Math.random() * 1.8,
        alpha: 0.2 + Math.random() * 0.6,
        speed: 0.005 + Math.random() * 0.01,
        baseX: Math.sin(phi) * Math.cos(theta) * r,
        baseY: Math.sin(phi) * Math.sin(theta) * r,
        baseZ: Math.cos(phi) * r,
        freqBand,
      });
    }
    particles.current = pArr;

    // ── Orbital ring config ──
    const RINGS = [
      { tiltX: 0.3, tiltZ: 0.1, speed: 0.15, radius: 95, opacity: 0.12, width: 1, dash: [4, 8] as [number, number] },
      { tiltX: 0.7, tiltZ: 0.4, speed: -0.1, radius: 110, opacity: 0.08, width: 0.8, dash: [2, 6] as [number, number] },
      { tiltX: 0.1, tiltZ: 0.6, speed: 0.08, radius: 85, opacity: 0.06, width: 0.6, dash: [1, 4] as [number, number] },
    ];

    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      phase.current += 0.01;
      const t = phase.current;
      const rgb = hexToRgb(companionColor);

      // ── Read audio data ──
      let freqData: Uint8Array | null = null;
      const data = dataArray.current;
      if (isSpeaking && analyser && data.length > 0) {
        analyser.getByteFrequencyData(data);
        freqData = data;
        // Smooth the overall magnitude
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        smoothedMag.current += (avg - smoothedMag.current) * 0.3;
      } else if (isListening) {
        // Use mic volume when listening
        smoothedMag.current += (micVolume - smoothedMag.current) * 0.2;
      } else {
        smoothedMag.current += (0 - smoothedMag.current) * 0.05;
      }
      const mag = smoothedMag.current;

      // ─── Ambient glow ───
      const glowR = Math.min(w, h) * (isSpeaking ? 0.55 + mag * 0.15 : isThinking ? 0.5 : 0.35);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      const glowA = isSpeaking ? 0.15 + mag * 0.1 : isThinking ? 0.12 : 0.06;
      grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${glowA})`);
      grad.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},${glowA * 0.5})`);
      grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // ─── Orbital rings ───
      if (!isOff) {
        for (const ring of RINGS) {
          const ringAlpha = isSpeaking ? ring.opacity * (1 + mag * 2) : isThinking ? ring.opacity * 1.4 : ring.opacity;
          if (ringAlpha < 0.01) continue;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(ring.tiltZ);
          ctx.scale(1, Math.cos(ring.tiltX));
          ctx.rotate(t * ring.speed);

          ctx.shadowBlur = 6;
          ctx.shadowColor = companionColor;
          ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${ringAlpha})`;
          ctx.lineWidth = ring.width;
          ctx.setLineDash(ring.dash);
          ctx.beginPath();
          ctx.arc(0, 0, ring.radius + mag * 15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }

      // ─── Update & draw particles ───
      const ps = particles.current;
      // Base radius shrinks when thinking, expands with audio
      const baseRadius = isThinking ? 32 : isSpeaking ? 48 : 60;

      // Map frequency bands to displacement
      const getFreqDisplacement = (band: number): number => {
        if (!freqData || freqData.length === 0) return 0;
        const len = freqData.length;
        let start = 0, end = len;
        if (band === 0) { start = 0; end = Math.floor(len * 0.3); }       // bass
        else if (band === 1) { start = Math.floor(len * 0.3); end = Math.floor(len * 0.65); } // mids
        else { start = Math.floor(len * 0.65); end = len; } // highs
        let sum = 0, count = 0;
        for (let i = start; i < end && i < len; i++) { sum += freqData[i]; count++; }
        const avg = count > 0 ? sum / count / 255 : 0;
        return avg * avg * 40; // Exponential curve for dramatic effect
      };

      // Sort back-to-front for depth
      const sorted = ps.slice().sort((a, b) => a.z - b.z);

      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];

        // Frequency displacement + wave
        const freqDisp = isSpeaking ? getFreqDisplacement(p.freqBand) : 0;
        const waveAmp = isSpeaking
          ? 8 + mag * 20
          : isListening
          ? 3 + micVolume * 12
          : 0;
        const wave = waveAmp * Math.sin(t * 3 + i * 0.1);
        const radius = baseRadius + wave + Math.sin(t * 0.5 + i) * 2 + freqDisp;

        // Rotation speed increases with audio
        const speedMul = 1 + mag * 3;
        const rot = t * p.speed * 2 * speedMul;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);

        let tx = p.baseX * cosR - p.baseZ * sinR;
        let tz = p.baseX * sinR + p.baseZ * cosR;
        let ty = p.baseY;

        const magVec = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        const normX = (tx / magVec) * radius;
        const normY = (ty / magVec) * radius;
        const normZ = (tz / magVec) * radius;

        p.x += (normX - p.x) * 0.08;
        p.y += (normY - p.y) * 0.08;
        p.z += (normZ - p.z) * 0.08;

        if (isOff || isIdle) {
          p.x += Math.sin(t * 0.3 + i) * 0.08;
          p.y += Math.cos(t * 0.4 + i * 0.7) * 0.08;
        }

        // ── Project ──
        const perspective = 300;
        const scale = perspective / (perspective + p.z);
        const px = cx + p.x * scale;
        const py = cy + p.y * scale;
        const pSize = (p.size + (isSpeaking ? mag * 3 : 0)) * scale;

        // Alpha
        const depthAlpha = 0.3 + ((p.z + radius) / (radius * 2)) * 0.7;
        const stateAlpha = isOff ? 0.15 : isThinking ? 0.9 : isSpeaking ? 0.7 + mag * 0.3 : 0.55;
        const alpha = p.alpha * depthAlpha * stateAlpha;

        // ── Draw ──
        ctx.shadowBlur = isSpeaking ? 8 + mag * 12 : 4;
        ctx.shadowColor = companionColor;
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
        ctx.fill();

        // ── Connection lines (speaking/thinking) ──
        if (isSpeaking || isThinking) {
          for (let j = i + 1; j < Math.min(i + 5, ps.length); j++) {
            const p2 = ps[j];
            const dx = (px - (cx + p2.x * (perspective / (perspective + p2.z)))) * 2;
            const dy = (py - (cy + p2.y * (perspective / (perspective + p2.z)))) * 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const threshold = isSpeaking ? 40 + mag * 30 : 35;

            if (dist < threshold) {
              ctx.shadowBlur = 0;
              ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${(isSpeaking ? 0.12 + mag * 0.1 : 0.06) * (1 - dist / threshold)})`;
              ctx.lineWidth = isSpeaking ? 0.6 + mag * 1.5 : 0.4;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(cx + p2.x * (perspective / (perspective + p2.z)), cy + p2.y * (perspective / (perspective + p2.z)));
              ctx.stroke();
            }
          }
        }
      }

      // ─── Inner corona ───
      const coronaPulse = isSpeaking
        ? 0.5 + mag * 0.8 + Math.sin(t * 4) * 0.2
        : isThinking
        ? 0.4
        : 0.2;
      ctx.shadowBlur = isSpeaking ? 40 + mag * 30 : 20;
      ctx.shadowColor = companionColor;
      const coronaGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 0.35 + mag * 20);
      coronaGrad.addColorStop(0, `rgba(255,255,255,${coronaPulse * 0.5})`);
      coronaGrad.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},${coronaPulse * 0.2})`);
      coronaGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 0.35 + mag * 20, 0, Math.PI * 2);
      ctx.fill();

      // ─── Center dot ───
      ctx.shadowBlur = isSpeaking ? 35 + mag * 20 : 15;
      ctx.shadowColor = companionColor;
      ctx.beginPath();
      ctx.arc(cx, cy, (isSpeaking ? 3 : 2) + mag * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${isSpeaking ? 0.6 + mag * 0.3 : 0.4})`;
      ctx.fill();

      ctx.shadowBlur = 0;
      animId.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId.current);
  }, [companionColor, isSpeaking, isThinking, isListening, isIdle, isOff, analyser, micVolume]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
