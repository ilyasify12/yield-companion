import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, User, MessageSquare } from "lucide-react";
import { ChatMessage } from "../types";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  companionName: string;
  companionColor: string;
  sessionState: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  companionName,
  companionColor,
  sessionState,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat list on new messages or when opened
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      className="fixed inset-y-0 right-0 w-full sm:w-[420px] h-full bg-[#080A12]/90 border-l border-white/10 z-50 flex flex-col backdrop-blur-2xl shadow-2xl"
    >
      {/* Panel Header */}
      <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#7C5CFF]/30 to-transparent" />
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentcolor]"
              style={{ color: companionColor, backgroundColor: companionColor }}
            />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white/30 animate-ping" />
          </div>
          <div>
            <h2 className="text-xs font-display font-bold tracking-wide text-white uppercase">
              Transcript
            </h2>
            <p className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">
              with {companionName}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.15] text-gray-400 hover:text-white transition-all duration-200 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message Stream */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Scroll fade indicators */}
        <div className="sticky top-0 inset-x-0 h-6 bg-gradient-to-b from-[#080A12]/80 to-transparent z-10 pointer-events-none" />
        <div className="px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 pt-20">
              <motion.div
                animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-4"
              >
                <MessageSquare className="w-8 h-8 text-gray-500" />
              </motion.div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-[240px]">
                No logs yet. Speak or type to begin chatting with <span style={{ color: companionColor }} className="font-semibold">{companionName}</span>.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`flex gap-3 max-w-[85%] ${
                      isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    {/* Avatar representation */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border text-[10px] shrink-0 ${
                        isUser
                          ? "bg-[#7C5CFF]/10 border-[#7C5CFF]/20 text-[#A288FF]"
                          : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                      }`}
                      style={!isUser ? { borderColor: `${companionColor}33`, color: companionColor } : {}}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : companionName[0].toUpperCase()}
                    </div>

                    {/* Message Body */}
                    <div className="flex flex-col">
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed selection:bg-white/20 select-text ${
                          isUser
                            ? "bg-[#7C5CFF]/10 border border-[#7C5CFF]/20 text-[#EBE6FF] rounded-tr-sm"
                            : "bg-white/[0.03] border border-white/[0.06] text-gray-100 rounded-tl-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[8px] font-mono text-gray-600 mt-1 px-1">
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="sticky bottom-0 inset-x-0 h-6 bg-gradient-to-t from-[#080A12]/80 to-transparent z-10 pointer-events-none" />
      </div>

      {/* Footer hint */}
      <div className="px-6 py-3 border-t border-white/5 bg-white/[0.01]">
        <p className="text-[8px] font-mono text-gray-600 text-center uppercase tracking-wider">
          Type in the terminal below &middot; Typing interrupts voice playback
        </p>
      </div>
    </motion.div>
  );
};
