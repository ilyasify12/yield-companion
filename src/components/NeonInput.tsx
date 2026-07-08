import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

interface NeonInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function NeonInput({
  onSend,
  disabled = false,
  placeholder = "> type a message...",
}: NeonInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  // Auto-focus on mount
  useEffect(() => {
    // Small delay so the UI settles
    const timer = setTimeout(() => inputRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        "relative group transition-all duration-300",
        focused ? "opacity-100" : "opacity-70 hover:opacity-90",
      ].join(" ")}
    >
      {/* Neon glow line */}
      <div
        className={[
          "absolute bottom-full left-0 right-0 h-[1px] transition-all duration-500",
          focused
            ? "bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent shadow-[0_0_12px_#22d3ee66]"
            : "bg-gradient-to-r from-transparent via-white/10 to-transparent",
        ].join(" ")}
      />

      {/* Input row */}
      <div className="relative flex items-center gap-2 px-3 py-1.5">
        {/* Prompt symbol */}
        <span
          className={[
            "font-mono text-sm transition-colors duration-300",
            focused ? "text-cyan-400" : "text-white/20",
          ].join(" ")}
        >
          {">"}
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          style={{ textShadow: focused ? '0 0 8px rgba(34,211,238,0.15)' : '0 0 4px rgba(0,0,0,0.5)' }}
          className={[
            "flex-1 bg-transparent border-none outline-none",
            "font-mono text-sm text-white/80",
            "placeholder:text-white/15 placeholder:font-mono",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            "caret-cyan-400",
          ].join(" ")}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className={[
            "relative flex items-center gap-1.5 px-3 py-1 rounded",
            "text-[10px] font-mono uppercase tracking-widest",
            "transition-all duration-300",
            focused && value.trim()
              ? "text-cyan-300 bg-white/[0.04] hover:bg-white/[0.08]"
              : "text-white/15",
            "disabled:opacity-20 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          <span className="w-1 h-1 rounded-full bg-current" />
          Send
        </button>
      </div>
    </form>
  );
}
