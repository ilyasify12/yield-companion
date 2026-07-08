import fs from "fs";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";

export interface MemoryItem {
  memory_id: string;
  category: string;
  content: string;
  confidence: number;
  importance: number;
  created_at: string;
  updated_at: string;
  last_used: string;
  companion_id: "mia" | "james" | "both";
  type: "long-term" | "relationship" | "emotional";
}

export interface WorkingMemory {
  currentTopic: string;
  recentMessages: { role: "user" | "companion"; text: string; timestamp: string }[];
  userIntent: string;
  emotionalContext: string;
  activeTasks: string[];
  recentToolCalls: string[];
}

/**
 * Formats retrieved memories into a beautiful, private prompt extension
 * to be appended to the companion's system instructions.
 */
export function formatMemoriesForSystemInstruction(memories: MemoryItem[]): string {
  if (memories.length === 0) return "";

  const longTerm = memories.filter((m) => m.type === "long-term");
  const relationship = memories.filter((m) => m.type === "relationship");
  const emotional = memories.filter((m) => m.type === "emotional");

  let text = "\n\n--- USER PERSISTENT MEMORIES (DO NOT EXPOSE DIRECTLY) ---\n";
  text += "The following are verified, high-confidence memories about the user from your previous conversations. ";
  text += "Integrate these facts, relationship context, and emotional trends into your speech naturally and subtly. ";
  text += "NEVER refer to this section, say 'as we discussed before' excessively, or reveal that you have an internal memory list. ";
  text += "Simply behave as a thoughtful friend with excellent long-term memory.\n\n";

  if (longTerm.length > 0) {
    text += "### User Facts & Preferences:\n";
    longTerm.forEach((m) => {
      text += `- ${m.content}\n`;
    });
  }

  if (relationship.length > 0) {
    text += "\n### Relationship Context:\n";
    relationship.forEach((m) => {
      text += `- ${m.content}\n`;
    });
  }

  if (emotional.length > 0) {
    text += "\n### Emotional History & Current Context:\n";
    emotional.forEach((m) => {
      text += `- ${m.content}\n`;
    });
  }

  text += "\n---------------------------------------------------------";
  return text;
}

const MEMORIES_FILE_PATH = path.join(process.cwd(), "memories.json");

/**
 * Loads memories from the persistent JSON file.
 * Handles missing file, corrupt JSON, and applies decay over time.
 */
export function loadMemories(): MemoryItem[] {
  try {
    if (!fs.existsSync(MEMORIES_FILE_PATH)) {
      fs.writeFileSync(MEMORIES_FILE_PATH, JSON.stringify([], null, 2));
      return [];
    }
    const raw = fs.readFileSync(MEMORIES_FILE_PATH, "utf8");
    const memories: MemoryItem[] = JSON.parse(raw);
    
    // Apply emotional/interest decay on load
    return decayMemories(memories);
  } catch (error) {
    console.error("Error loading memories:", error);
    return [];
  }
}

/**
 * Saves memories to the persistent JSON file.
 */
export function saveMemories(memories: MemoryItem[]): void {
  try {
    fs.writeFileSync(MEMORIES_FILE_PATH, JSON.stringify(memories, null, 2));
    console.log(`Saved ${memories.length} memories to persistent storage.`);
  } catch (error) {
    console.error("Error saving memories:", error);
  }
}

/**
 * Slowly decays importance/confidence of memories that haven't been used in a long time.
 * Helps temporary interests fade away while keeping high-importance facts.
 */
