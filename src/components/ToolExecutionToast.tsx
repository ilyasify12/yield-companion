/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import {
  ExternalLink, Search, Clock, Clipboard, Sparkles,
  FolderOpen, Monitor, Play, FileText, Image, HardDrive,
  Terminal, Mouse, Keyboard, Volume2,
  SkipForward, SkipBack, Square, Film,
} from "lucide-react";

export interface ToolLog {
  id: string;
  name: string;
  args: any;
  status: "executing" | "completed" | "failed";
  timestamp: Date;
  result?: string;
}

interface ToolExecutionToastProps {
  logs: ToolLog[];
  onRemove: (id: string) => void;
}

export function ToolExecutionToast({ logs, onRemove }: ToolExecutionToastProps) {
  const getToolIcon = (name: string) => {
    switch (name) {
      case "openWebsite":
        return <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />;
      case "searchGoogle":
        return <Search className="w-3.5 h-3.5 text-purple-400" />;
      case "getCurrentTime":
        return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case "copyToClipboard":
        return <Clipboard className="w-3.5 h-3.5 text-emerald-400" />;
      case "openFile":
        return <FileText className="w-3.5 h-3.5 text-sky-400" />;
      case "openFolder":
        return <FolderOpen className="w-3.5 h-3.5 text-amber-400" />;
      case "revealInExplorer":
        return <FolderOpen className="w-3.5 h-3.5 text-orange-400" />;
      case "searchFiles":
        return <Search className="w-3.5 h-3.5 text-fuchsia-400" />;
      case "launchApp":
        return <Terminal className="w-3.5 h-3.5 text-rose-400" />;
      case "openUrl":
        return <ExternalLink className="w-3.5 h-3.5 text-cyan-500" />;
      case "openVideo":
        return <Play className="w-3.5 h-3.5 text-red-400" />;
      case "openPdf":
        return <FileText className="w-3.5 h-3.5 text-rose-400" />;
      case "openImage":
        return <Image className="w-3.5 h-3.5 text-green-400" />;
      case "readClipboard":
        return <Clipboard className="w-3.5 h-3.5 text-emerald-500" />;
      case "writeClipboard":
        return <Clipboard className="w-3.5 h-3.5 text-emerald-400" />;
      case "getCurrentWorkingDirectory":
        return <FolderOpen className="w-3.5 h-3.5 text-gray-400" />;
      case "listDrives":
        return <HardDrive className="w-3.5 h-3.5 text-blue-400" />;
      case "listCommonFolders":
        return <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />;
      case "captureScreen":
        return <Monitor className="w-3.5 h-3.5 text-violet-400" />;
      case "captureActiveWindow":
        return <Monitor className="w-3.5 h-3.5 text-violet-500" />;
      // PC Control
      case "moveMouse":
      case "clickMouse":
      case "scrollMouse":
      case "dragMouse":
        return <Mouse className="w-3.5 h-3.5 text-amber-400" />;
      case "typeText":
      case "pressKey":
      case "pressHotkey":
        return <Keyboard className="w-3.5 h-3.5 text-amber-400" />;
      // Media Control
      case "mediaPlayPause":
        return <Play className="w-3.5 h-3.5 text-emerald-400" />;
      case "mediaNextTrack":
        return <SkipForward className="w-3.5 h-3.5 text-emerald-400" />;
      case "mediaPrevTrack":
        return <SkipBack className="w-3.5 h-3.5 text-emerald-400" />;
      case "mediaStop":
        return <Square className="w-3.5 h-3.5 text-red-400" />;
      case "mediaVolumeSet":
      case "mediaVolumeUp":
      case "mediaVolumeDown":
      case "mediaMute":
        return <Volume2 className="w-3.5 h-3.5 text-sky-400" />;
      // YouTube
      case "youtubeSearch":
      case "youtubePlay":
      case "youtubeGetInfo":
        return <Film className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-[#7C5CFF]" />;
    }
  };

  const getToolDisplayName = (name: string) => {
    const map: Record<string, string> = {
      openWebsite: "Browser",
      searchGoogle: "Search",
      getCurrentTime: "Time",
      copyToClipboard: "Clipboard",
      openFile: "Open File",
      openFolder: "Open Folder",
      revealInExplorer: "Reveal File",
      searchFiles: "File Search",
      launchApp: "Launch App",
      openUrl: "Open URL",
      openVideo: "Open Video",
      openPdf: "Open PDF",
      openImage: "Open Image",
      readClipboard: "Read Clipboard",
      writeClipboard: "Write Clipboard",
      getCurrentWorkingDirectory: "Work Dir",
      listDrives: "List Drives",
      listCommonFolders: "Folders",
      captureScreen: "Screen Capture",
      captureActiveWindow: "Window Capture",
      // PC Control
      moveMouse: "Move Mouse",
      clickMouse: "Click",
      scrollMouse: "Scroll",
      dragMouse: "Drag",
      typeText: "Type Text",
      pressKey: "Press Key",
      pressHotkey: "Hotkey",
      // Media Control
      mediaPlayPause: "Play/Pause",
      mediaNextTrack: "Next Track",
      mediaPrevTrack: "Prev Track",
      mediaStop: "Stop",
      mediaVolumeSet: "Set Volume",
      mediaVolumeUp: "Vol Up",
      mediaVolumeDown: "Vol Down",
      mediaMute: "Mute",
      // YouTube
      youtubeSearch: "YouTube Search",
      youtubePlay: "YouTube Play",
      youtubeGetInfo: "YouTube Info",
    };
    return map[name] || "Tool Execute";
  };

  const getToolDescription = (name: string, args: any) => {
    switch (name) {
      case "openWebsite": return `Opening ${args.url || "site"}`;
      case "searchGoogle": return `Searching "${args.query || ""}"`;
      case "getCurrentTime": return "Retrieving system time";
      case "copyToClipboard": return "Text copied to clipboard";
      case "openFile": return `File: ${args.path || ""}`;
      case "openFolder": return `Folder: ${args.path || "Home"}`;
      case "revealInExplorer": return `Reveal: ${args.path || ""}`;
      case "searchFiles": return `Search: "${args.query || ""}"`;
      case "launchApp": return `Launch: ${args.name || ""}`;
      case "openUrl": return `URL: ${args.url || ""}`;
      case "openVideo": return `Video: ${args.path || ""}`;
      case "openPdf": return `PDF: ${args.path || ""}`;
      case "openImage": return `Image: ${args.path || ""}`;
      case "readClipboard": return "Reading clipboard";
      case "writeClipboard": return "Writing clipboard";
      case "getCurrentWorkingDirectory": return "Getting work dir";
      case "listDrives": return "Listing drives";
      case "listCommonFolders": return "Listing folders";
      case "captureScreen": return "Capturing screen...";
      case "captureActiveWindow": return "Capturing window...";
      // PC Control
      case "moveMouse": return `Moving to (${args.x}, ${args.y})`;
      case "clickMouse": return `Clicking ${args.button || "left"} button`;
      case "scrollMouse": return `Scrolling ${args.lines > 0 ? "up" : "down"}`;
      case "dragMouse": return `Dragging to (${args.x}, ${args.y})`;
      case "typeText": return `Typing ${(args.text||"").substring(0,30)}${args.text?.length > 30 ? "…" : ""}`;
      case "pressKey": return `Pressing ${args.key}`;
      case "pressHotkey": return `Pressing ${args.keys}`;
      // Media Control
      case "mediaPlayPause": return "Toggling play/pause";
      case "mediaNextTrack": return "Skipping to next track";
      case "mediaPrevTrack": return "Going to previous track";
      case "mediaStop": return "Stopping playback";
      case "mediaVolumeSet": return `Setting volume to ${args.level}%`;
      case "mediaVolumeUp": return `Increasing volume`;
      case "mediaVolumeDown": return `Decreasing volume`;
      case "mediaMute": return "Toggling mute";
      // YouTube
      case "youtubeSearch": return `Searching "${args.query || ""}"`;
      case "youtubePlay": return `Playing YouTube video`;
      case "youtubeGetInfo": return `Getting video info`;
      default: return "Executing tool...";
    }
  };

  // Show newest first, max 3
  const visibleLogs = logs.slice(0, 3);

  return (
    <div id="tool-toast-dock" className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-sm z-50 flex flex-col-reverse gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {visibleLogs.map((log, idx) => {
          const isExecuting = log.status === "executing";
          const statusColor = isExecuting ? "border-cyan-500/30" : log.status === "completed" ? "border-emerald-500/30" : "border-rose-500/30";
          const glowColor = isExecuting ? "rgba(34,211,238,0.15)" : log.status === "completed" ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)";

          return (
            <motion.div
              key={log.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.85, x: idx * 4 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                x: idx * 4,
                transition: { type: "spring", stiffness: 300, damping: 25, delay: idx * 0.02 },
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                y: -10,
                transition: { duration: 0.15 },
              }}
              className={`flex items-center gap-3 p-2.5 bg-[#080A15]/85 border ${statusColor} rounded-xl backdrop-blur-lg shadow-2xl pointer-events-auto`}
              style={{ boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${glowColor}` }}
            >
              {/* Tool Icon */}
              <div className="p-1.5 rounded-lg bg-white/5 shrink-0">
                {getToolIcon(log.name)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                    {getToolDisplayName(log.name)}
                  </span>
                  <span
                    className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-mono tracking-wider ${
                      isExecuting
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        : log.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
                <p className="text-[11px] text-white/90 mt-0.5 font-sans truncate">
                  {getToolDescription(log.name, log.args)}
                </p>
                {isExecuting && (
                  <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-cyan-400/60"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      style={{ width: "60%" }}
                    />
                  </div>
                )}
                {log.result && !isExecuting && (
                  <p className="text-[9px] text-gray-500 font-mono mt-0.5 truncate">
                    {log.result}
                  </p>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={() => onRemove(log.id)}
                className="text-gray-500 hover:text-white/80 transition-colors p-1 shrink-0 cursor-pointer text-xs font-mono select-none opacity-50 hover:opacity-100"
              >
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
