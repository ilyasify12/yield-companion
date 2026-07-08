/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Square, Disc, Volume2, Sparkles, Heart } from "lucide-react";
import { Song, SONGS } from "../data/songs";

interface MusicPlayerProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  companionId: string;
  onPlaySong: (id: string) => void;
  onStopSong: () => void;
}

export function MusicPlayer({
  currentSong,
  isPlaying,
  currentTime,
  companionId,
  onPlaySong,
  onStopSong,
}: MusicPlayerProps) {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Find the currently active lyric line
  const activeLyricIndex = currentSong
    ? currentSong.lyrics.findIndex((line, idx) => {
        const nextLine = currentSong.lyrics[idx + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
      })
    : -1;

  // Speak the lyric line in real-time synchronized with the synth music
  useEffect(() => {
    if (isPlaying && currentSong && activeLyricIndex !== -1) {
      const activeLine = currentSong.lyrics[activeLyricIndex];
      // Skip structural lines like instrumentals or titles e.g. 🎵 [Intro...] 🎵
      if (activeLine && !activeLine.text.includes("[") && !activeLine.text.includes("🎵")) {
        try {
          // Interrupt any active line speech to avoid overlaps
          window.speechSynthesis.cancel();

          const utterance = SynthesisUtteranceWithVoice(activeLine.text, companionId);
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn("Speech synthesis trigger error:", e);
        }
      }
    } else {
      // Silence immediately on stop or pause
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }, [activeLyricIndex, isPlaying, currentSong, companionId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    };
  }, []);

  // Helper function to create custom voice profile
  function SynthesisUtteranceWithVoice(text: string, compId: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const isJames = compId === "james";

    let selectedVoice = null;
    if (isJames) {
      // Find mature warm male voice
      selectedVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.toLowerCase().includes("male") ||
            v.name.toLowerCase().includes("david") ||
            v.name.toLowerCase().includes("george") ||
            v.name.toLowerCase().includes("microsoft david"))
      );
    } else {
      // Find cute expressive female voice
      selectedVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.toLowerCase().includes("google us english") ||
            v.name.toLowerCase().includes("samantha") ||
            v.name.toLowerCase().includes("zira") ||
            v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("natural"))
      );
    }

    // Default English fallback
    if (!selectedVoice) {
      selectedVoice = voices.find((v) => v.lang.startsWith("en"));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Customized sound properties to sound pleasant and musical
    if (isJames) {
      utterance.pitch = 0.9;
      utterance.rate = 0.82; // Warm, relaxed
    } else {
      utterance.pitch = 1.22; // Cute, bright, energetic
      utterance.rate = 0.88; // Flowing tempo
    }

    return utterance;
  }

  // Smoothly auto-scroll active lyric into center of view
  useEffect(() => {
    if (activeLyricIndex !== -1 && lyricsContainerRef.current) {
      const activeElement = lyricsContainerRef.current.children[activeLyricIndex] as HTMLElement;
      if (activeElement) {
        lyricsContainerRef.current.scrollTo({
          top: activeElement.offsetTop - lyricsContainerRef.current.offsetHeight / 2 + activeElement.offsetHeight / 2,
          behavior: "smooth",
        });
      }
    }
  }, [activeLyricIndex]);

  return (
    <div id="companion-music-station" className="w-full max-w-md mx-auto bg-black/40 border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      {/* Background neon vibe glow */}
      <div className="absolute -right-20 -top-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/15 transition-all duration-700" />
      <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-purple-500/15 transition-all duration-700" />

      {/* Header Info */}
      <div className="flex items-center justify-between mb-3.5 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Music className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-white tracking-wider uppercase">Interactive Voice Synth Player</h3>
            <p className="text-[10px] text-gray-500 font-sans">Aura Companion Vocal Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
          <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span className="text-[9px] font-mono font-semibold text-cyan-400 tracking-wider uppercase">Live Sing Mode</span>
        </div>
      </div>

      {/* Active Song Dashboard */}
      {currentSong ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
            {/* Spinning Record Art */}
            <div className="relative shrink-0">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-700 to-cyan-500 flex items-center justify-center border border-white/20 shadow-lg ${isPlaying ? "animate-spin [animation-duration:8s]" : ""}`}>
                <Disc className="w-6 h-6 text-white/90" />
              </div>
              {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
              )}
            </div>

            {/* Song Meta / Realtime Equalizer */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-white truncate font-sans">{currentSong.title}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/10 rounded uppercase shrink-0">
                  {currentSong.genre}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-sans truncate mt-0.5">By {currentSong.artist}</p>
              
              {/* Animated visualizer bars */}
              <div className="flex items-end gap-0.5 h-3 mt-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((i) => (
                  <span
                    key={i}
                    className="flex-1 bg-cyan-400/80 rounded-t-sm"
                    style={{
                      height: isPlaying ? `${Math.floor(Math.random() * 100)}%` : "2px",
                      transition: "height 0.15s ease-in-out",
                      animation: isPlaying ? `bounce 0.8s ease-in-out ${i * 0.05}s infinite alternate` : "none"
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Karaoke Lyrics Display with smooth vertical slide auto-scrolling */}
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none" />
            
            <div
              ref={lyricsContainerRef}
              className="h-32 overflow-y-auto px-2 py-6 flex flex-col gap-2.5 items-center justify-start scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent rounded-xl bg-black/20 border border-white/5"
            >
              {currentSong.lyrics.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                return (
                  <motion.div
                    key={idx}
                    animate={{
                      scale: isActive ? 1.05 : 0.95,
                      opacity: isActive ? 1 : 0.4,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`text-center transition-colors duration-300 ${
                      isActive
                        ? "text-cyan-300 font-semibold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] text-xs font-sans"
                        : "text-gray-400 text-[11px] font-sans"
                    }`}
                  >
                    {line.text}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Progress Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-gray-500">
              <span>{Math.floor(currentTime)}s</span>
              <span>{currentSong.duration}s</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden border border-white/5">
              <div
                className="bg-cyan-400 h-full transition-all duration-100 ease-out"
                style={{ width: `${(currentTime / currentSong.duration) * 100}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vocals Synced</span>
            </div>
            <button
              onClick={onStopSong}
              className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <Square className="w-3 h-3 fill-red-400" />
              STOP SINGING
            </button>
          </div>
        </div>
      ) : (
        /* Empty State with song selector */
        <div className="py-4 text-center">
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Disc className="w-5 h-5 text-gray-400 animate-pulse" />
          </div>
          <p className="text-xs text-gray-300 font-sans font-medium">Select a track to start the companion singing</p>
          <p className="text-[10px] text-gray-500 font-sans mt-0.5 max-w-[280px] mx-auto">
            Ask Mia or James: <span className="italic text-cyan-400">"sing Aura Rising"</span> or choose below manually.
          </p>

          <div className="grid grid-cols-1 gap-2 mt-4 text-left">
            {Object.values(SONGS).map((song) => (
              <button
                key={song.id}
                onClick={() => onPlaySong(song.id)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer group/btn"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Play className="w-3 h-3 text-cyan-400 group-hover/btn:scale-125 transition-transform shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{song.title}</p>
                    <p className="text-[9px] text-gray-500 truncate">{song.genre}</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-cyan-400 px-1.5 py-0.5 bg-cyan-500/10 rounded shrink-0 opacity-80">
                  {song.duration}s
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