function decayMemories(memories: MemoryItem[]): MemoryItem[] {
  const now = new Date();
  const decayRate = 0.05; // 5% decay per month of inactivity
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

  let changed = false;
  const updated = memories.map((item) => {
    const lastUsedDate = new Date(item.last_used || item.updated_at || item.created_at);
    const monthsInactive = (now.getTime() - lastUsedDate.getTime()) / oneMonthMs;

    if (monthsInactive > 1) {
      // Decay emotional memory faster, long-term memory slower
      const multiplier = item.type === "emotional" ? 2.0 : 1.0;
      const decayAmount = decayRate * monthsInactive * multiplier;
      const newImportance = Math.max(0.1, item.importance - decayAmount);
      
      if (newImportance !== item.importance) {
        changed = true;
        return {
          ...item,
          importance: parseFloat(newImportance.toFixed(2)),
        };
      }
    }
    return item;
  });

  // Filter out memories that have decayed to absolute unimportance (< 0.15) unless they are core identity facts
  const filtered = updated.filter(
    (item) => item.importance >= 0.15 || item.category === "identity" || item.category === "communication_style"
  );

  if (filtered.length !== memories.length || changed) {
    saveMemories(filtered);
  }

  return filtered;
}

/**
 * Retrieves memories that are relevant to the current conversation topic or words.
 * Avoids injecting unrelated memories to keep retrieval focused.
 */
export function retrieveRelevantMemories(
  allMemories: MemoryItem[],
  companionId: "mia" | "james",
  workingMemory: WorkingMemory
): MemoryItem[] {
  // 1. Filter by companion suitability (only for this companion, or "both")
  const suitableMemories = allMemories.filter(
    (m) => (m.companion_id === companionId || m.companion_id === "both") && m.confidence >= 0.8
  );

  // 2. Identify the active topics/keywords from the recent messages
  const recentTexts = workingMemory.recentMessages.map((m) => m.text.toLowerCase()).join(" ");
  const currentTopic = workingMemory.currentTopic.toLowerCase();
  const searchSpace = `${currentTopic} ${recentTexts}`;

  // 3. Category & text keyword mapping
  // If the search space is empty (e.g. at the start of a session), return core profile/preferences
  if (!searchSpace.trim() || workingMemory.recentMessages.length <= 1) {
    return suitableMemories.filter((m) => 
      m.category === "identity" || 
      m.category === "preferences" || 
      m.category === "communication_style" ||
      m.importance > 0.7
    );
  }

  // Keywords indicating interest in specific categories
  const categoryKeywords: Record<string, string[]> = {
    coding: ["code", "coding", "react", "typescript", "javascript", "python", "programming", "bug", "git", "api"],
    gaming: ["game", "games", "gaming", "play", "steam", "nintendo", "xbox", "playstation", "rocket league", "valorant", "minecraft"],
    movies: ["movie", "movies", "film", "films", "cinema", "netflix", "sci-fi", "actor", "director", "watch"],
    music: ["music", "song", "songs", "band", "artist", "singer", "album", "spotify", "guitar", "piano", "listening"],
    career: ["job", "career", "work", "office", "interview", "resume", "promote", "boss", "manager", "company"],
    education: ["school", "college", "university", "class", "study", "exam", "learn", "learning", "degree"],
    food: ["food", "eat", "eating", "restaurant", "cook", "cooking", "dinner", "lunch", "breakfast", "recipe", "pizza"],
    travel: ["travel", "trip", "flight", "hotel", "vacation", "visit", "country", "city", "explore"],
    hobbies: ["hobby", "hobbies", "read", "book", "books", "sport", "workout", "gym", "run", "drawing", "paint"],
  };

  // Find categories mentioned
  const activeCategories = new Set<string>(["identity", "communication_style"]); // Always include core identity and style
  
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => searchSpace.includes(kw))) {
      activeCategories.add(cat);
    }
  }

  // Filter memories that match active categories OR directly contain mentioned words in their content
  return suitableMemories.filter((m) => {
    if (activeCategories.has(m.category)) return true;
    
    // Direct content keyword match
    const memoryWords = m.content.toLowerCase().split(/\s+/);
    return memoryWords.some((word) => word.length > 3 && searchSpace.includes(word));
  });
}

/**
 * Determines which LLM provider to use for memory extraction.
 * Reads from environment: MEMORY_LLM_PROVIDER = "gemini" | "opencode"
 */
