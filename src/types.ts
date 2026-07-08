/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CompanionId = "mia" | "james";

export type SessionState =
  | "disconnected"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "reconnecting"
  | "error";

export interface CompanionConfig {
  id: CompanionId;
  name: string;
  voiceName: string;
  gender: "female" | "male";
  avatarColor: string;
  glowGradients: string[];
  description: string;
  tagline: string;
  systemInstruction: string;
}

// Client to Server WebSocket messages
export type ClientMessage =
  | { type: "start"; companion: CompanionId }
  | { type: "audio"; data: string } // base64 PCM 16kHz
  | { type: "text"; text: string } // User typed text input
  | { type: "tool_result"; id: string; name: string; output: any }
  | { type: "inject_image"; data: string; mimeType: string }; // Screenshot / vision frame injected by desktop tools

// Server to Client WebSocket messages
export type ServerMessage =
  | { type: "status"; status: SessionState; message?: string }
  | { type: "audio"; data: string } // base64 PCM 24kHz
  | { type: "interrupted" }
  | { type: "transcript"; role: "user" | "companion"; text: string } // Live transcript
  | { type: "tool_call"; id: string; name: string; args: any };

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "companion";
  text: string;
  timestamp: Date;
}
