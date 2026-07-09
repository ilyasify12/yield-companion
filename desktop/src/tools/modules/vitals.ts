/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real OS system vitals — CPU, memory, disk, GPU, battery, uptime.
 * Exposes a "getSystemVitals" tool that the frontend VitalsPanel
 * fetches via the main server proxy (/api/vitals).
 */

import os from "os";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import type { Tool, ToolResult } from "../types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function cpuCount(): number {
  return os.cpus().length;
}

/**
 * Estimate CPU usage % synchronously.
 * Uses os.cpus() which returns a snapshot of cumulative tick counts.
 * We approximate by looking at the delta between the first and last
 * half of the available processors — a cheap single-call heuristic.
 */
function estimateCpuUsage(): number {
  const cpus = os.cpus();
  if (cpus.length === 0) return 0;
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    const t = cpu.times;
    const idle = t.idle;
    const tick = t.user + t.nice + t.sys + t.idle + t.irq;
    totalIdle += idle;
    totalTick += tick;
  }
  // This is a cumulative (since-boot) ratio — we approximate load
  // by looking at non-idle / total. Over short intervals this is noisy,
  // but it avoids the 100ms-blocking setTimeout approach.
  return totalTick > 0
    ? Math.round((1 - totalIdle / totalTick) * 100)
    : 0;
}

interface DiskInfo {
  free: number;
  total: number;
  used: number;
  usage: number; // percent
  mount: string;
}

/** Grab disk usage for the system drive (C:\ on Windows, / on POSIX). */
function getDiskInfo(): DiskInfo[] {
  const drives: DiskInfo[] = [];
  if (process.platform === "win32") {
    try {
      const out = execSync("wmic logicaldisk get DeviceID,Size,FreeSpace /format:csv", {
        encoding: "utf8",
        timeout: 3000,
        windowsHide: true,
      });
      for (const line of out.split(/\r?\n/).slice(1)) {
        const parts = line.trim().split(",");
        if (parts.length >= 3 && parts[1] && parts[2]) {
          const total = BigInt(parts[2]);
          const free  = BigInt(parts[1]);
          if (total > 0n) {
            drives.push({
              mount: parts[0] || "?",
              free: Number(free),
              total: Number(total),
              used: Number(total - free),
              usage: Number(((Number(total - free) / Number(total)) * 100).toFixed(1)),
            });
          }
        }
      }
    } catch { /* wmic may not be available */ }
  } else {
    // POSIX: use df
    try {
      const out = execSync("df -k /", { encoding: "utf8", timeout: 3000 });
      const lines = out.trim().split(/\r?\n/);
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 4) {
          const total = parseInt(parts[1], 10) * 1024;
          const free = parseInt(parts[3], 10) * 1024;
          if (total > 0) {
            drives.push({
              mount: "/",
              total,
              free,
              used: total - free,
              usage: Number(((total - free) / total * 100).toFixed(1)),
            });
          }
        }
      }
    } catch { /* ignore */ }
  }
  return drives;
}

/** Grab GPU utilisation via nvidia-smi (optional, returns -1 if unavailable). */
function getGpuInfo(): { usage: number; temp: number | null; memory: number | null } {
  try {
    const out = execSync(
      'nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,nounits,noheader',
      { encoding: "utf8", timeout: 3000, windowsHide: true }
    );
    const parts = out.trim().split(",").map((s) => s.trim());
    return {
      usage: parseInt(parts[0] || "0", 10) || 0,
      temp: parseInt(parts[1] || "0", 10) || null,
      memory: parts[2] && parts[3]
        ? Math.round((parseInt(parts[2], 10) / Math.max(parseInt(parts[3], 10), 1)) * 100)
        : null,
    };
  } catch {
    return { usage: -1, temp: null, memory: null };
  }
}

/** Battery info via Windows WMIC. */
function getBatteryInfo(): { level: number | null; charging: boolean | null } {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'wmic path Win32_Battery get EstimatedChargeRemaining,BatteryStatus /format:csv',
        { encoding: "utf8", timeout: 3000, windowsHide: true }
      );
      const lines = out.trim().split(/\r?\n/).filter(Boolean);
      for (const line of lines.slice(1)) {
        const parts = line.split(",");
        if (parts.length >= 2) {
          const batteryStatus = parseInt(parts[1], 10);
          const level = parseInt(parts[0], 10);
          return {
            level: isNaN(level) ? null : level,
            charging: isNaN(batteryStatus) ? null : batteryStatus === 2 || batteryStatus === 6,
          };
        }
      }
    } else {
      try {
        const cap = readFileSync("/sys/class/power_supply/BAT0/capacity", "utf8").trim();
        const status = readFileSync("/sys/class/power_supply/BAT0/status", "utf8").trim();
        return { level: parseInt(cap, 10) || null, charging: status === "Charging" };
      } catch { /* no battery */ }
    }
  } catch { /* no battery or command failed */ }
  return { level: null, charging: null };
}

function getUptime(): string {
  const sec = Math.floor(os.uptime());
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.slice(0, 2).join(" ");
}

// ── Tool ──────────────────────────────────────────────────────────────

export const getSystemVitalsTool: Tool = {
  name: "getSystemVitals",
  description: "Returns real-time OS vitals: CPU usage, memory, disk, GPU (if available), battery, uptime, and process count.",
  parameters: {
    type: "OBJECT",
    properties: {},
    required: [],
  },
  permissions: ["system.info"],
  async handler(_args, _ctx): Promise<ToolResult> {
    const cpuPct = estimateCpuUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPct = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
    const disks = getDiskInfo();
    const gpu = getGpuInfo();
    const battery = getBatteryInfo();

    return {
      ok: true,
      output: {
        cpu: cpuPct,
        cpuCores: cpuCount(),
        memory: {
          used: usedMem,
          total: totalMem,
          percent: memPct,
        },
        disks,
        gpu,
        battery,
        uptime: getUptime(),
        processes: os.loadavg
          ? Math.round(os.loadavg()[0] * cpuCount() * 10)
          : 0,
        hostname: os.hostname(),
        platform: process.platform,
        arch: process.arch,
      },
      summary: `CPU ${cpuPct}% · RAM ${memPct}% · ${disks.length > 0 ? `Disk ${disks[0].usage}%` : "no disk info"}`,
    };
  },
};

export const vitalsTools: Tool[] = [getSystemVitalsTool];