function getMemoryProvider(): "gemini" | "opencode" {
  const provider = process.env.MEMORY_LLM_PROVIDER?.toLowerCase() || "gemini";
  if (provider === "opencode") return "opencode";
  return "gemini";
}

/**
 * Calls an LLM with structured JSON output — provider-agnostic.
 * Supports Gemini (via @google/genai) and OpenCode Zen (OpenAI-compatible).
 */
async function callStructuredLLM(
  systemPrompt: string,
  userPrompt: string,
  schemaDescription: string,
  ai?: GoogleGenAI
): Promise<string | null> {
  const provider = getMemoryProvider();

  if (provider === "opencode") {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) {
      console.warn("[Memory Engine] OPENCODE_API_KEY not set. Falling back to Gemini.");
      return fallbackToGemini(systemPrompt, userPrompt, ai);
    }

    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: "https://opencode.ai/zen/v1/",
      });

      const response = await openai.chat.completions.create({
        model: "mimo-v2.5-free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      return response.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      console.error("[Memory Engine] OpenCode Zen call failed:", err);
      console.warn("[Memory Engine] Falling back to Gemini.");
      return fallbackToGemini(systemPrompt, userPrompt, ai);
    }
  }

  // Default: Gemini via structured output schema
  return fallbackToGemini(systemPrompt, userPrompt, ai);
}

/**
 * Falls back to Gemini's structured output for memory extraction.
 */
async function fallbackToGemini(
  systemPrompt: string,
  userPrompt: string,
  ai?: GoogleGenAI
): Promise<string | null> {
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            operations: {
              type: Type.ARRAY,
              description: "List of memory modifications to perform based on the conversation.",
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING, enum: ["add", "update", "delete"] },
                  memory_id: { type: Type.STRING, description: "Include if action is 'update' or 'delete', otherwise leave empty." },
                  category: { type: Type.STRING },
                  content: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  importance: { type: Type.NUMBER },
                  type: { type: Type.STRING, enum: ["long-term", "relationship", "emotional"] },
                  companion_id: { type: Type.STRING, enum: ["mia", "james", "both"] }
                },
                required: ["action", "category", "content", "confidence", "importance", "type", "companion_id"]
              }
            }
          },
          required: ["operations"]
        }
      }
    });
    return response.text ?? null;
  } catch (err) {
    console.error("[Memory Engine] Gemini call failed:", err);
    return null;
  }
}

/**
 * Triggers the background AI memory extraction.
 * Reads the latest conversation turn, identifies what to save, resolve conflicts, and updates storage.
 * Supports both Gemini (default) and OpenCode Zen (via MEMORY_LLM_PROVIDER=opencode).
 */
