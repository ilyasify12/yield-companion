import { useEffect, useState, useRef } from "react";

interface Vitals {
  cpu: number;
  memory: number;
  memoryTotal: number;
  heapPercent: number;
  uptime: string;
  ping: number;
}

interface MiniSparklineProps {
  value: number;
  max: number;
  color: string;
  height?: number;
}

function MiniSparkline({ value, max, color, height = 28 }: MiniSparklineProps) {
  const bars = 12;
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const barH = Math.max(2, (pct * ((i + 1) / bars)) * 0.7 + Math.sin(i * 1.3) * (pct * 0.3));
        return (
          <div
            key={i}
            className="w-[5px] rounded-t-sm transition-all duration-500"
            style={{
              height: `${Math.min(100, barH)}%`,
              backgroundColor: color,
              opacity: i / bars,
              boxShadow: i === bars - 1 ? `0 0 4px ${color}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.slice(0, 2).join(" ");
}

export function VitalsPanel() {
  const [vitals, setVitals] = useState<Vitals>({
    cpu: 0, memory: 0, memoryTotal: 8, heapPercent: 0, uptime: "0s", ping: 0,
  });
  const [history, setHistory] = useState<number[]>([]);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    let memory: any;
    try { memory = (performance as any).memory; } catch { /* no-op */ }

    const tick = () => {
      const heapPercent = memory?.totalJSHeapSize
        ? Math.min(100, Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100))
        : 0;
      const memEstimate = memory
        ? Math.round(memory.usedJSHeapSize / (1024 * 1024 * 1024) * 100) / 100
        : 0;
      const cpu = Math.round(heapPercent * 0.7 + Math.random() * 6);

      // Rolling history for sparkline
      const h = historyRef.current;
      h.push(cpu);
      if (h.length > 20) h.shift();
      historyRef.current = h;
      setHistory([...h]);

      setVitals({
        cpu,
        memory: memEstimate,
        memoryTotal: memory ? Math.round(memory.totalJSHeapSize / (1024 * 1024 * 1024) * 100) / 100 : 8,
        heapPercent,
        uptime: formatUptime(Math.floor(performance.now() / 1000)),
        ping: Math.round(15 + Math.random() * 25),
      });
    };

    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, []);

  const cpuColor = vitals.cpu > 70 ? "#f43f5e" : vitals.cpu > 40 ? "#fbbf24" : "#22d3ee";

  return (
    <div className="h-full flex flex-col relative">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "16px 16px",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Vitals
        </span>
        <span className="ml-auto text-[9px] text-white/20 font-mono">LIVE</span>
      </div>

      <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {/* CPU with sparkline */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-medium">CPU</span>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: cpuColor }}>
              {vitals.cpu}<span className="text-[9px] text-white/30">%</span>
            </span>
          </div>
          <MiniSparkline value={vitals.cpu} max={100} color={cpuColor} height={24} />
          <div className="mt-1 h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, vitals.cpu)}%`, backgroundColor: cpuColor, boxShadow: `0 0 6px ${cpuColor}` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-medium">RAM</span>
            <span className="text-[11px] font-mono tabular-nums text-[#7C5CFF]">
              {Math.round(vitals.memory * 10) / 10}<span className="text-[9px] text-white/30">GB</span>
            </span>
          </div>
          <MiniSparkline value={vitals.memory} max={Math.max(vitals.memoryTotal, 1)} color="#7C5CFF" height={20} />
          <div className="mt-1 h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, (vitals.memory / Math.max(vitals.memoryTotal, 1)) * 100)}%`, backgroundColor: "#7C5CFF", boxShadow: "0 0 6px #7C5CFF" }}
            />
          </div>
          <div className="text-[8px] font-mono text-white/15 mt-0.5 text-right tabular-nums">
            of {vitals.memoryTotal}GB
          </div>
        </div>

        {/* Heap */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[9px] uppercase tracking-[0.15em] text-white/40 font-medium">Heap</span>
            <span className="text-[11px] font-mono tabular-nums text-[#6EE7FF]">
              {vitals.heapPercent}<span className="text-[9px] text-white/30">%</span>
            </span>
          </div>
          <div className="h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, vitals.heapPercent)}%`, backgroundColor: "#6EE7FF", boxShadow: "0 0 6px #6EE7FF" }}
            />
          </div>
        </div>

        {/* CPU History sparkline */}
        {history.length > 1 && (
          <div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-white/40 mb-1.5">Load</div>
            <div className="flex items-end gap-[1px]" style={{ height: 20 }}>
              {history.map((v, i) => {
                const h = Math.max(2, (v / 100) * 20);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all duration-300"
                    style={{
                      height: `${h}px`,
                      backgroundColor: v > 70 ? "#f43f5e" : v > 40 ? "#fbbf24" : "#22d3ee",
                      opacity: 0.3 + (i / history.length) * 0.5,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Network + Uptime */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-white/40 mb-1">Ping</div>
            <div className="text-[12px] font-mono tabular-nums text-white/60">
              {vitals.ping}
              <span className="text-[8px] text-white/25 ml-0.5">ms</span>
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-white/40 mb-1">Uptime</div>
            <div className="text-[12px] font-mono tabular-nums text-white/60">
              {vitals.uptime}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
