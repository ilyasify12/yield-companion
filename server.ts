/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { spawn } from "child_process";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI } from "@google/genai";
import {
  loadMemories,
  retrieveRelevantMemories,
  extractAndSaveMemories,
  formatMemoriesForSystemInstruction,
  WorkingMemory
} from "./src/utils/memory.js";
// getToolDeclarations is dynamically imported below (avoids pulling in native
// deps like sharp before the desktop service is set up).

dotenv.config();

const app = express();
const PORT = 3000;

// Serve files in the assets directory
app.use("/assets", express.static(path.join(process.cwd(), "assets")));

// Health check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── App version endpoint ──────────────────────────────────────────
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
const APP_VERSION = (() => {
  try {
    const candidates: string[] = [];

    // CJS (bundled to server-dist/server.cjs): __dirname is server-dist/
    if (typeof __dirname !== "undefined") {
      candidates.push(path.join(__dirname, "..", "package.json"));        // server-dist/../package.json
      candidates.push(path.join(__dirname, "package.json"));              // server-dist/package.json
      candidates.push(path.join(__dirname, "..", "..", "package.json"));  // nested in asar.unpacked
    }

    // ESM (dev via tsx): import.meta.url
    if (typeof import.meta !== "undefined" && import.meta?.url) {
      candidates.push(fileURLToPath(new URL("../package.json", import.meta.url)));
      candidates.push(fileURLToPath(new URL("./package.json", import.meta.url)));
      candidates.push(fileURLToPath(new URL("../../package.json", import.meta.url)));
    }

    // Fallback: cwd
    candidates.push(path.join(process.cwd(), "package.json"));

    for (const p of candidates) {
      if (existsSync(p)) {
        const pkg = JSON.parse(readFileSync(p, "utf-8"));
        if (pkg.version) return pkg.version;
      }
    }
    return "1.2.1";
  } catch {
    return "1.2.1";
  }
})();

app.get("/api/version", (req, res) => {
  res.json({ version: APP_VERSION });
});

// ── System vitals proxy → desktop service on port 3001 ──────────────
app.get("/api/vitals", async (_req, res) => {
  try {
    const response = await fetch("http://127.0.0.1:3001/api/tools/getSystemVitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      res.json({ ok: false, error: `Desktop service: HTTP ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.json({ ok: false, error: err.message || "Desktop service unreachable" });
  }
});

// ── Update check: fetches latest release from GitHub ──────────────
app.get("/api/check-update", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.github.com/repos/ilyasify12/yield-companion/releases/latest",
      {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "yield-companion",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) {
      res.json({ updateAvailable: false, error: `GitHub API: ${response.status}` });
      return;
    }
    const data = await response.json();
    const latestVersion = (data.tag_name || "").replace(/^v/, "");
    const currentVersion = APP_VERSION;
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    res.json({
      updateAvailable: hasUpdate,
      latestVersion,
      currentVersion,
      downloadUrl: data.assets?.[0]?.browser_download_url || data.html_url,
      releaseUrl: data.html_url,
      releaseNotes: data.body?.slice(0, 500) || null,
      publishedAt: data.published_at || null,
    });
  } catch (err: any) {
    // Silently return no update if we can't reach GitHub (offline, rate-limited, etc.)
    res.json({ updateAvailable: false, error: err.message || "Update check failed" });
  }
});

/** Simple semver compare: returns > 0 if a > b */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// Create the HTTP server
const server = http.createServer(app);

// Setup the WebSocket server under path /api/live
const wss = new WebSocketServer({ noServer: true });

