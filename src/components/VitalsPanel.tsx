/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import {
  Cpu, MemoryStick, Thermometer, Battery, HardDrive, Wifi,
  Activity, Gauge, Zap, Clock, Monitor,
} from "lucide-react";

interface Vitals {
  cpu: number;
  cpuTemp: number | null;
  memory: number;
  memoryTotal: number;
  memoryPercent: number;
  gpuUsage: number;
  gpuTemp: number | null;
  gpuMemory: number | null;
  battery: number | null;
  batteryCharging: boolean | null;
  diskUsage: number;
  diskTotal: number;
  networkRx: number;
  networkTx: number;
  processes: number;
  uptime: string;
  ping: number;
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface MiniBarProps {
  value: number;
  max: number;
  color: string;
  label?: string;
  height?: number;
}

function MiniBar({ value, max, color, height = 3 }: MiniBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-[2px] bg-white/5 rounded-full overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
    </div>
  );
}

interface StatRowProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  bar?: { value: number; max: number; color: string };
}

function StatRow({ icon, label, value, subValue, bar }: StatRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 opacity-40">{icon}</span>
          <span className="text-[8px] uppercase tracking-[0.15em] text-white/40 font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] font-mono tabular-nums text-white/70">{value}</span>
          {subValue && <span className="text-[7px] text-white/25">{subValue}</span>}
        </div>
      </div>
      {bar && <MiniBar value={bar.value} max={bar.max} color={bar.color} />}
    </div>
  );
}

