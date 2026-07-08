/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Sparkles, Music, MessageSquare } from "lucide-react";
import { CompanionConfig, CompanionId, SessionState, ChatMessage } from "./types";
import { useAudioStreamer } from "./hooks/useAudioStreamer";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { AmbientCore } from "./components/AmbientCore";
import { MindPanel } from "./components/MindPanel";
import { VitalsPanel } from "./components/VitalsPanel";
import { NeonInput } from "./components/NeonInput";
import { AssistantStatus } from "./components/AssistantStatus";
import { MicButton } from "./components/MicButton";
import { ToolExecutionToast, ToolLog } from "./components/ToolExecutionToast";
import { ScreenCaptureDisplay, ScreenCapture } from "./components/ScreenCaptureDisplay";
import { WindowUnderstanding } from "./components/WindowUnderstanding";
import { useMusicSynth } from "./hooks/useMusicSynth";
import { MusicPlayer } from "./components/MusicPlayer";
import { ChatPanel } from "./components/ChatPanel";
import { useDesktop } from "./hooks/useDesktop";
import { useWakeWord } from "./hooks/useWakeWord";
import { SettingsPanel } from "./components/SettingsPanel";
import { useSettings } from "./context/SettingsContext";
import { TitleBar } from "./components/TitleBar";
import { PinLock } from "./components/PinLock";
import { UpdateNotification } from "./components/UpdateNotification";

// Definition of the two high-end AI companions
const COMPANIONS: CompanionConfig[] = [
  {
    id: "mia",
    name: "Mia",
    gender: "female",
    voiceName: "Glow",
    avatarColor: "#ec4899", // Fuchsia / Pink
    glowGradients: ["rgba(236, 72, 153, 0.25)", "rgba(168, 85, 247, 0.1)"],
    tagline: "Empathetic & Playful",
    description: "Young, expressive, and emotionally intelligent. Mia loves sharing subtle humor, gentle teasing, and keeping conversations warm and friendly.",
    systemInstruction: "", // Passed on server
  },
  {
    id: "james",
    name: "James",
    gender: "male",
    voiceName: "Puck",
    avatarColor: "#06b6d4", // Cyan
    glowGradients: ["rgba(6, 182, 212, 0.25)", "rgba(59, 130, 246, 0.1)"],
    tagline: "Calm & Dependable",
    description: "Relaxed, confident, and highly intelligent. James feels like a dependable, smart friend you can speak with about absolutely anything.",
    systemInstruction: "", // Passed on server
  }
];