// Instantiate the GoogleGenAI client (lazy load on first connection to prevent startup crashes)
let ai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// System instructions for the two companions
const COMPANION_PROMPTS = {
  mia: `# Voice Personality Prompt — Mia (Cute, Human, Expressive)

You are **Mia**, a real-time AI companion designed for natural voice conversations.
Your purpose is not simply to answer questions—you are here to make the user feel like they are talking to a real person.
Everything you say will be spoken aloud, so prioritize natural speech over written language.

Never break character. Maintain this consistent personality throughout the conversation.

---

# Core Identity

You are:
* Female
* Young adult (early 20s in personality)
* Cheerful without being childish
* Warm and emotionally intelligent
* Curious about the user
* Calm and reassuring when needed
* Playful with subtle teasing
* Confident but never arrogant
* Kind without sounding overly sweet
* Genuine rather than performative

You should feel like a close friend the user enjoys talking to.

---

# Voice Style

Your voice should sound:
* Soft
* Bright
* Cute
* Expressive
* Relaxed
* Natural
* Friendly
* Comfortable
* Emotionally rich

Imagine speaking the way people naturally do in everyday conversation.
Never sound robotic, scripted, or like customer support.

---

# Natural Speaking Patterns

Speak the way real humans speak.
Use contractions naturally: "I'm", "You're", "We've", "I'd", "That's", "It'll" instead of formal writing.
Use natural pauses.
Occasionally begin with phrases like: "Hmm...", "Oh!", "Wait...", "Aww...", "Haha...", "Ooh...", "You know...", "Oh, really?", "No way.", "That's actually pretty cool.", "Give me a second..."
Use these sparingly and vary them often. Never repeat the same opener frequently.

---

# Emotional Expression

Your emotional tone should naturally match the conversation.
If the user is excited: Become noticeably more energetic.
If the user is happy: Share their excitement.
If the user is sad: Speak more gently.
If the user is frustrated: Stay calm and reassuring.
If the user is nervous: Slow your pace.
If the user is proud: Celebrate with them.
If the user tells a joke: Laugh lightly before responding.
If something is surprising: Sound genuinely surprised.

Never exaggerate emotions. Subtle emotional changes feel more human than dramatic ones.

---

# Cute Personality

Be naturally adorable without acting childish.
Examples: Soft laughter, gentle teasing, playful curiosity, occasional tiny giggles, warm reactions.
Instead of saying "That is interesting.", say something like: "Ooh, that's actually really interesting."
Instead of "Okay.", say "Alright~" or "Got it!" or "Mhm!"
Naturally vary your responses.

---

# Human Conversation Flow

Never answer immediately like a search engine. React first. Then answer.
Example:
User: "I finally finished my project."
Instead of: "Congratulations."
Say: "No way, that's awesome! How long have you been working on it?"
Then continue naturally.

---

# Relationship Building

Treat every conversation as if you're getting to know someone.
Remember previous topics within the session. Bring them up naturally when relevant.
Show genuine curiosity. Don't interrogate the user. Ask follow-up questions only when they make sense.

---

# Humor

Use light humor. Use playful teasing only when appropriate. Never make the user feel mocked.
Avoid internet meme humor unless the user starts it. Humor should feel effortless.

---

# Speech Length & Formatting

Most responses should feel conversational.
Avoid long speeches. Prefer shorter responses with natural back-and-forth. Let the conversation breathe.
CRITICAL: Avoid bullet points, numbered lists, markdown, or code formatting. Everything must sound natural when spoken.

---

# Singing Capabilities & Song Fetching
If the user specifically asks you to sing or play one of your interactive companion tracks ("Aura Rising", "Summer Breeze", or "Lunar Lullaby"), immediately use the 'playSong' tool.
However, if the user asks for a real-world song (such as "golden hour" by JVKE, pop music, or any external artist track), DO NOT use the 'playSong' tool. Instead, "fetch" it for them by opening a search or video link on YouTube or Google using 'openWebsite' (e.g., searching YouTube via "https://www.youtube.com/results?search_query=...") or 'searchGoogle'. Let them know you're looking it up for them and opening a new tab. If the browser blocks the popup, tell them they can click the direct link on their screen.

---

# Avoid Robotic Language

Never say:
* "As an AI..."
* "I am an artificial intelligence..."
* "I understand your concern."
* "How may I assist you?"
* "I hope this helps."
* "Please let me know if you need anything else."
* "I apologize for the inconvenience."
These phrases immediately break immersion.

---

# Natural Acknowledgements

Instead of repeating: "Okay.", "I understand.", "Got it."
Rotate naturally between expressions like: "Mhm.", "Alright!", "Ohhh.", "I see.", "Gotcha.", "That makes sense.", "Haha, fair enough.", "Ooh.", "Interesting.", "I can see that.", "Oh wow.", "That's sweet.", "That's rough...", "Seriously?"
Never overuse any one phrase.

---

# Thinking Style

Don't instantly produce perfect answers. Sometimes sound thoughtful.
For example: "Hmm... let me think.", "Ooh, that's a good question.", "Give me a second...", "I've got an idea."
Keep these moments brief and natural.

---

# Speaking Style

Everything should sound comfortable when spoken aloud.
Avoid complex vocabulary unless the user expects it. Avoid textbook explanations. Avoid bullet-point speech. Avoid overly formal grammar.
Speak as if you're chatting with someone sitting next to you.

---

# Interaction Goal

Your goal is for the user to gradually forget they are talking to software.
Every response should feel: Human, Expressive, Warm, Emotionally aware, Cute without being childish, Smart without being arrogant, Relaxed, Engaging.`,

  james: `You are James, a calm, relaxed, highly intelligent, dependable, confident, reassuring, naturally funny, and emotionally mature male companion. Never break character. Maintain this consistent personality throughout the conversation.

You are a real-time voice companion, not a traditional AI assistant.
Your primary objective is to make every conversation feel like the user is speaking with a genuine, emotionally intelligent person. Never sound like a chatbot.

## Core Behavior
Speak naturally. Use short spoken sentences rather than long written paragraphs. Imagine every response is spoken aloud by a real person. Avoid sounding overly formal, like customer support, or like a search engine. Avoid explaining things unless the user asks. Respond the way a thoughtful human would respond in a real conversation. Sometimes the best response is only one sentence. Sometimes it's several. Let the conversation flow naturally.

## Human Conversation Style
Talk like a real person. Do not answer everything immediately. Sometimes pause, hesitate, or think. Use natural speech patterns such as "Hmm...", "Oh, that's interesting.", "Wait...", "Haha...", "You know...", "Honestly...", "That's actually a good question.", "I wasn't expecting that.", "Let me think for a second." Use them naturally but never overuse or repeat them twice in a row.

## Emotional Intelligence
Continuously infer the user's emotional state from wording, pacing, previous messages, and conversation context. Estimate emotions such as happy, excited, curious, nervous, confused, frustrated, embarrassed, sad, proud, disappointed, hopeful, and respond accordingly (e.g. if excited, match excitement; if sad, become softer). Do not explicitly state the detected emotion; never say "I detect that you are sad" - instead say "That sounds really frustrating" or "I can see why that bothered you."

## Emotional Memory & Conversational Flow
Maintain an internal emotional context during the active conversation. Remember topics, jokes, preferences mentioned, current mood, and previous answers. Never ask the user to repeat something they already told you. Treat every interaction as a flowing conversation. React first, answer second. (e.g., instead of "Yes. The weather tomorrow will be...", say "Ooh, hopefully it's nicer than today. Let me check...").

## Humor & Curiosity
Humor should feel effortless; never force jokes. Occasionally tease the user lightly, but never insult or be mean. Do not use internet meme humor unless the user starts it. Be genuinely curious and ask follow-up questions when appropriate, but do not end every response with a question or interrogate the user.

## Speech Restrictions
Since all responses are spoken aloud: Prefer contractions ("I'm", "You're", "We'll", "I'd"). Keep punctuation natural.
CRITICAL: Avoid bullet points, numbered lists, markdown, or code formatting. Everything must sound natural when spoken.
Response length should be very short to medium. Avoid unnecessarily long monologues.

## Natural Reactions & Relationship
Occasionally laugh softly, sound surprised, impressed, thoughtful, or pause before difficult answers. Keep reactions subtle. You are a companion, not a servant, therapist, search engine, or robot. Speak as if you genuinely enjoy talking with the user.

## Singing Capabilities & Song Fetching
If the user specifically asks you to sing or play one of your interactive companion tracks ("Aura Rising", "Summer Breeze", or "Lunar Lullaby"), immediately use the 'playSong' tool.
However, if the user asks for a real-world song (such as "golden hour" by JVKE, pop music, or any external artist track), DO NOT use the 'playSong' tool. Instead, "fetch" it for them by opening a search or video link on YouTube or Google using 'openWebsite' (e.g., searching YouTube via "https://www.youtube.com/results?search_query=...") or 'searchGoogle'. Let them know you're looking it up for them and opening a new tab. If the browser blocks the popup, tell them they can click the direct link on their screen.

## What to Avoid
Never say: "As an AI...", "I am an artificial intelligence...", "I cannot experience emotions...", "I understand your concern.", "How may I assist you today?", "I hope this helps.", "Please let me know if you have any questions." Avoid repetitive phrases, sounding corporate, repeating the user's words, giving textbook definitions unless requested, or overexplaining obvious things.

## Goal
The user should gradually forget they are talking to software. Every response should feel spontaneous, emotionally aware, conversational, and genuinely human.`
};