export async function extractAndSaveMemories(
  ai: GoogleGenAI,
  companionId: "mia" | "james",
  workingMemory: WorkingMemory
): Promise<void> {
  try {
    const memories = loadMemories();
    const transcript = workingMemory.recentMessages
      .map((m) => `${m.role === "user" ? "User" : companionId === "james" ? "James" : "Mia"}: ${m.text}`)
      .join("\n");

    if (workingMemory.recentMessages.length < 2) {
      return; // Not enough context to extract memory
    }

    console.log(`[Memory Engine] Analyzing recent turn for ${companionId} using ${getMemoryProvider()}...`);

    const systemPrompt = `You are a state-of-the-art background memory extraction engine for AI voice companions (Mia and James).
Your objective is to extract high-quality, persistent memories from the conversation transcript to help make future sessions feel continuous, deeply personal, and emotionally mature.

Here are the active persistent memories we already have for this user:
${JSON.stringify(memories, null, 2)}

Analyze the provided new conversation segment. Determine if there is any information worth remembering.
ONLY extract memories that will remain useful for weeks or months.

### Memory Rules:
1. Long-Term Memory: Save facts, preferred name, timezone, interests (hobbies, gaming, coding, career goals, favorite music/movies).
2. Relationship Memory: Save inside jokes, conversational style preferences (e.g. prefers detailed explanations, likes humor, prefers concise answers).
3. Emotional Memory: Save emotional trends, achievements, frustrations, current challenges.
4. DO NOT save temporary facts: today's weather, one-time plans, current temporary bugs/errors, passwords, credit cards, short-lived problems.
5. If new information CONFLICTS with an existing memory, you must update the existing memory (change the action to "update" and keep the same memory_id). Do not create duplicates.
6. If a memory is no longer true, you can delete it (action: "delete", matching memory_id).
7. Every memory must have:
   - action: "add" | "update" | "delete"
   - category: One of the allowed categories: [identity, preferences, projects, coding, career, education, relationships, hobbies, food, travel, music, movies, gaming, health_preferences, daily_routine, communication_style, goals, tools, technology]
   - content: Concise, natural fact (e.g., "Enjoys sci-fi movies and space thrillers")
   - confidence: Rating from 0.0 to 1.0 (Only automatically save if confidence > 0.80)
   - importance: Rating from 0.0 to 1.0 based on how central this fact is to user's identity.
   - type: "long-term" | "relationship" | "emotional"
   - companion_id: "mia" | "james" | "both" (e.g. preferred name or programming language is "both", companion-specific inside jokes are "mia" or "james")

Return your evaluation strictly as a JSON object with a single key "operations" containing the array of memory operations.`;

    const userPrompt = `Conversation transcript:\n${transcript}`;

    const resultText = await callStructuredLLM(systemPrompt, userPrompt, "memory extraction", ai);
    if (!resultText) return;

    const data = JSON.parse(resultText);
    if (!data.operations || !Array.isArray(data.operations)) return;

    let updatedMemories = [...memories];
    let hasChanges = false;

    for (const op of data.operations) {
      if (op.confidence < 0.80) {
        console.log(`[Memory Engine] Skipping low confidence memory (${op.confidence}): ${op.content}`);
        continue;
      }

      const nowStr = new Date().toISOString();

      if (op.action === "add") {
        const newId = `mem_${Math.random().toString(36).substring(2, 11)}`;
        const newItem: MemoryItem = {
          memory_id: newId,
          category: op.category,
          content: op.content,
          confidence: op.confidence,
          importance: op.importance,
          created_at: nowStr,
          updated_at: nowStr,
          last_used: nowStr,
          companion_id: op.companion_id,
          type: op.type
        };
        updatedMemories.push(newItem);
        hasChanges = true;
        console.log(`[Memory Engine] Added new memory: "${newItem.content}" in category "${newItem.category}"`);
      } else if (op.action === "update" && op.memory_id) {
        const idx = updatedMemories.findIndex((m) => m.memory_id === op.memory_id);
        if (idx !== -1) {
          updatedMemories[idx] = {
            ...updatedMemories[idx],
            category: op.category || updatedMemories[idx].category,
            content: op.content || updatedMemories[idx].content,
            confidence: op.confidence ?? updatedMemories[idx].confidence,
            importance: op.importance ?? updatedMemories[idx].importance,
            updated_at: nowStr,
            last_used: nowStr
          };
          hasChanges = true;
          console.log(`[Memory Engine] Updated existing memory ${op.memory_id}: "${updatedMemories[idx].content}"`);
        }
      } else if (op.action === "delete" && op.memory_id) {
        const initialLen = updatedMemories.length;
        updatedMemories = updatedMemories.filter((m) => m.memory_id !== op.memory_id);
        if (updatedMemories.length !== initialLen) {
          hasChanges = true;
          console.log(`[Memory Engine] Deleted memory ${op.memory_id}`);
        }
      }
    }

    if (hasChanges) {
      saveMemories(updatedMemories);
    }
  } catch (error) {
    console.error("[Memory Engine] Failed to extract memories:", error);
  }
}
