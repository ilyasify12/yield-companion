import { useEffect, useRef } from "react";
import { SessionState } from "../types";

interface AssistantVideoPlayerProps {
  state: SessionState;
}

export function AssistantVideoPlayer({ state }: AssistantVideoPlayerProps) {
  const idleVideoRef = useRef<HTMLVideoElement | null>(null);
  const thinkingVideoRef = useRef<HTMLVideoElement | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement | null>(null);

  // Map SessionState to video state
  let videoState: "idle" | "thinking" | "talking" = "idle";
  if (state === "speaking") {
    videoState = "talking";
  } else if (state === "connecting" || state === "thinking") {
    videoState = "thinking";
  } else {
    videoState = "idle";
  }

  // Effect to ensure the active video is playing and other videos are synchronized
  useEffect(() => {
    const playVideo = (video: HTMLVideoElement | null) => {
      if (video) {
        video.play().catch((err) => {
          console.warn("[AssistantVideoPlayer] Autoplay blocked or interrupted:", err);
        });
      }
    };

    if (videoState === "talking") {
      playVideo(talkingVideoRef.current);
    } else if (videoState === "thinking") {
      playVideo(thinkingVideoRef.current);
    } else {
      playVideo(idleVideoRef.current);
    }
  }, [videoState]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05060A]/80 flex items-center justify-center transform-gpu will-change-transform select-none">
      {/* 3D illuminated radial background effect placed directly behind character */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 z-[1] pointer-events-none" />
      <div 
        className={`absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,92,255,0.18)_0%,rgba(0,0,0,0)_65%)] transition-opacity duration-700 z-0 pointer-events-none ${
          videoState === "talking" ? "opacity-100 scale-110" : videoState === "thinking" ? "opacity-75" : "opacity-50"
        }`} 
      />

      {/* IDLE VIDEO */}
      <video
        ref={idleVideoRef}
        src="/assets/idle.mp4"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out z-[2] transform-gpu ${
          videoState === "idle" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
      />

      {/* THINKING VIDEO */}
      <video
        ref={thinkingVideoRef}
        src="/assets/thinking.mp4"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out z-[3] transform-gpu ${
          videoState === "thinking" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
      />

      {/* TALKING VIDEO */}
      <video
        ref={talkingVideoRef}
        src="/assets/talking.mp4"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-in-out z-[4] transform-gpu ${
          videoState === "talking" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
      />
    </div>
  );
}