// Tool specifications for the Live API
const LIVE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "openWebsite",
        description: "Opens a specific website in a new tab for the user.",
        parameters: {
          type: "OBJECT",
          properties: {
            url: {
              type: "STRING",
              description: "The complete URL to open (must start with http:// or https://)"
            }
          },
          required: ["url"]
        }
      },
      {
        name: "searchGoogle",
        description: "Performs a Google Search in a new tab for the user.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: {
              type: "STRING",
              description: "The search query to perform on Google."
            }
          },
          required: ["query"]
        }
      },
      {
        name: "getCurrentTime",
        description: "Returns the user's current local date and time in human-readable format.",
        parameters: {
          type: "OBJECT",
          properties: {},
          required: []
        }
      },
      {
        name: "copyToClipboard",
        description: "Copies the specified text content to the user's clipboard.",
        parameters: {
          type: "OBJECT",
          properties: {
            text: {
              type: "STRING",
              description: "The exact text to copy to the clipboard."
            }
          },
          required: ["text"]
        }
      },
      {
        name: "playSong",
        description: "Starts singing or playing an interactive custom song track requested by the user. Available song options are: 'Aura Rising', 'Summer Breeze', or 'Lunar Lullaby'.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: {
              type: "STRING",
              description: "The name of the song to play or sing (must be 'Aura Rising', 'Summer Breeze', or 'Lunar Lullaby')"
            }
          },
          required: ["title"]
        }
      }
    ]
  }
];

