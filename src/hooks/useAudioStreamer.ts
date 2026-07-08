/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from "react";
import { float32ToInt16, bufferToBase64 } from "../utils/audio";

interface UseAudioStreamerProps {
  socket: WebSocket | null;
  isActive: boolean;
  onVolumeUpdate?: (volume: number) => void;
  /** Specific microphone device ID, or null/undefined for the system default. */
  microphoneId?: string | null;
}

export function useAudioStreamer({ socket, isActive, onVolumeUpdate, microphoneId }: UseAudioStreamerProps) {
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!isActive || !socket) {
      stopStreaming();
      return;
    }

    async function startStreaming() {
      try {
        setError(null);
        
        // Get microphone stream with echo cancellation and noise suppression
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        // If a specific microphone is selected, use it
        if (microphoneId) {
          audioConstraints.deviceId = { exact: microphoneId };
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        streamRef.current = stream;

        // Create an AudioContext locked at 16kHz for Gemini input
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000,
        });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        // Create ScriptProcessor to capture audio buffers (4096 samples, 1 input channel, 1 output channel)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate RMS volume for visualizer / VAD
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          if (onVolumeUpdate) {
            onVolumeUpdate(rms);
          }

          // Convert Float32 samples (-1.0 to 1.0) to 16-bit PCM Int16
          const pcmData = float32ToInt16(inputData);

          // Convert Int16 buffer to Base64 and send
          const base64Audio = bufferToBase64(pcmData);
          socket.send(JSON.stringify({ type: "audio", data: base64Audio }));
        };

        // Connect the nodes
        source.connect(processor);
        processor.connect(audioContext.destination);
      } catch (err: any) {
        console.error("Error accessing microphone:", err);
        setError(err.message || "Microphone access denied. Please verify permissions.");
      }
    }

    startStreaming();

    return () => {
      stopStreaming();
    };
  }, [isActive, socket, microphoneId]);

  function stopStreaming() {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {}
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch((e) => console.error("Error closing AudioContext:", e));
      }
      audioContextRef.current = null;
    }
    if (onVolumeUpdate) {
      onVolumeUpdate(0);
    }
  }

  return { error };
}
