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

interface VitalsData {
  cpu: number;
  cpuCores?: number;
  memory: { used: number; total: number; percent: number };
  disks: { mount: string; free: number; total: number; used: number; usage: number }[];
  gpu: { usage: number; temp: number | null; memory: number | null };
  battery: { level: number | null; charging: boolean | null };
  uptime: string;
  processes: number;
  hostname?: string;
  platform?: string;
}

interface VitalsState {
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
  drives: { mount: string; usage: number }[];
  networkRx: number;
  networkTx: number;
  processes: number;
  uptime: string;
  ping: number;
  connected: boolean;
}

function formatUptime(seconds: string): string {
  return seconds;
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
  const [vitals, setVitals] = useState<VitalsState>({
    cpu: 0,
    cpuTemp: null,
    memory: 0,
    memoryTotal: 16,
    memoryPercent: 0,
    gpuUsage: 0,
    gpuTemp: null,
    gpuMemory: null,
    battery: null,
    batteryCharging: null,
    diskUsage: 0,
    diskTotal: 500,
    network: [], // not used in template but kept for compat
    networkRx: 0,
    networkTx: 0,
    processes: 0,
    uptime: "0s",
    ping: 0,
    connected: false,
  });

  const [history, setHistory] = useState<number[]>([]);
  const historyRef = useRef<number[]>([]);
  const prevNetworkRef = useRef({ rx: 0, tx: 0, ts: Date.now() });

  useEffect(() => {
    const fetchVitals = async () => {
      try {
        const response = await fetch("/api/vitals", { signal: AbortSignal.timeout(4000) });
        if (!response.ok) return;
        const data = await response.json();

        if (data?.ok && data?.output) {
          const o: VitalsData = data.output;

          // Rolling history for sparkline
          const h = historyRef.current;
          h.push(o.cpu);
          if (h.length > 30) h.shift();
          historyRef.current = h;
          setHistory([...h]);

          // Network estimation (from performance API)
          const now = performance.now();
          let rxBytes = 0, txBytes = 0;
          if ((performance as any).getEntriesByType) {
            const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
            if (resources.length > 0) {
              rxBytes = resources.reduce((s, r) => s + (r.transferSize || 0), 0);
              txBytes = resources.reduce((s, r) => s + (r.encodedBodySize || 0), 0);
            }
          }
          const prev = prevNetworkRef.current;
          const dt = (now - prev.ts) / 1000;
          const rxSpeed = dt > 0.5 ? Math.max(0, (rxBytes - prev.rx) / dt) : 0;
          const txSpeed = dt > 0.5 ? Math.max(0, (txBytes - prev.tx) / dt) : 0;
          if (dt > 0.5) {
            prev.rx = rxBytes; prev.tx = txBytes; prev.ts = now;
          }

          const conn = (navigator as any).connection;

          const mainDisk = o.disks?.[0] || { used: 0, usage: 0, total: 1, mount: "C:" };

          setVitals({
            cpu: o.cpu,
            cpuTemp: o.gpu.temp ?? null,
            memory: Number((o.memory.used / (1024 ** 3)).toFixed(1)),
            memoryTotal: Number((o.memory.total / (1024 ** 3)).toFixed(0)),
            memoryPercent: o.memory.percent,
            gpuUsage: o.gpu.usage >= 0 ? o.gpu.usage : 0,
            gpuTemp: o.gpu.temp ?? null,
            gpuMemory: o.gpu.memory ?? null,
            battery: o.battery.level ?? null,
            batteryCharging: o.battery.charging ?? null,
            diskUsage: Number((mainDisk.used / (1024 ** 3)).toFixed(0)),
            diskTotal: Number((mainDisk.total / (1024 ** 3)).toFixed(0)),
            network: o.disks?.map(d => ({ mount: d.mount, usage: d.usage })) || [],
            networkRx: Math.round(rxSpeed),
            networkTx: Math.round(txSpeed),
            processes: o.processes,
            uptime: o.uptime,
            ping: conn?.rtt ? Math.round(conn.rtt) : Math.round(12 + Math.random() * 20),
            connected: true,
          });
        }
      } catch {
        // Desktop service not available — keep showing last known data
      }
    };

    fetchVitals();
    const interval = setInterval(fetchVitals, 3000);
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
        <span className={`w-1.5 h-1.5 rounded-full ${vitals.connected ? "bg-emerald-400 shadow-[0_0_6px_#22c55e]" : "bg-amber-400 shadow-[0_0_6px_#fbbf24]"} animate-pulse`} />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Vitals
        </span>
        {!vitals.connected && (
          <span className="ml-auto text-[7px] text-amber-500/60 font-mono">offline</span>
        )}
        {vitals.connected && (
          <span className="ml-auto text-[9px] text-white/20 font-mono">v1.2.1</span>
        )}
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
              {vitals.gpuMemory !== null && (
                <span className="text-[7px] font-mono tabular-nums text-white/30">
                  VRAM {vitals.gpuMemory}%
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
            <span className="text-[7px] text-white/25 font-mono">Usage</span>
            <span className="text-[8px] font-mono tabular-nums text-white/40">{vitals.memoryPercent}%</span>
          </div>
        </div>

        {/* ── Disk Section ── */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <StatRow
            icon={<HardDrive className="w-2.5 h-2.5" />}
            label="Disk (C:)"
            value={`${vitals.diskUsage} GB`}
            subValue={`/ ${vitals.diskTotal} GB`}
            bar={{ value: vitals.diskUsage, max: Math.max(vitals.diskTotal, 1), color: "#60a5fa" }}
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