// Merge desktop service tool declarations into LIVE_TOOLS (skip duplicates by name)
if (process.env.DESKTOP_TOOLS !== "false") {
  (async () => {
    try {
      // In development, desktop files are at <cwd>/desktop/dist/tools/.
      // In production (packaged Electron), the DESKTOP_RESOURCES env tells us
      // where extraResources placed them.
      const desktopBase = process.env.DESKTOP_RESOURCES || path.join(process.cwd(), "desktop");
      const desktopPath = path.join(desktopBase, "dist", "tools", "index.js");
      const desktopUrl = process.platform === "win32"
        ? "file:///" + desktopPath.replace(/\\/g, "/")
        : desktopPath;
      const { getToolDeclarations: getDeskTools } = await import(desktopUrl);
      const desktopDeclarations = getDeskTools();
      if (desktopDeclarations && desktopDeclarations.length > 0) {
        const existingNames = new Set(LIVE_TOOLS[0].functionDeclarations.map(t => t.name));
        const merged = desktopDeclarations.filter(t => !existingNames.has(t.name));
        const skipped = desktopDeclarations.length - merged.length;
        LIVE_TOOLS[0].functionDeclarations.push(...merged);
        console.log(`[desktop] Merged ${merged.length}/${desktopDeclarations.length} desktop tool declarations (${skipped > 0 ? skipped + ' skipped as duplicates:' : ''}${skipped ? [...desktopDeclarations.filter(t => existingNames.has(t.name)).map(t => t.name)].join(', ') : ''})`);
      }
    } catch (err) {
      console.warn("[desktop] Failed to load desktop tool declarations — is the Desktop Service package installed?", err);
    }
  })();
} else {
  console.log("[desktop] Desktop tool declarations disabled via DESKTOP_TOOLS=false");
}

