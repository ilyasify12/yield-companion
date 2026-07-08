/**
 * Desktop Wake Word Detection — uses Windows' built-in Speech Recognition
 * (System.Speech) via PowerShell to listen for "Mia" or "James" and notify
 * the frontend through the WebSocket event channel.
 *
 * This bypasses Chromium's flaky Web Speech API in Electron and works even
 * if the Electron build stripped out speechrecognition.dll.
 *
 * The recognizer runs as a long-lived PowerShell process. The desktop service
 * starts/stops it on demand and relays detected words to the frontend.
 */

import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

let wakeWordProcess: ChildProcess | null = null;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let broadcastFn: ((msg: any) => void) | null = null;

/**
 * The PowerShell script that runs the wake-word listener.
 * It uses System.Speech.Recognition to create a grammar with "Mia" and "James"
 * and continuously listens. When a word is recognized, it prints:
 *   WAKEWORD:<word>
 * to stdout. The wrapper below parses these lines.
 */
function buildWakeWordScript(): string {
  return `
param($StopFile)

Add-Type -AssemblyName System.Speech

$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$choices = New-Object System.Speech.Recognition.Choices
$choices.Add("Mia")
$choices.Add("James")
$choices.Add("mia")
$choices.Add("james")

$grammarBuilder = New-Object System.Speech.Recognition.GrammarBuilder
$grammarBuilder.Append($choices)
$grammar = New-Object System.Speech.Recognition.Grammar($grammarBuilder)

$recognizer.LoadGrammar($grammar)

# Register the speech recognized event
Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognized -Action {
  $word = $event.SourceEventArgs.Result.Text
  Write-Host "WAKEWORD:$word"
} | Out-Null

# Start listening
$recognizer.SetInputToDefaultAudioDevice()
$recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

Write-Host "WAKEWORD:READY"

# Wait until stop file is deleted or 30s timeout, then poll
while (Test-Path $StopFile) {
  Start-Sleep -Milliseconds 500
}

$recognizer.Dispose()
Write-Host "WAKEWORD:STOPPED"
`.trim();
}

/**
 * Start the wake-word recognizer as a detached PowerShell process.
 * Detected words are relayed via the broadcast callback.
 *
 * @param onDetected  Called with "mia" or "james" when the wake word is heard.
 * @param broadcast   Function to send a WS message to the frontend.
 */
export function startWakeWordDetection(
  onDetected: (companion: "mia" | "james") => void,
  broadcast: (msg: any) => void
): void {
  stopWakeWordDetection();

  broadcastFn = broadcast;

  // Create a temp stop-file so we can kill the listener gracefully
  const stopFile = path.join(
    fs.mkdtempSync("aura-ww-"),
    "stop.signal"
  );
  fs.writeFileSync(stopFile, "");

  const script = buildWakeWordScript();

  // Write the script to a temp file (PowerShell struggles with long inline scripts)
  const scriptFile = stopFile.replace("stop.signal", "listener.ps1");
  fs.writeFileSync(scriptFile, script, "utf-8");

  console.log("[wakeword] Starting PowerShell speech recognizer...");

  wakeWordProcess = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", scriptFile,
      "-StopFile", stopFile,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );

  wakeWordProcess.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString("utf-8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      console.log(`[wakeword] ${line}`);

      if (line === "WAKEWORD:READY") {
        console.log("[wakeword] Recognizer ready");
        broadcast({ type: "wakeword", status: "listening" });
        continue;
      }

      if (line === "WAKEWORD:STOPPED") {
        console.log("[wakeword] Recognizer stopped");
        broadcast({ type: "wakeword", status: "stopped" });
        continue;
      }

      const match = line.match(/^WAKEWORD:(Mia|James|mia|james)$/);
      if (match) {
        const word = match[1].toLowerCase() as "mia" | "james";
        console.log(`[wakeword] DETECTED: "${word}"`);
        broadcast({ type: "wakeword", status: "detected", companion: word });
        onDetected(word);
      }
    }
  });

  wakeWordProcess.stderr?.on("data", (data: Buffer) => {
    console.error(`[wakeword:err] ${data.toString().trim()}`);
  });

  wakeWordProcess.on("exit", (code) => {
    console.log(`[wakeword] Process exited (code=${code})`);
    wakeWordProcess = null;
    // Cleanup temp files
    try { fs.unlinkSync(stopFile); } catch { /* ignore */ }
    try { fs.unlinkSync(scriptFile); } catch { /* ignore */ }
    try { fs.rmdirSync(path.dirname(stopFile)); } catch { /* ignore */ }
  });

  wakeWordProcess.on("error", (err) => {
    console.error("[wakeword] Process error:", err);
    wakeWordProcess = null;
  });
}

/** Stop the wake-word recognizer if running. */
export function stopWakeWordDetection(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (wakeWordProcess) {
    console.log("[wakeword] Stopping recognizer...");
    try {
      // On Windows, taskkill the process tree
      spawn("taskkill", ["/pid", String(wakeWordProcess.pid), "/f", "/t"], {
        windowsHide: true,
      });
    } catch {
      wakeWordProcess.kill();
    }
    wakeWordProcess = null;
  }
  broadcastFn?.({ type: "wakeword", status: "stopped" });
}
