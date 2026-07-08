import { useEffect, useRef, useState } from "react";

interface Thought {
  id: number;
  text: string;
  time: string;
  cat: "proc" | "mem" | "inf" | "net";
}

const CAT_COLORS: Record<string, string> = {
  proc: "bg-cyan-400",
  mem: "bg-purple-400",
  inf: "bg-emerald-400",
  net: "bg-amber-400",
};

const CAT_TEXT_COLORS: Record<string, string> = {
  proc: "text-cyan-400/40",
  mem: "text-purple-400/40",
  inf: "text-emerald-400/40",
  net: "text-amber-400/40",
};

const LINES: { text: string; cat: Thought["cat"] }[] = [
  { text: "processing input...", cat: "proc" },
  { text: "tokenizing speech...", cat: "proc" },
  { text: "attention heads activated", cat: "inf" },
  { text: "context window: 128k", cat: "mem" },
  { text: "retrieving memory...", cat: "mem" },
  { text: "latent query: 0.42", cat: "inf" },
  { text: "beam search depth: 3", cat: "inf" },
  { text: "top-p sampling: 0.92", cat: "inf" },
  { text: "temperature: 0.7", cat: "inf" },
  { text: "layer 24/32 complete", cat: "proc" },
  { text: "generating response...", cat: "proc" },
  { text: "inference: 210ms", cat: "inf" },
  { text: "output cache hit: 0.67", cat: "mem" },
  { text: "decoding tokens...", cat: "proc" },
  { text: "embedding lookup: 0.3ms", cat: "mem" },
  { text: "attn mask computed", cat: "proc" },
  { text: "top-k candidates: 40", cat: "inf" },
  { text: "repetition penalty: 1.1", cat: "inf" },
  { text: "KV cache size: 512", cat: "mem" },
  { text: "socket buffer: 24kB", cat: "net" },
  { text: "audio chunk received", cat: "net" },
  { text: "PCM decode: 0.8ms", cat: "proc" },
  { text: "vocal synthesis init", cat: "proc" },
  { text: "pitch contour mapped", cat: "inf" },
];

export function MindPanel() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const [elapsed, setElapsed] = useState("0:00");

  // Simulated AI activity stream
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setThoughts((prev) => {
        const line = LINES[i % LINES.length];
        const next = [
          ...prev,
          { id: idRef.current++, text: line.text, time: new Date().toLocaleTimeString(), cat: line.cat },
        ];
        return next.slice(-28);
      });
      i++;
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  // Elapsed timer
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(s / 60);
      setElapsed(`${m}:${String(s % 60).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll — only if user is already at the bottom
  const isNearBottomRef = useRef(true);
  const handleScroll = useRef(() => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 30; // px from bottom counts as "at bottom"
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  });

  // Bind scroll listener once
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => handleScroll.current();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (listRef.current && isNearBottomRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [thoughts]);

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
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/50">
          The Mind
        </span>
        <span className="ml-auto text-[9px] text-white/20 font-mono tabular-nums">
          {elapsed}
        </span>
      </div>

      {/* Activity stream */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto relative"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.04) transparent" }}
      >
        <div className="px-3 py-2 space-y-[3px]">
          {thoughts.length === 0 && (
            <div className="text-[10px] text-white/15 font-mono italic px-1 py-4 text-center">
              awaiting signal...
            </div>
          )}
          {thoughts.map((t) => (
            <div
              key={t.id}
              className="group flex items-center gap-2 text-[10px] leading-tight font-mono text-white/35 hover:text-white/60 transition-colors duration-300 px-1 py-[2px] rounded hover:bg-white/[0.02]"
            >
              {/* Category dot */}
              <span className={`w-1 h-1 rounded-full shrink-0 ${CAT_COLORS[t.cat]} opacity-40 group-hover:opacity-70 transition-opacity`} />
              {/* Timestamp — color-coded by category */}
              <span className={`shrink-0 text-[8px] w-[48px] text-right tabular-nums ${CAT_TEXT_COLORS[t.cat]}`}>
                {t.time}
              </span>
              {/* Text */}
              <span className="truncate">{t.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer overhead meter + legend */}
      <div className="relative px-3 py-2 border-t border-white/5 space-y-1.5">
        {/* Category legend */}
        <div className="flex items-center gap-2.5 text-[7px] font-mono text-white/20 uppercase tracking-wider">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" /> proc</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" /> inf</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400/50" /> mem</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400/50" /> net</span>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400/40 to-purple-400/40"
              style={{ width: `${Math.min(100, thoughts.length * 3)}%`, transition: "width 0.5s ease-out" }}
            />
          </div>
          <span className="text-[7px] font-mono text-white/15 tabular-nums">{thoughts.length}/28</span>
        </div>
      </div>
    </div>
  );
}