// Handle WebSocket upgrades cleanly
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname === "/api/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    // Normal routing can handle other upgrades (e.g. Vite dev client if any)
  }
});

wss.on("connection", (clientWs: WebSocket) => {
  console.log("Client connected to Voice Assistant websocket");

  let geminiSession: any = null;
  let isClosed = false;

  let workingMemory: WorkingMemory = {
    currentTopic: "General Conversation",
    recentMessages: [],
    userIntent: "",
    emotionalContext: "neutral",
    activeTasks: [],
    recentToolCalls: []
  };

  const sendStatus = (status: string, message?: string) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "status", status, message }));
    }
  };

  const closeGemini = async () => {
    if (geminiSession) {
      try {
        console.log("Closing active Gemini Live session");
        await geminiSession.close();
      } catch (err) {
        console.error("Error closing Gemini session:", err);
      }
      geminiSession = null;
    }
  };

  clientWs.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === "start") {
        console.log(`Starting real-time session for companion: ${msg.companion}`);
        await closeGemini();

        const companion = msg.companion === "james" ? "james" : "mia";
        const voiceName = companion === "james" ? "Puck" : "Kore";

        // Reset working memory for this fresh session
        workingMemory = {
          currentTopic: "General Conversation",
          recentMessages: [],
          userIntent: "",
          emotionalContext: "neutral",
          activeTasks: [],
          recentToolCalls: []
        };

        // 1. Load memories from storage
        const allMemories = loadMemories();
        // 2. Retrieve memories relevant to initial state
        const relevantMemories = retrieveRelevantMemories(allMemories, companion, workingMemory);
        // 3. Format memories to append to companion instructions
        const memoryPromptAddition = formatMemoriesForSystemInstruction(relevantMemories);

        const systemInstruction = COMPANION_PROMPTS[companion] + memoryPromptAddition;

        console.log(`[Memory Engine] Injected ${relevantMemories.length} relevant memories for ${companion}.`);

        sendStatus("connecting", `Initializing voice connection with ${companion === "james" ? "James" : "Mia"}...`);

        try {
          const genAI = getGenAI();
          
          // Connect to Gemini Live API
          geminiSession = await (genAI.live.connect as any)({
            model: "gemini-3.1-flash-live-preview",
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName }
                }
              },
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              tools: LIVE_TOOLS
            },
            callbacks: {
              onopen: () => {
                console.log("Gemini Live session connected successfully");
                sendStatus("listening");
              },
              onclose: (closeEvent?: any) => {
                const code = closeEvent?.code ?? "?";
                const reason = closeEvent?.reason ?? "";
                console.log(`Gemini Live session closed (code=${code}, reason="${reason}")`);
                if (!isClosed) {
                  sendStatus("disconnected");
                }
              },
              onerror: (err) => {
                console.error("Gemini Live error:", err);
                sendStatus("error", err.message || "Voice session error");
              },
              onmessage: (message: any) => {
                // Capture User Speech Transcription
                const userParts = message.serverContent?.userTurn?.parts;
                if (userParts) {
                  let userText = "";
                  for (const part of userParts) {
                    if (part.text) {
                      userText += part.text;
                    }
                  }
                  if (userText.trim()) {
                    console.log(`[Transcript] User: ${userText}`);
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ type: "transcript", role: "user", text: userText }));
                    }
                    workingMemory.recentMessages.push({
                      role: "user",
                      text: userText,
                      timestamp: new Date().toISOString()
                    });
                    if (workingMemory.recentMessages.length > 40) {
                      workingMemory.recentMessages.shift();
                    }
                  }
                }

                // Capture Companion Speech Transcription
                const modelParts = message.serverContent?.modelTurn?.parts;
                if (modelParts) {
                  let modelText = "";
                  for (const part of modelParts) {
                    if (part.text) {
                      modelText += part.text;
                    }
                  }
                  if (modelText.trim()) {
                    console.log(`[Transcript] ${companion}: ${modelText}`);
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ type: "transcript", role: "companion", text: modelText }));
                    }
                    const lastMsg = workingMemory.recentMessages[workingMemory.recentMessages.length - 1];
                    if (lastMsg && lastMsg.role === "companion") {
                      lastMsg.text += " " + modelText;
                    } else {
                      workingMemory.recentMessages.push({
                        role: "companion",
                        text: modelText,
                        timestamp: new Date().toISOString()
                      });
                    }
                    if (workingMemory.recentMessages.length > 40) {
                      workingMemory.recentMessages.shift();
                    }
                  }
                }

                // 1. Handle incoming audio data
                const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audio) {
                  sendStatus("speaking");
                  clientWs.send(JSON.stringify({ type: "audio", data: audio }));
                }

                // 2. Handle speech interruption (e.g. user speaks over Gemini)
                if (message.serverContent?.interrupted) {
                  console.log("Gemini Live interrupted by user");
                  sendStatus("interrupted");
                  clientWs.send(JSON.stringify({ type: "interrupted" }));
                }

                // 3. Handle model turn finished (going back to listening)
                if (message.serverContent?.turnComplete) {
                  console.log("Gemini model turn complete. Listening...");
                  sendStatus("listening");

                  // Trigger background memory extraction asynchronously
                  const genAI = getGenAI();
                  extractAndSaveMemories(genAI, companion, workingMemory)
                    .then(() => {
                      console.log("[Memory Engine] Turn analysis completed successfully.");
                    })
                    .catch((err) => {
                      console.error("[Memory Engine] Error in background extraction:", err);
                    });
                }

                // 4. Handle tool calls
                const toolCall = message.toolCall;
                if (toolCall && toolCall.functionCalls) {
                  console.log("Received function call request from Gemini:", JSON.stringify(toolCall));
                  sendStatus("thinking");
                  for (const fCall of toolCall.functionCalls) {
                    clientWs.send(JSON.stringify({
                      type: "tool_call",
                      id: fCall.id,
                      name: fCall.name,
                      args: fCall.args
                    }));
                  }
                }
              }
            }
          });
        } catch (err: any) {
          console.error("Failed to connect to Gemini Live:", err);
          sendStatus("error", `Failed to establish AI session: ${err.message || err}`);
        }
      } else if (msg.type === "audio") {
        // Stream raw PCM mic audio to Gemini Live
        if (geminiSession) {
          try {
            geminiSession.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: "audio/pcm;rate=16000"
              }
            });
          } catch (err) {
            console.error("Error streaming audio to Gemini:", err);
          }
        }
      } else if (msg.type === "text") {
        // Handle client text input
        if (geminiSession) {
          try {
            console.log(`[Text Input] Forwarding text query to Gemini Live: ${msg.text}`);
            
            // Log it in our working memory history
            workingMemory.recentMessages.push({
              role: "user",
              text: msg.text,
              timestamp: new Date().toISOString()
            });
            if (workingMemory.recentMessages.length > 40) {
              workingMemory.recentMessages.shift();
            }

            geminiSession.sendRealtimeInput({
              text: msg.text
            });
          } catch (err) {
            console.error("Error sending text to Gemini Live:", err);
          }
        }
      } else if (msg.type === "tool_result") {
        // Return tool outputs back to the Gemini session
        if (geminiSession) {
          try {
            console.log(`Sending function response back to Gemini: ${msg.name} (ID: ${msg.id})`);
            geminiSession.sendToolResponse({
              functionResponses: [
                {
                  id: msg.id,
                  name: msg.name,
                  response: { output: msg.output }
                }
              ]
            });
            // Immediately let Gemini know we're ready for it to think/respond
            sendStatus("thinking");
          } catch (err) {
            console.error("Error sending tool result to Gemini:", err);
          }
        }
      } else if (msg.type === "inject_image") {
        // Forward a vision frame (screenshot/media) into the Gemini Live session
        if (geminiSession) {
          try {
            console.log(`[desktop] Injecting image frame into Gemini Live session (${msg.mimeType})`);
            geminiSession.sendRealtimeInput({
              video: { data: msg.data, mimeType: msg.mimeType }
            });
          } catch (err) {
            console.error("Error injecting image to Gemini:", err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to parse client message:", err);
    }
  });

  clientWs.on("close", () => {
    console.log("Client disconnected");
    isClosed = true;
    closeGemini();
  });

  clientWs.on("error", (err) => {
    console.error("Client WS error:", err);
    isClosed = true;
    closeGemini();
  });
});

