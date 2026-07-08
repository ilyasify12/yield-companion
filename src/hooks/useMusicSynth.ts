/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Song, SONGS } from "../data/songs";

export function useMusicSynth() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<any[]>([]);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  // Stop active playback and clear any pending timers / oscillators
  const stopSong = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    activeNodesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch (e) {}
    });
    activeNodesRef.current = [];

    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const playSong = (songId: string) => {
    // Stop any existing song first
    stopSong();

    const selectedSong = SONGS[songId] || SONGS["aura-rising"];
    setCurrentSong(selectedSong);
    setIsPlaying(true);
    setCurrentTime(0);

    // Initialize clean AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.8, ctx.currentTime);
    
    // Add lowpass filter for a warm analog vibe
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, ctx.currentTime);

    mainGain.connect(filter);
    filter.connect(ctx.destination);

    const now = ctx.currentTime;
    startTimeRef.current = now;

    const scheduledOscillators: any[] = [];

    // 1. Schedule Background Accompaniment Chords
    selectedSong.accompaniment.forEach((chord) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = chord.type || "triangle";
      osc.frequency.setValueAtTime(chord.freq, now + chord.time);

      const targetVol = chord.volume !== undefined ? chord.volume : 0.15;
      
      // Gentle fade in & out for accompaniment pads
      gainNode.gain.setValueAtTime(0, now + chord.time);
      gainNode.gain.linearRampToValueAtTime(targetVol, now + chord.time + 0.5);
      gainNode.gain.setValueAtTime(targetVol, now + chord.time + chord.duration - 0.5);
      gainNode.gain.linearRampToValueAtTime(0, now + chord.time + chord.duration);

      osc.connect(gainNode);
      gainNode.connect(mainGain);

      osc.start(now + chord.time);
      osc.stop(now + chord.time + chord.duration);
      scheduledOscillators.push(osc);
    });

    // 2. Schedule Lead Vocal / Melody Notes
    selectedSong.melody.forEach((note) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Lead voice uses a sweet, vibrating sine or triangle wave
      osc.type = note.type || "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      // Add a subtle touch of vibrato to make it sound like human singing
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.setValueAtTime(6.5, now + note.time); // 6.5 Hz vibrato rate
      vibratoGain.gain.setValueAtTime(note.freq * 0.015, now + note.time); // pitch depth

      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);

      const targetVol = note.volume !== undefined ? note.volume : 0.25;

      // Singing envelope: fast attack, slight decay, sustain, fast release
      gainNode.gain.setValueAtTime(0, now + note.time);
      gainNode.gain.linearRampToValueAtTime(targetVol, now + note.time + 0.08); // Expressive attack
      gainNode.gain.setValueAtTime(targetVol, now + note.time + note.duration - 0.08);
      gainNode.gain.linearRampToValueAtTime(0, now + note.time + note.duration);

      osc.connect(gainNode);
      gainNode.connect(mainGain);

      vibrato.start(now + note.time);
      vibrato.stop(now + note.time + note.duration);
      scheduledOscillators.push(vibrato);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration);
      scheduledOscillators.push(osc);
    });

    activeNodesRef.current = scheduledOscillators;

    // Track active position
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 0.1;
      setCurrentTime(elapsed);

      // Stop once song completes
      if (elapsed >= selectedSong.duration) {
        stopSong();
      }
    }, 100);
  };

  // Automatically clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      activeNodesRef.current.forEach((node) => {
        try {
          node.stop();
        } catch (e) {}
      });
    };
  }, []);

  return {
    currentSong,
    isPlaying,
    currentTime,
    playSong,
    stopSong,
  };
}