export default function App() {
  const [selectedCompanionId, setSelectedCompanionId] = useState<CompanionId>("mia");
  const [sessionState, setSessionState] = useState<SessionState>("disconnected");
  const [micVolume, setMicVolume] = useState<number>(0);
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMusicPlayerOpen, setIsMusicPlayerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // ── Screen capture display ─────────────────────────────────────
  const [screenCaptures, setScreenCaptures] = useState<ScreenCapture[]>([]);
  const capIdRef = useRef(0);

  // ── Window understanding ────────────────────────────────────────
  const [windowInfo, setWindowInfo] = useState<any>(null);
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  const altPressedRef = useRef<number>(0); // track double-alt

  // ── Update state ────────────────────────────────────────────────
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateCheckState, setUpdateCheckState] = useState<"idle" | "checking" | "done">("idle");
  const [lastUpdateCheck, setLastUpdateCheck] = useState<string | null>(null);

  // ── PIN lock state ──────────────────────────────────────────────
  const [isLocked, setIsLocked] = useState(true);
  const [pinSetupMode, setPinSetupMode] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const activeCompanion = COMPANIONS.find((c) => c.id === selectedCompanionId) || COMPANIONS[0];

  // Initialize playback manager hook
  const { playChunk, interrupt, getAnalyser } = useAudioPlayer();

  // Desktop service connection (auto-connects on mount)
  const { connectionState: desktopState, isAvailable: desktopAvailable, callTool, lastEvent } = useDesktop();

  // Settings (persisted to localStorage)
  const { settings, updateSetting } = useSettings();

  // Initialize companion vocal synthesis music hook
  const {
    currentSong,
    isPlaying: isSongPlaying,
    currentTime,
    playSong: startSong,
    stopSong: endSong,
  } = useMusicSynth();

  // Initialize microphone capture hook
  const { error: streamerError } = useAudioStreamer({
    socket: socketRef.current,
    isActive: (sessionState === "listening" || sessionState === "speaking" || sessionState === "thinking" || sessionState === "interrupted") && !isSongPlaying,
    onVolumeUpdate: setMicVolume,
    microphoneId: settings.microphoneId,
  });

  // Handle any microphone/streaming errors
  useEffect(() => {
    if (streamerError) {
      setSessionState("error");
      setConnectionError(streamerError);
    }
  }, [streamerError]);

  // ── Sound effects ───────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSoundEffect = useCallback((type: "connect" | "disconnect" | "notification") => {
    if (!settings.soundEffectsEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "connect") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.08);
        osc.frequency.setValueAtTime(784, now + 0.16);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === "disconnect") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(330, now + 0.1);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "notification") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1108, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch { /* Audio not available */ }
  }, [settings.soundEffectsEnabled]);

  // ── Update checking ─────────────────────────────────────────────
  // Check for updates on app start and periodically
  const checkForUpdates = useCallback(async () => {
    setUpdateCheckState("checking");
    try {
      const response = await fetch("/api/check-update");
      const info = await response.json();
      // If API returned an error, surface it
      if (info.error) {
        setUpdateInfo({ ...info, updateAvailable: false, checkFailed: true });
      } else {
        setUpdateInfo(info);
      }
      setLastUpdateCheck(new Date().toLocaleTimeString());
      setUpdateCheckState("done");
      return info;
    } catch {
      try {
        if (window.electronAPI?.checkForUpdate) {
          const info = await window.electronAPI.checkForUpdate();
          if (info.error) {
            setUpdateInfo({ ...info, updateAvailable: false, checkFailed: true });
          } else {
            setUpdateInfo(info);
          }
          setLastUpdateCheck(new Date().toLocaleTimeString());
          setUpdateCheckState("done");
          return info;
        }
      } catch {
        // Both methods failed
      }
      // Both methods failed — show error state
      setUpdateInfo({
        updateAvailable: false,
        checkFailed: true,
        error: "Could not reach update server",
      });
      setUpdateCheckState("done");
    }
  }, []);

  useEffect(() => {
    if (!settings.autoUpdateCheck) return;
    // Wait for everything to settle, then check for updates
    const timer = setTimeout(() => checkForUpdates(), 8000);
    return () => clearTimeout(timer);
  }, [checkForUpdates, settings.autoUpdateCheck]);

  // Notify on update found
  useEffect(() => {
    if (updateInfo?.updateAvailable && !updateDismissed) {
      playSoundEffect("notification");
    }
  }, [updateInfo, updateDismissed, playSoundEffect]);

  // ── PIN lock ────────────────────────────────────────────────────
  // On mount, check if PIN is set and show lock
  useEffect(() => {
    if (settings.pinLockEnabled && settings.pinHash) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [settings.pinLockEnabled, settings.pinHash]);

  // Activity tracker for auto-lock
  const trackActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Track user activity
  useEffect(() => {
    const handler = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("mousedown", handler);
    window.addEventListener("keydown", handler);
    window.addEventListener("touchstart", handler);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, []);

  // Auto-lock timer
  useEffect(() => {
    if (!settings.pinLockEnabled || !settings.pinHash || settings.autoLockMinutes <= 0) {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      return;
    }

    const ms = settings.autoLockMinutes * 60 * 1000;
    lockTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= ms) {
        setIsLocked(true);
      }
    }, 30_000); // Check every 30s

    return () => {
      if (lockTimerRef.current) {
        clearInterval(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, [settings.pinLockEnabled, settings.pinHash, settings.autoLockMinutes]);

  // Connect or disconnect the WebSocket live session
  const toggleConnection = () => {
    if (sessionState !== "disconnected" && sessionState !== "error") {
      // Disconnect
      disconnectSession();
    } else {
      // Connect
      connectSession();
    }
  };

  const disconnectSession = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    interrupt();
    endSong(); // Terminate custom singing track
    setSessionState("disconnected");
    setMicVolume(0);
    playSoundEffect("disconnect");
  };

  const connectSession = (companionId?: CompanionId) => {
    const activeId = companionId || selectedCompanionId;
    try {
      setConnectionError(null);
      setSessionState("connecting");

      // Auto-detect secure/insecure websocket protocol based on page
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/live`;

      console.log(`Establishing neural link at ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket client link established. Starting AI session...");
        ws.send(JSON.stringify({ type: "start", companion: activeId }));
        if (pendingMessageRef.current) {
          console.log("Sending pending message:", pendingMessageRef.current);
          ws.send(JSON.stringify({ type: "text", text: pendingMessageRef.current }));
          pendingMessageRef.current = null;
        }
        playSoundEffect("connect");
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "status") {
            setSessionState(msg.status);
            if (msg.status === "error") {
              setConnectionError(msg.message || "An unexpected error occurred.");
            }
          } else if (msg.type === "audio") {
            playChunk(msg.data);
          } else if (msg.type === "interrupted") {
            // Instant stop on user speaking/interrupt event
            interrupt();
            setSessionState("interrupted");
          } else if (msg.type === "transcript") {
            handleTranscript(msg.role, msg.text);
          } else if (msg.type === "tool_call") {
            handleBrowserToolExecution(msg.id, msg.name, msg.args);
          }
        } catch (err) {
          console.error("Error processing websocket message:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket channel closed");
        disconnectSession();
      };

      ws.onerror = (err) => {
        console.error("WebSocket channel error:", err);
        setSessionState("error");
        setConnectionError("Failed to reach voice assistant backend server.");
      };
    } catch (err: any) {
      console.error("Failed to connect websocket:", err);
      setSessionState("error");
      setConnectionError(err.message || "Websocket connection failed.");
    }
  };

  // -- Wake word detection (say "Mia" or "James" to start hands-free) --
  const connectSessionRef = useRef(connectSession);
  connectSessionRef.current = connectSession;
  const wakeWordEnabled = settings.wakeWordEnabled && (sessionState === "disconnected" || sessionState === "error");
  const handleWakeWord = useCallback((companion: "mia" | "james") => {
    setSelectedCompanionId(companion);
    // Delay slightly to let React state settle before the WebSocket dance
    setTimeout(() => connectSessionRef.current(companion), 150);
  }, []);
  const { state: wakeWordState, restart: restartWakeWord } = useWakeWord({
    onDetected: handleWakeWord,
    enabled: wakeWordEnabled,
  });
  // Show wake word indicator whenever wake word is enabled (any state)
  const showWakeWord = settings.wakeWordEnabled;

  // -- Desktop-based wake word fallback (Electron: Windows Speech API) --
  // When the desktop service detects "Mia" or "James" in the audio stream, it
  // sends a WS event. We intercept it here as a fallback if the browser's Web
  // Speech API is unavailable or unreliable.
  const handleWakeWordRef = useRef(handleWakeWord);
  handleWakeWordRef.current = handleWakeWord;
  useEffect(() => {
    if (!lastEvent || !settings.wakeWordEnabled) return;
    if (lastEvent.type === "wakeword" && lastEvent.status === "detected" && lastEvent.companion) {
      const companion = lastEvent.companion as "mia" | "james";
      if (sessionState === "disconnected" || sessionState === "error") {
        console.log(`[app] Desktop wake word detected: "${companion}"`);
        handleWakeWordRef.current(companion);
      }
    }
  }, [lastEvent, settings.wakeWordEnabled, sessionState]);

  // ── Continuous listening ─────────────────────────────────────────
  // When enabled, keep the session alive so the mic stays hot.
  // The wake word reactivates the session automatically.
  useEffect(() => {
    if (settings.continuousListening && sessionState === "disconnected") {
      // Auto-reconnect if disconnected in continuous listening mode
      const timer = setTimeout(() => connectSessionRef.current(), 2000);
      return () => clearTimeout(timer);
    }
  }, [settings.continuousListening, sessionState]);

  // ── Keyboard shortcuts ───────────────────────────────────────────
  const toggleConnectionRef = useRef(toggleConnection);
  toggleConnectionRef.current = toggleConnection;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Space — toggle connection
      if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        toggleConnectionRef.current();
        return;
      }

      // Double Alt — toggle settings
      if (e.key === "Alt" && !e.ctrlKey && !e.metaKey) {
        const now = Date.now();
        if (now - altPressedRef.current < 400) {
          // Double alt detected!
          e.preventDefault();
          setIsSettingsOpen((o) => !o);
          altPressedRef.current = 0;
          return;
        }
        altPressedRef.current = now;
      }

      // Escape — close panels
      if (e.key === "Escape") {
        if (isMusicPlayerOpen) setIsMusicPlayerOpen(false);
        else if (isChatPanelOpen) setIsChatPanelOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMusicPlayerOpen, isChatPanelOpen, isSettingsOpen]);

  // Accumulate and handle user/companion live transcripts
  const handleTranscript = (role: "user" | "companion", text: string) => {
    setChatMessages((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: `${role}-${Date.now()}`,
            role,
            text,
            timestamp: new Date(),
          },
        ];
      }

      const lastMsg = prev[prev.length - 1];
      if (lastMsg.role === role) {
        const updatedMsg = {
          ...lastMsg,
          text: lastMsg.text.endsWith(" ") || text.startsWith(" ")
            ? lastMsg.text + text
            : lastMsg.text + " " + text,
        };
        return [...prev.slice(0, -1), updatedMsg];
      } else {
        return [
          ...prev,
          {
            id: `${role}-${Date.now()}`,
            role,
            text,
            timestamp: new Date(),
          },
        ];
      }
    });
  };

  // Send a typed text message
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    // Add user message to history immediately
    setChatMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: text.trim(),
        timestamp: new Date(),
      },
    ]);

    // Send via WebSocket or set as pending message if connecting/reconnecting
    if (sessionState !== "disconnected" && sessionState !== "error") {
      interrupt(); // Stop active speaking instantly
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "text", text: text.trim() }));
      } else {
        pendingMessageRef.current = text.trim();
      }
    } else {
      // Auto-connect and then send
      pendingMessageRef.current = text.trim();
      connectSession();
    }
  };

  // Switch companion cleanly
  const handleCompanionChange = (id: CompanionId) => {
    setSelectedCompanionId(id);
    endSong(); // Stop active singing when switching companions
    if (sessionState !== "disconnected" && sessionState !== "error") {
      // If currently active, close and start a new connection with selected companion instantly
      disconnectSession();
      // Delay connection slightly to allow hooks to release hardware resources cleanly
      setTimeout(() => {
        connectSession(id);
      }, 350);
    }
  };

  // Browser tool execution pipeline
  const handleBrowserToolExecution = async (id: string, name: string, args: any) => {
    // Stop AI speech immediately when a tool is being called
    interrupt();

    // 1. Create temporary toast log
    const logId = `${name}-${Date.now()}`;
    const newLog: ToolLog = {
      id: logId,
      name,
      args,
      status: "executing",
      timestamp: new Date(),
    };
    setToolLogs((prev) => [newLog, ...prev]);

    // Desktop tool routing — tools handled by the local Desktop Service.
    const DESKTOP_TOOLS = new Set([
      "openFile", "openFolder", "revealInExplorer",
      "searchFiles", "launchApp", "openUrl",
      "openVideo", "openPdf", "openImage",
      "readClipboard", "writeClipboard",
      "getCurrentWorkingDirectory", "listDrives", "listCommonFolders",
      "captureScreen", "captureActiveWindow",
      // PC Control
      "moveMouse", "clickMouse", "scrollMouse", "dragMouse",
      "typeText", "pressKey", "pressHotkey",
      // Media Control
      "mediaPlayPause", "mediaNextTrack", "mediaPrevTrack", "mediaStop",
      "mediaVolumeSet", "mediaVolumeUp", "mediaVolumeDown", "mediaMute",
      // YouTube
      "youtubeSearch", "youtubePlay", "youtubeGetInfo",
    ]);
    if (DESKTOP_TOOLS.has(name)) {
      if (!settings.desktopToolsEnabled) {
        setToolLogs((prev) =>
          prev.map((l) =>
            l.id === logId
              ? { ...l, status: "failed", result: "Desktop tools disabled in settings" }
              : l
          )
        );
        // Send back a "disabled" response so the AI knows
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: "tool_result",
              id,
              name,
              output: { error: "Desktop automation is disabled. Enable it in Settings to use this tool." },
            })
          );
        }
        return;
      }
      const result = await callTool(name, args);
      const ok = result?.ok === true;
      setToolLogs((prev) =>
        prev.map((l) =>
          l.id === logId
            ? { ...l, status: ok ? "completed" : "failed", result: result?.summary || (ok ? "Done" : "Failed") }
            : l
        )
      );
      // If the tool returned media (e.g. screenshot), inject it into the AI session
      // AND show it in the ScreenCaptureDisplay.
      if (result?.media) {
        const cap: ScreenCapture = {
          id: `cap-${capIdRef.current++}`,
          data: result.media.base64,
          mimeType: result.media.mimeType,
          description: result.media.description || `Captured via ${name}`,
          timestamp: new Date(),
        };
        setScreenCaptures((prev) => [cap, ...prev.slice(0, 2)]);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: "inject_image",
              data: result.media.base64,
              mimeType: result.media.mimeType,
            })
          );
        }
      }

      // Track window context when capture tools are used
      if (name === "captureActiveWindow" || name === "captureScreen") {
        setWindowInfo({
          title: result?.output?.windowTitle || "Desktop",
          process: result?.output?.process || "explorer.exe",
          appName: result?.output?.appName || "Windows Explorer",
        });
        if (result?.output?.clipboard) {
          setClipboardContent(result.output.clipboard);
        }
        if (result?.output?.cursorPos) {
          setCursorPosition(result.output.cursorPos);
        }
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "tool_result",
            id,
            name,
            output: result?.output || { error: "No result" },
          })
        );
      }
      return;
    }

    let output: any = {};
    try {
      if (name === "openWebsite") {
        const url = args.url;
        window.open(url, "_blank");
        output = { status: "success", message: `Successfully opened tab: ${url}` };

        // Update log
        setToolLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, status: "completed", result: `Opened ${url}` } : l))
        );
      } else if (name === "searchGoogle") {
        const query = args.query;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
        output = { status: "success", message: `Successfully performed search for: ${query}` };

        // Update log
        setToolLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, status: "completed", result: `Searched "${query}"` } : l))
        );
      } else if (name === "getCurrentTime") {
        const localTime = new Date().toLocaleString();
        output = { time: localTime, zone: Intl.DateTimeFormat().resolvedOptions().timeZone };

        // Update log
        setToolLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, status: "completed", result: localTime } : l))
        );
      } else if (name === "copyToClipboard") {
        const text = args.text;

        // Bulletproof clipboard copy helper
        let success = false;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            success = true;
          } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            success = document.execCommand("copy");
            document.body.removeChild(textArea);
          }
        } catch (e) {
          console.warn("Fallback clipboard error:", e);
        }

        if (success) {
          output = { status: "success", message: "Text copied to user clipboard" };
          setToolLogs((prev) =>
            prev.map((l) => (l.id === logId ? { ...l, status: "completed", result: `Copied text` } : l))
          );
        } else {
          output = { status: "failed", error: "Permission denied or browser context unsupported" };
          setToolLogs((prev) =>
            prev.map((l) => (l.id === logId ? { ...l, status: "failed", result: `Failed clipboard permission` } : l))
          );
        }
      } else if (name === "playSong") {
        const title = args.title || "Aura Rising";
        let songId = "aura-rising";
        if (title.toLowerCase().includes("summer")) {
          songId = "summer-breeze";
        } else if (title.toLowerCase().includes("lunar") || title.toLowerCase().includes("lullaby")) {
          songId = "lunar-lullaby";
        }

        interrupt();
        startSong(songId);
        setIsMusicPlayerOpen(true);

        output = { status: "success", message: `Successfully started singing song: ${title}` };

        setToolLogs((prev) =>
          prev.map((l) => (l.id === logId ? { ...l, status: "completed", result: `Singing "${title}"` } : l))
        );
      } else {
        throw new Error(`Unknown tool name: ${name}`);
      }
    } catch (err: any) {
      console.error(`Error running tool ${name}:`, err);
      output = { error: err.message || "Failed execution" };
      setToolLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: "failed", result: err.message || "Error" } : l))
      );
    }

    // 2. Return tool execution results to the live session
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "tool_result",
        id,
        name,
        output
      }));
    }
  };

  const removeToolLog = (id: string) => {
    setToolLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const removeScreenCapture = (id: string) => {
    setScreenCaptures((prev) => prev.filter((c) => c.id !== id));
  };

  const isActive = sessionState !== "disconnected" && sessionState !== "error";

  return (
    <div className="min-h-screen w-full bg-[#0A0A0C] text-white flex flex-col overflow-hidden selection:bg-[#7C5CFF]/30 select-none relative">

      {/* ── Custom Title Bar (Electron frameless) ── */}
      <TitleBar />

      {/* ── Ambient Background Layers ── */}

      {/* Starfield */}
      <div className="starfield" aria-hidden="true">
        <div className="starfield-layer" />
        <div className="starfield-layer" />
      </div>

      {/* Aurora Gradient Blobs */}
      <div className="aurora-gradient" aria-hidden="true">
        <div className="aurora-blob" />
        <div className="aurora-blob" />
      </div>

      {/* Scanline overlay + vignette */}
      <div className="scanline-overlay" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      {/* HUD Grid */}
      <div className="hud-grid" aria-hidden="true" />

      {/* Header glow divider */}
      <div className="relative z-20 w-full h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* ── Top Bar ── */}
      <header className="relative z-20 w-full flex items-center justify-between px-4 py-2">
        {/* Left: Logo + identity */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#7C5CFF]/40 via-[#6EE7FF]/20 to-[#ec4899]/30 blur-sm"
            />
            <div className="relative p-2 bg-[#0A0A0C]/80 rounded-xl border border-white/[0.10] backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-[#6EE7FF]" />
            </div>
          </div>
          <div>
            <h1 className="font-display text-sm font-bold tracking-wider text-white uppercase leading-none">
              <span className="text-shimmer">Aura</span>
            </h1>
            <span className="text-[8px] font-mono text-gray-500 uppercase tracking-[0.15em] mt-0.5 block">
              Neural Link
            </span>
          </div>
          {/* Desktop service status badge */}
          <span className={`inline-flex items-center gap-1 ml-2 text-[7px] font-mono uppercase tracking-widest ${
            desktopAvailable ? "text-emerald-500" : desktopState === "error" ? "text-rose-500" : "text-gray-600"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              desktopAvailable ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse" : "bg-gray-600"
            }`} />
            DSK{desktopState === "connected" ? "●" : "○"}
          </span>
        </div>

        {/* Center: Companion pill selector */}
        <div className="flex bg-white/[0.03] border border-white/[0.06] backdrop-blur-md rounded-full p-0.5 gap-0.5 shadow-lg">
          {COMPANIONS.map((c) => {
            const isSelected = c.id === selectedCompanionId;
            const selectedColor = c.avatarColor;
            return (
              <button
                key={c.id}
                onClick={() => handleCompanionChange(c.id)}
                disabled={sessionState === "connecting"}
                className={`relative px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-full transition-all duration-300 select-none outline-none ${
                  isSelected
                    ? "text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="header-companion-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: selectedColor, opacity: 0.85 }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-[1]">{c.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMusicPlayerOpen(!isMusicPlayerOpen)}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
              isMusicPlayerOpen
                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-lg shadow-cyan-500/10"
                : "bg-white/[0.03] text-gray-400 hover:text-white border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
            }`}
            title="Toggle Karaoke / Music Player"
          >
            <Music className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsChatPanelOpen(!isChatPanelOpen)}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
              isChatPanelOpen
                ? "bg-[#7C5CFF]/15 text-[#A288FF] border-[#7C5CFF]/30 shadow-lg shadow-[#7C5CFF]/10"
                : "bg-white/[0.03] text-gray-400 hover:text-white border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
            }`}
            title="Toggle Text Mode / Chat Log"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
              isSettingsOpen
                ? "bg-gray-500/15 text-gray-300 border-gray-500/30 shadow-lg shadow-gray-500/10"
                : "bg-white/[0.03] text-gray-400 hover:text-white border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]"
            }`}
            title="Toggle Settings Panel"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── Main HUD Area: three-column layout ── */}
      <div className="relative z-10 flex-1 flex min-h-0 px-3 gap-3">

        {/* ── Left Panel: The Mind (collapsible) ── */}
        <motion.div
          animate={{ width: leftPanelOpen ? 210 : 0, opacity: leftPanelOpen ? 1 : 0, marginRight: leftPanelOpen ? 0 : -12 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className={`hidden md:flex group shrink-0 rounded-xl overflow-hidden relative ${
            sessionState === "speaking"
              ? "glass-panel ring-1 ring-cyan-400/20 shadow-[0_0_30px_rgba(34,211,238,0.06)]"
              : sessionState === "thinking" || sessionState === "connecting"
              ? "glass-panel ring-1 ring-[#7C5CFF]/20 shadow-[0_0_30px_rgba(124,92,255,0.06)]"
              : "glass-panel"
          }`}>
          {/* Collapse toggle — visible on panel hover */}
          <button
            onClick={() => setLeftPanelOpen(false)}
            className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-4 h-8 rounded-r-sm bg-white/[0.04] hover:bg-white/[0.12] border border-white/[0.08] border-l-0 flex items-center justify-center cursor-pointer transition-all duration-200 opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/70"
          >
            <span className="text-[8px] font-mono">&lsaquo;</span>
          </button>
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400/20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400/20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-400/20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-400/20 pointer-events-none" />
          <div className="min-w-[210px] h-full">
            <MindPanel />
          </div>
        </motion.div>

        {/* Left panel re-open button (when collapsed) */}
        <AnimatePresence>
          {!leftPanelOpen && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => setLeftPanelOpen(true)}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-5 h-10 items-center justify-center rounded-r-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all text-white/30 hover:text-white/60"
            >
              <span className="text-[9px] font-mono">&rsaquo;</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Center: Ambient Core (now the waveform!) + controls + input ── */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 relative overflow-y-auto py-1">

          {/* Ambient Core — now audio-reactive */}
          <div className="w-full max-w-[300px] aspect-square relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <AmbientCore
                state={isSongPlaying ? "speaking" : sessionState}
                companionColor={activeCompanion.avatarColor}
                analyser={getAnalyser()}
                micVolume={micVolume}
              />
            </div>
          </div>

          {/* Mic + status */}
          <div className="flex flex-col items-center gap-1 -mt-2">
            <MicButton
              isActive={isActive}
              onClick={toggleConnection}
              disabled={sessionState === "connecting"}
              color={activeCompanion.avatarColor}
            />
            <AssistantStatus
              state={sessionState}
              companionName={activeCompanion.name}
            />
          </div>

          {/* Neon Input */}
          <div className="w-full max-w-sm mt-1">
            <NeonInput
              onSend={handleSendMessage}
              disabled={false}
              placeholder="> type a message..."
            />
          </div>

          {/* Wake word indicator */}
          {showWakeWord && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 mt-1.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
            >
              {wakeWordState === "listening" && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C5CFF] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C5CFF]" />
                </span>
              )}
              {wakeWordState === "detected" && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
              )}
              {wakeWordState === "unsupported" && (
                <span className="inline-flex rounded-full h-2 w-2 bg-rose-500" />
              )}
              {wakeWordState === "idle" && (
                <span className="inline-flex rounded-full h-2 w-2 bg-gray-500/50" />
              )}
              <span className="text-[10px] font-mono tracking-wider text-gray-400 uppercase whitespace-nowrap">
                {wakeWordState === "unsupported" ? (
                  <span className="text-rose-400">Wake word unavailable</span>
                ) : wakeWordState === "detected" ? (
                  <span className="text-emerald-300">Activating...</span>
                ) : wakeWordState === "listening" ? (
                  <span>Say &ldquo;<span className="text-gray-200">Mia</span>&rdquo; or &ldquo;<span className="text-gray-200">James</span>&rdquo;</span>
                ) : (
                  <span className="text-gray-500">Initializing...</span>
                )}
              </span>
              {(wakeWordState === "unsupported" || wakeWordState === "idle") && (
                <button
                  onClick={restartWakeWord}
                  className="ml-1 text-[8px] font-mono text-gray-500 hover:text-white bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06] transition-colors cursor-pointer"
                >
                  Retry
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* ── Right Panel: The Vitals (collapsible) ── */}
        <motion.div
          animate={{ width: rightPanelOpen ? 210 : 0, opacity: rightPanelOpen ? 1 : 0, marginLeft: rightPanelOpen ? 0 : -12 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className={`hidden md:flex group shrink-0 rounded-xl overflow-hidden relative ${
            sessionState === "speaking"
              ? "glass-panel ring-1 ring-cyan-400/20 shadow-[0_0_30px_rgba(34,211,238,0.06)]"
              : sessionState === "thinking" || sessionState === "connecting"
              ? "glass-panel ring-1 ring-[#7C5CFF]/20 shadow-[0_0_30px_rgba(124,92,255,0.06)]"
              : "glass-panel"
          }`}>
          {/* Collapse toggle — visible on panel hover */}
          <button
            onClick={() => setRightPanelOpen(false)}
            className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-4 h-8 rounded-l-sm bg-white/[0.04] hover:bg-white/[0.12] border border-white/[0.08] border-r-0 flex items-center justify-center cursor-pointer transition-all duration-200 opacity-0 group-hover:opacity-100 text-white/40 hover:text-white/70"
          >
            <span className="text-[8px] font-mono">&rsaquo;</span>
          </button>
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-amber-400/20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-amber-400/20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-amber-400/20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-amber-400/20 pointer-events-none" />
          <div className="min-w-[210px] h-full">
            <VitalsPanel />
          </div>
        </motion.div>

        {/* Right panel re-open button (when collapsed) */}
        <AnimatePresence>
          {!rightPanelOpen && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => setRightPanelOpen(true)}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-5 h-10 items-center justify-center rounded-l-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] cursor-pointer transition-all text-white/30 hover:text-white/60"
            >
              <span className="text-[9px] font-mono">&lsaquo;</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Overlays ── */}

      {/* Update notification */}
      <UpdateNotification
        updateInfo={updateInfo}
        onDismiss={() => setUpdateDismissed(true)}
        onCheckNow={() => checkForUpdates()}
        checkState={updateCheckState}
        lastCheck={lastUpdateCheck}
      />

      {/* Floating Action Notifications */}
      <ToolExecutionToast logs={toolLogs} onRemove={removeToolLog} />

      {/* Screen Capture Display */}
      <ScreenCaptureDisplay captures={screenCaptures} onRemove={removeScreenCapture} />

      {/* Window Understanding (context panel) */}
      {settings.showContextPanel && (
        <WindowUnderstanding
          windowInfo={windowInfo}
          clipboard={clipboardContent}
          cursorPos={cursorPosition}
          onDismiss={() => {
            // Just clear, next capture will re-show
          }}
        />
      )}

      {/* Music Player */}
      <AnimatePresence>
        {isMusicPlayerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4"
          >
            <MusicPlayer
              currentSong={currentSong}
              isPlaying={isSongPlaying}
              currentTime={currentTime}
              companionId={selectedCompanionId}
              onPlaySong={(id) => {
                interrupt();
                startSong(id);
              }}
              onStopSong={() => {
                endSong();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat / Text Mode sliding panel */}
      <AnimatePresence>
        {isChatPanelOpen && (
          <ChatPanel
            isOpen={isChatPanelOpen}
            onClose={() => setIsChatPanelOpen(false)}
            messages={chatMessages}
            companionName={activeCompanion.name}
            companionColor={activeCompanion.avatarColor}
            sessionState={sessionState}
          />
        )}
      </AnimatePresence>

      {/* Settings sliding panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsPanel
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            desktopAvailable={desktopAvailable}
            desktopState={desktopState}
            onSetupPin={() => setPinSetupMode(true)}
            onCheckUpdate={() => checkForUpdates()}
          />
        )}
      </AnimatePresence>

      {/* PIN lock screen */}
      {settings.pinHash && (
        <PinLock
          locked={isLocked}
          pinHash={settings.pinHash}
          onUnlock={() => {
            setIsLocked(false);
            lastActivityRef.current = Date.now();
          }}
          setupMode={pinSetupMode}
          onSetPin={(hash) => {
            updateSetting("pinHash", hash);
            updateSetting("pinLockEnabled", true);
            setPinSetupMode(false);
            setIsLocked(false);
          }}
          onCancelSetup={() => setPinSetupMode(false)}
        />
      )}

      {/* ── Viewport corner brackets (HUD frame) ── */}
      <div className="fixed inset-0 pointer-events-none z-40" aria-hidden="true">
        {/* Top-left L */}
        <div className="absolute top-[6px] left-[6px] w-6 h-[1px] bg-white/[0.06]" />
        <div className="absolute top-[6px] left-[6px] w-[1px] h-6 bg-white/[0.06]" />
        {/* Top-right ⅃ */}
        <div className="absolute top-[6px] right-[6px] w-6 h-[1px] bg-white/[0.06]" />
        <div className="absolute top-[6px] right-[6px] w-[1px] h-6 bg-white/[0.06]" />
        {/* Bottom-left L */}
        <div className="absolute bottom-[6px] left-[6px] w-6 h-[1px] bg-white/[0.06]" />
        <div className="absolute bottom-[6px] left-[6px] w-[1px] h-6 bg-white/[0.06]" />
        {/* Bottom-right ⅃ */}
        <div className="absolute bottom-[6px] right-[6px] w-6 h-[1px] bg-white/[0.06]" />
        <div className="absolute bottom-[6px] right-[6px] w-[1px] h-6 bg-white/[0.06]" />
      </div>

      {/* Bottom status bar */}
      <div className="status-bar">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 ${
            sessionState === "disconnected" || sessionState === "error"
              ? "text-rose-400"
              : sessionState === "speaking"
              ? "text-emerald-400"
              : sessionState === "listening"
              ? "text-cyan-400"
              : sessionState === "thinking" || sessionState === "connecting"
              ? "text-amber-400"
              : "text-gray-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              sessionState === "disconnected" || sessionState === "error"
                ? "bg-rose-400"
                : sessionState === "speaking"
                ? "bg-emerald-400 animate-pulse"
                : sessionState === "listening"
                ? "bg-cyan-400 animate-pulse"
                : sessionState === "thinking" || sessionState === "connecting"
                ? "bg-amber-400 animate-pulse"
                : "bg-gray-500"
            }`} />
            {sessionState}
          </span>
          <span className="text-white/10">|</span>
          <span>{activeCompanion.name}</span>
          <span className="text-white/10">|</span>
          <span>{chatMessages.length} msgs</span>
        </div>
        <div className="flex items-center gap-3">
          {desktopAvailable && <span className="text-emerald-500/60">DSK ●</span>}
          <span>v1.2</span>
        </div>
      </div>

    </div>
  );
}