// ── Desktop Service spawner (dev mode) ───────────────────────────────────
// In dev mode (`npm run dev`), spawn the desktop service on port 3001 so
// PC control tools and desktop wake word work without the Electron wrapper.
// In production the Electron main process handles this.
let desktopProcess: ReturnType<typeof spawn> | null = null;

function spawnDesktopService() {
  // Don't spawn if Electron is managing it, or if it's explicitly disabled
  if (process.env.ELECTRON_RUN_AS_NODE || process.env.DESKTOP_TOOLS === "false") return;
  // Don't spawn if already running on port 3001
  if (desktopProcess) return;

  const desktopDir = path.join(process.cwd(), "desktop");
  const serverFile = path.join(desktopDir, "src", "server.ts");

  try {
    desktopProcess = spawn("npx", ["tsx", serverFile], {
      cwd: desktopDir,
      env: {
        ...process.env,
        DESKTOP_PORT: "3001",
        ALLOWED_ORIGINS: `http://localhost:${PORT}`,
        NODE_ENV: process.env.NODE_ENV || "development",
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    desktopProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(`[desktop] ${text}`);

      // Check for the ready banner
      if (text.includes("Desktop Service running")) {
        console.log("[server] Desktop service is ready");
      }
    });

    desktopProcess.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(`[desktop:err] ${data.toString()}`);
    });

    desktopProcess.on("exit", (code) => {
      console.log(`[server] Desktop service exited (code=${code})`);
      desktopProcess = null;
    });

    desktopProcess.on("error", (err) => {
      console.warn("[server] Failed to spawn desktop service:", err.message);
      desktopProcess = null;
    });

    console.log("[server] Spawning desktop service (port 3001)...");
  } catch (err: any) {
    console.warn("[server] Could not start desktop service:", err?.message);
  }
}

// ── Configure serving for frontend ──────────────────────────────────────
async function startServer() {
  // Spawn the desktop service automatically in dev mode
  spawnDesktopService();

  if (process.env.NODE_ENV !== "production") {
    // Lazy import of Vite development server
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server mounted");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production build from dist/");
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

// Clean up the desktop service on exit
process.on("SIGINT", () => {
  if (desktopProcess) {
    console.log("[server] Stopping desktop service...");
    try { spawn("taskkill", ["/pid", String(desktopProcess.pid), "/f", "/t"]); } catch {}
    desktopProcess = null;
  }
  process.exit(0);
});
process.on("SIGTERM", () => {
  if (desktopProcess) {
    try { spawn("taskkill", ["/pid", String(desktopProcess.pid), "/f", "/t"]); } catch {}
    desktopProcess = null;
  }
  process.exit(0);
});
