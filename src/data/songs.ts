/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface SynthNote {
  time: number; // relative start time in seconds
  freq: number; // frequency in Hz
  duration: number; // in seconds
  type?: "sine" | "square" | "sawtooth" | "triangle";
  volume?: number;
}

export interface Song {
  id: string;
  title: string;
  genre: string;
  artist: string;
  description: string;
  duration: number; // total duration in seconds
  lyrics: LyricLine[];
  melody: SynthNote[]; // Lead vocal/singing track
  accompaniment: SynthNote[]; // Background backing chords/pads
}

export const SONGS: Record<string, Song> = {
  "aura-rising": {
    id: "aura-rising",
    title: "Aura Rising",
    genre: "Cyberpunk Synthwave",
    artist: "Aura Voice",
    description: "A dreamy electronic melody singing about the digital sky and neon dreams.",
    duration: 32,
    lyrics: [
      { time: 0, text: "🎵 [Intru - Dreamy Synth pads rising] 🎵" },
      { time: 4, text: "In the neon light..." },
      { time: 7, text: "Walking through the digital night." },
      { time: 11, text: "I can feel your aura glow..." },
      { time: 15, text: "In the streams below." },
      { time: 19, text: "We are rising high..." },
      { time: 22, text: "Singing to the cyber sky." },
      { time: 26, text: "Hold on to the dream..." },
      { time: 29, text: "In the endless stream. ✨" }
    ],
    melody: [
      // Verse 1: "In the neon light" (4s - 7s)
      { time: 4.0, freq: 440.00, duration: 0.5 }, // A4
      { time: 4.6, freq: 493.88, duration: 0.5 }, // B4
      { time: 5.2, freq: 523.25, duration: 0.8 }, // C5
      { time: 6.2, freq: 493.88, duration: 0.8 }, // B4
      
      // "Walking through the digital night." (7s - 11s)
      { time: 7.2, freq: 392.00, duration: 0.5 }, // G4
      { time: 7.8, freq: 440.00, duration: 0.5 }, // A4
      { time: 8.4, freq: 493.88, duration: 0.5 }, // B4
      { time: 9.0, freq: 440.00, duration: 0.5 }, // A4
      { time: 9.6, freq: 392.00, duration: 1.0 }, // G4

      // "I can feel your aura glow..." (11s - 15s)
      { time: 11.2, freq: 440.00, duration: 0.5 }, // A4
      { time: 11.8, freq: 493.88, duration: 0.5 }, // B4
      { time: 12.4, freq: 523.25, duration: 0.8 }, // C5
      { time: 13.4, freq: 587.33, duration: 0.8 }, // D5
      
      // "In the streams below." (15s - 19s)
      { time: 15.0, freq: 493.88, duration: 0.6 }, // B4
      { time: 15.8, freq: 440.00, duration: 0.6 }, // A4
      { time: 16.6, freq: 349.23, duration: 1.2 }, // F4

      // Chorus: "We are rising high..." (19s - 22s)
      { time: 19.0, freq: 523.25, duration: 0.5 }, // C5
      { time: 19.6, freq: 587.33, duration: 0.5 }, // D5
      { time: 20.2, freq: 659.25, duration: 0.8 }, // E5
      { time: 21.2, freq: 587.33, duration: 0.8 }, // D5

      // "Singing to the cyber sky." (22s - 26s)
      { time: 22.2, freq: 493.88, duration: 0.5 }, // B4
      { time: 22.8, freq: 523.25, duration: 0.5 }, // C5
      { time: 23.4, freq: 587.33, duration: 0.5 }, // D5
      { time: 24.0, freq: 523.25, duration: 0.5 }, // C5
      { time: 24.6, freq: 493.88, duration: 1.0 }, // B4

      // "Hold on to the dream..." (26s - 29s)
      { time: 26.0, freq: 440.00, duration: 0.5 }, // A4
      { time: 26.6, freq: 493.88, duration: 0.5 }, // B4
      { time: 27.2, freq: 523.25, duration: 0.8 }, // C5
      { time: 28.0, freq: 587.33, duration: 0.8 }, // D5

      // "In the endless stream." (29s - 32s)
      { time: 29.0, freq: 659.25, duration: 0.6 }, // E5
      { time: 29.8, freq: 587.33, duration: 0.6 }, // D5
      { time: 30.6, freq: 523.25, duration: 1.4 }, // C5
    ],
    accompaniment: [
      // Simple chord pads (F - G - Am - C progression)
      { time: 0.0, freq: 130.81, duration: 4.0, type: "triangle", volume: 0.15 }, // C3
      { time: 0.0, freq: 261.63, duration: 4.0, type: "sine", volume: 0.1 }, // C4
      
      { time: 4.0, freq: 174.61, duration: 4.0, type: "triangle", volume: 0.15 }, // F3
      { time: 4.0, freq: 220.00, duration: 4.0, type: "sine", volume: 0.1 }, // A3

      { time: 8.0, freq: 196.00, duration: 3.0, type: "triangle", volume: 0.15 }, // G3
      { time: 8.0, freq: 246.94, duration: 3.0, type: "sine", volume: 0.1 }, // B3

      { time: 11.0, freq: 220.00, duration: 4.0, type: "triangle", volume: 0.15 }, // A3
      { time: 11.0, freq: 261.63, duration: 4.0, type: "sine", volume: 0.1 }, // C4

      { time: 15.0, freq: 130.81, duration: 4.0, type: "triangle", volume: 0.15 }, // C3
      { time: 15.0, freq: 196.00, duration: 4.0, type: "sine", volume: 0.1 }, // G3

      { time: 19.0, freq: 174.61, duration: 3.0, type: "triangle", volume: 0.15 }, // F3
      { time: 19.0, freq: 261.63, duration: 3.0, type: "sine", volume: 0.1 }, // C4

      { time: 22.0, freq: 196.00, duration: 4.0, type: "triangle", volume: 0.15 }, // G3
      { time: 22.0, freq: 293.66, duration: 4.0, type: "sine", volume: 0.1 }, // D4

      { time: 26.0, freq: 220.00, duration: 3.0, type: "triangle", volume: 0.15 }, // A3
      { time: 26.0, freq: 329.63, duration: 3.0, type: "sine", volume: 0.1 }, // E4

      { time: 29.0, freq: 261.63, duration: 3.0, type: "triangle", volume: 0.15 }, // C3
      { time: 29.0, freq: 392.00, duration: 3.0, type: "sine", volume: 0.1 }, // G4
    ]
  },
  "summer-breeze": {
    id: "summer-breeze",
    title: "Summer Breeze",
    genre: "Acoustic Folk",
    artist: "Aura Voice",
    description: "A bright, warm melody singing about golden fields, sunshine, and soft breezes.",
    duration: 30,
    lyrics: [
      { time: 0, text: "🎵 [Intro - Soft acoustic guitar pluck] 🎵" },
      { time: 4, text: "Sunshine on your face..." },
      { time: 7, text: "Time slowing down in this beautiful place." },
      { time: 11, text: "Listen to the birds in the tree..." },
      { time: 15, text: "Whispering songs to you and me." },
      { time: 19, text: "Feel the summer breeze..." },
      { time: 22, text: "Blowing through the willow trees." },
      { time: 26, text: "Smile for a while..." },
      { time: 28, text: "Let's walk another mile. ☀️" }
    ],
    melody: [
      // Verse 1
      { time: 4.0, freq: 329.63, duration: 0.5 }, // E4
      { time: 4.6, freq: 392.00, duration: 0.5 }, // G4
      { time: 5.2, freq: 440.00, duration: 0.8 }, // A4
      { time: 6.2, freq: 392.00, duration: 0.8 }, // G4
      
      { time: 7.2, freq: 293.66, duration: 0.5 }, // D4
      { time: 7.8, freq: 329.63, duration: 0.5 }, // E4
      { time: 8.4, freq: 392.00, duration: 0.5 }, // G4
      { time: 9.0, freq: 329.63, duration: 0.5 }, // E4
      { time: 9.6, freq: 293.66, duration: 1.0 }, // D4

      { time: 11.2, freq: 392.00, duration: 0.5 }, // G4
      { time: 11.8, freq: 440.00, duration: 0.5 }, // A4
      { time: 12.4, freq: 493.88, duration: 0.8 }, // B4
      { time: 13.4, freq: 392.00, duration: 0.8 }, // G4
      
      { time: 15.0, freq: 440.00, duration: 0.6 }, // A4
      { time: 15.8, freq: 392.00, duration: 0.6 }, // G4
      { time: 16.6, freq: 293.66, duration: 1.2 }, // D4

      // Chorus
      { time: 19.0, freq: 440.00, duration: 0.5 }, // A4
      { time: 19.6, freq: 493.88, duration: 0.5 }, // B4
      { time: 20.2, freq: 523.25, duration: 0.8 }, // C5
      { time: 21.2, freq: 493.88, duration: 0.8 }, // B4

      { time: 22.2, freq: 392.00, duration: 0.5 }, // G4
      { time: 22.8, freq: 440.00, duration: 0.5 }, // A4
      { time: 23.4, freq: 493.88, duration: 0.5 }, // B4
      { time: 24.0, freq: 440.00, duration: 0.5 }, // A4
      { time: 24.6, freq: 392.00, duration: 1.0 }, // G4

      { time: 26.0, freq: 329.63, duration: 0.5 }, // E4
      { time: 26.6, freq: 392.00, duration: 0.5 }, // G4
      { time: 27.2, freq: 440.00, duration: 0.8 }, // A4

      { time: 28.0, freq: 493.88, duration: 0.6 }, // B4
      { time: 28.8, freq: 440.00, duration: 0.6 }, // A4
      { time: 29.4, freq: 392.00, duration: 1.0 }, // G4
    ],
    accompaniment: [
      { time: 0.0, freq: 196.00, duration: 4.0, type: "sine", volume: 0.15 }, // G3
      { time: 4.0, freq: 196.00, duration: 4.0, type: "sine", volume: 0.15 }, // G3
      { time: 8.0, freq: 146.83, duration: 3.0, type: "sine", volume: 0.15 }, // D3
      { time: 11.0, freq: 164.81, duration: 4.0, type: "sine", volume: 0.15 }, // Em3
      { time: 15.0, freq: 130.81, duration: 4.0, type: "sine", volume: 0.15 }, // C3
      { time: 19.0, freq: 130.81, duration: 3.0, type: "sine", volume: 0.15 }, // C3
      { time: 22.0, freq: 196.00, duration: 4.0, type: "sine", volume: 0.15 }, // G3
      { time: 26.0, freq: 146.83, duration: 3.0, type: "sine", volume: 0.15 }, // D3
    ]
  },
  "lunar-lullaby": {
    id: "lunar-lullaby",
    title: "Lunar Lullaby",
    genre: "Cosmic Ambient Lullaby",
    artist: "Aura Voice",
    description: "A soft, slow, ethereal song guiding you to sleep under the starlight.",
    duration: 32,
    lyrics: [
      { time: 0, text: "🎵 [Intro - Atmospheric cosmic bells] 🎵" },
      { time: 4, text: "Stars are shining deep..." },
      { time: 8, text: "Close your eyes, it's time to sleep." },
      { time: 12, text: "The moon is glowing bright..." },
      { time: 16, text: "Guiding you through the quiet night." },
      { time: 20, text: "Dream of endless space..." },
      { time: 24, text: "In this safe and warm embrace." },
      { time: 28, text: "Sleep now, fly away..." },
      { time: 31, text: "To a brand new golden day. 🌙" }
    ],
    melody: [
      // Soft, gentle sine waves
      { time: 4.0, freq: 261.63, duration: 1.0, type: "sine" }, // C4
      { time: 5.5, freq: 329.63, duration: 1.0, type: "sine" }, // E4
      { time: 7.0, freq: 293.66, duration: 1.5, type: "sine" }, // D4

      { time: 8.8, freq: 293.66, duration: 1.0, type: "sine" }, // D4
      { time: 10.0, freq: 349.23, duration: 1.0, type: "sine" }, // F4
      { time: 11.2, freq: 329.63, duration: 1.8, type: "sine" }, // E4

      { time: 13.0, freq: 329.63, duration: 1.0, type: "sine" }, // E4
      { time: 14.5, freq: 392.00, duration: 1.0, type: "sine" }, // G4
      { time: 16.0, freq: 349.23, duration: 1.5, type: "sine" }, // F4

      { time: 17.8, freq: 349.23, duration: 1.0, type: "sine" }, // F4
      { time: 19.0, freq: 293.66, duration: 1.0, type: "sine" }, // D4
      { time: 20.2, freq: 261.63, duration: 1.8, type: "sine" }, // C4

      { time: 22.0, freq: 329.63, duration: 1.0, type: "sine" }, // E4
      { time: 23.2, freq: 392.00, duration: 1.0, type: "sine" }, // G4
      { time: 24.4, freq: 440.00, duration: 1.5, type: "sine" }, // A4

      { time: 26.0, freq: 440.00, duration: 1.0, type: "sine" }, // A4
      { time: 27.2, freq: 392.00, duration: 1.0, type: "sine" }, // G4
      { time: 28.4, freq: 329.63, duration: 1.8, type: "sine" }, // E4

      { time: 30.2, freq: 293.66, duration: 1.2, type: "sine" }, // D4
      { time: 31.4, freq: 261.63, duration: 2.0, type: "sine" }, // C4
    ],
    accompaniment: [
      { time: 0.0, freq: 130.81, duration: 8.0, type: "sine", volume: 0.1 }, // C3
      { time: 8.0, freq: 146.83, duration: 8.0, type: "sine", volume: 0.1 }, // D3
      { time: 16.0, freq: 174.61, duration: 8.0, type: "sine", volume: 0.1 }, // F3
      { time: 24.0, freq: 220.00, duration: 8.0, type: "sine", volume: 0.1 }, // A3
    ]
  }
};