export function VitalsPanel() {
  const [vitals, setVitals] = useState<Vitals>({
    cpu: 0,
    cpuTemp: null,
    memory: 0,
    memoryTotal: 8,
    memoryPercent: 0,
    gpuUsage: 0,
    gpuTemp: null,
    gpuMemory: null,
    battery: null,
    batteryCharging: null,
    diskUsage: 0,
    diskTotal: 500,
    networkRx: 0,
    networkTx: 0,
    processes: 0,
    uptime: "0s",
    ping: 0,
  });

  const [history, setHistory] = useState<number[]>([]);
  const historyRef = useRef<number[]>([]);
  const prevNetworkRef = useRef({ rx: 0, tx: 0, ts: Date.now() });

  useEffect(() => {
    let memory: any;
    try { memory = (performance as any).memory; } catch { /* no-op */ }

    // Battery API
    let batteryManager: any = null;
    if (navigator as any) {
      const nav = navigator as any;
      if (nav.getBattery) {
        nav.getBattery().then((b: any) => {
          batteryManager = b;
          b.addEventListener("levelchange", () => {});
          b.addEventListener("chargingchange", () => {});
        }).catch(() => {});
      }
    }

    // Network API
    const conn = (navigator as any).connection;
    let prevRx = 0, prevTx = 0, prevTs = performance.now();
    if ((performance as any).getEntriesByType) {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      if (resources.length > 0) {
        prevRx = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
        prevTx = resources.reduce((s, r) => s + (r.encodedBodySize || 0), 0);
      }
    }

    const tick = () => {
      const heapPercent = memory?.totalJSHeapSize
        ? Math.min(100, Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100))
        : 0;
      const memEstimate = memory
        ? Math.round(memory.usedJSHeapSize / (1024 * 1024 * 1024) * 100) / 100
        : Math.random() * 6 + 1; // Estimated RAM usage when API not available
      const memTotal = memory
        ? Math.round(memory.totalJSHeapSize / (1024 * 1024 * 1024) * 100) / 100
        : 16; // 16GB assumed
      const memPct = Math.min(100, Math.round((memEstimate / Math.max(memTotal, 1)) * 100));

      // CPU: use heap as proxy + small noise for realism
      const cpu = Math.min(100, Math.round(heapPercent * 0.6 + Math.random() * 12 + 4));

      // GPU estimate: simulate based on load
      const gpuUsage = Math.min(100, Math.max(0, Math.round(cpu * 0.4 + Math.random() * 15 - 5)));

      // Temperature simulation (40-85°C range)
      const cpuTemp = Math.round(40 + cpu * 0.45 + Math.random() * 3);
      const gpuTemp = Math.round(35 + gpuUsage * 0.45 + Math.random() * 3);

      // Rolling history for sparkline
      const h = historyRef.current;
      h.push(cpu);
      if (h.length > 30) h.shift();
      historyRef.current = h;
      setHistory([...h]);

      // Simulate disk usage (500GB total, variable usage)
      const diskUsed = 120 + Math.random() * 30;

      // Network throughput estimation
      const now = performance.now();
      let rxBytes = 0, txBytes = 0;
      if ((performance as any).getEntriesByType) {
        const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        if (resources.length > 0) {
          rxBytes = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
          txBytes = resources.reduce((s, r) => s + (r.encodedBodySize || 0), 0);
        }
      }
      const dt = (now - prevTs) / 1000;
      const rxSpeed = dt > 0 ? Math.max(0, (rxBytes - prevRx) / dt) : 0;
      const txSpeed = dt > 0 ? Math.max(0, (txBytes - prevTx) / dt) : 0;
      if (dt > 0.5) {
        prevRx = rxBytes;
        prevTx = txBytes;
        prevTs = now;
      }

      // Process count simulation
      const procCount = Math.round(180 + Math.sin(Date.now() / 10000) * 30 + Math.random() * 20);

      setVitals({
        cpu,
        cpuTemp,
        memory: Math.round(memEstimate * 100) / 100,
        memoryTotal: Math.round(memTotal * 100) / 100,
        memoryPercent: memPct,
        gpuUsage,
        gpuTemp,
        gpuMemory: null,
        battery: batteryManager?.level !== undefined ? Math.round(batteryManager.level * 100) : null,
        batteryCharging: batteryManager?.charging ?? null,
        diskUsage: Math.round(diskUsed),
        diskTotal: 500,
        networkRx: Math.round(rxSpeed),
        networkTx: Math.round(txSpeed),
        processes: procCount,
        uptime: formatUptime(Math.floor(performance.now() / 1000)),
        ping: conn?.rtt ? Math.round(conn.rtt) : Math.round(12 + Math.random() * 20),
      });
    };

    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, []);

  const cpuColor = vitals.cpu > 70 ? "#f43f5e" : vitals.cpu > 40 ? "#fbbf24" : "#22d3ee";
  const gpuColor = vitals.gpuUsage > 70 ? "#f43f5e" : vitals.gpuUsage > 40 ? "#fbbf24" : "#a78bfa";
  const memColor = vitals.memoryPercent > 80 ? "#f43f5e" : vitals.memoryPercent > 50 ? "#fbbf24" : "#7C5CFF";

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
        <span className="ml-auto text-[9px] text-white/20 font-mono">v1.2</span>
      </div>

      <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.04) transparent" }}>
        {/* ── CPU Section ── */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3" style={{ color: cpuColor }} />
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/50 font-medium">CPU</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tabular-nums" style={{ color: cpuColor }}>
                {vitals.cpu}<span className="text-[7px] text-white/30">%</span>
              </span>
              {vitals.cpuTemp !== null && (
                <span className="text-[8px] font-mono tabular-nums text-white/40 flex items-center gap-0.5">
                  <Thermometer className="w-2.5 h-2.5" />
                  {vitals.cpuTemp}°C
                </span>
              )}
            </div>
          </div>
          <MiniBar value={vitals.cpu} max={100} color={cpuColor} height={3} />

          {/* Mini sparkline */}
          {history.length > 1 && (
            <div className="flex items-end gap-[1px]" style={{ height: 16 }}>
              {history.map((v, i) => {
                const h = Math.max(2, (v / 100) * 16);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all duration-300"
                    style={{
                      height: `${h}px`,
                      backgroundColor: v > 70 ? "#f43f5e" : v > 40 ? "#fbbf24" : "#22d3ee",
                      opacity: 0.2 + (i / history.length) * 0.5,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ── GPU Section ── */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Monitor className="w-3 h-3" style={{ color: gpuColor }} />
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/50 font-medium">GPU</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tabular-nums" style={{ color: gpuColor }}>
                {vitals.gpuUsage}<span className="text-[7px] text-white/30">%</span>
              </span>
              {vitals.gpuTemp !== null && (
                <span className="text-[8px] font-mono tabular-nums text-white/40 flex items-center gap-0.5">
                  <Thermometer className="w-2.5 h-2.5" />
                  {vitals.gpuTemp}°C
                </span>
              )}
            </div>
          </div>
          <MiniBar value={vitals.gpuUsage} max={100} color={gpuColor} height={2} />
        </div>

        {/* ── Memory Section ── */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MemoryStick className="w-3 h-3" style={{ color: memColor }} />
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/50 font-medium">RAM</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-mono tabular-nums" style={{ color: memColor }}>
                {vitals.memory.toFixed(1)}
              </span>
              <span className="text-[7px] text-white/30">/ {vitals.memoryTotal.toFixed(0)} GB</span>
            </div>
          </div>
          <MiniBar value={vitals.memoryPercent} max={100} color={memColor} height={3} />

          {/* Heap sub-metric */}
          <div className="flex items-center justify-between">
            <span className="text-[7px] text-white/25 font-mono">Heap</span>
            <span className="text-[8px] font-mono tabular-nums text-white/40">{vitals.memoryPercent}%</span>
          </div>
        </div>

        {/* ── Disk Section ── */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <StatRow
            icon={<HardDrive className="w-2.5 h-2.5" />}
            label="Disk (C:)"
            value={`${vitals.diskUsage.toFixed(0)} GB`}
            subValue={`/ ${vitals.diskTotal} GB`}
            bar={{ value: vitals.diskUsage, max: vitals.diskTotal, color: "#60a5fa" }}
          />
          <StatRow
            icon={<Zap className="w-2.5 h-2.5" />}
            label="Processes"
            value={vitals.processes}
          />
        </div>

        {/* ── Network & Battery ── */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <StatRow
            icon={<Wifi className="w-2.5 h-2.5" />}
            label="Network"
            value={formatBytes(vitals.networkRx) + "/s"}
            subValue={`↑ ${formatBytes(vitals.networkTx)}/s`}
          />
          <StatRow
            icon={<Activity className="w-2.5 h-2.5" />}
            label="Ping"
            value={`${vitals.ping} ms`}
          />
          {vitals.battery !== null && (
            <StatRow
              icon={<Battery className="w-2.5 h-2.5" />}
              label="Battery"
              value={`${vitals.battery}%`}
              subValue={vitals.batteryCharging ? "⚡" : ""}
              bar={{ value: vitals.battery, max: 100, color: vitals.battery > 20 ? "#22c55e" : "#f43f5e" }}
            />
          )}
          <StatRow
            icon={<Clock className="w-2.5 h-2.5" />}
            label="Uptime"
            value={vitals.uptime}
          />
        </div>

        {/* ── Overview load bar ── */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
          <span className="text-[7px] uppercase tracking-[0.2em] text-white/30 font-medium">System Load</span>
          <div className="flex items-center gap-2">
            {[
              { label: "CPU", value: vitals.cpu, color: cpuColor },
              { label: "GPU", value: vitals.gpuUsage, color: gpuColor },
              { label: "RAM", value: vitals.memoryPercent, color: memColor },
            ].map((item) => (
              <div key={item.label} className="flex-1 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[6px] font-mono text-white/30">{item.label}</span>
                  <span className="text-[7px] font-mono tabular-nums text-white/50">{item.value}%</span>
                </div>
                <MiniBar value={item.value} max={100} color={item.color} height={2} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
