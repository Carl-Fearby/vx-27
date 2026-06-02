"use client";

import { useEffect, useState } from "react";
import AudioSpectrumViz from "@/components/AudioSpectrumViz";

const SKELETON_BARS = 20;

function LoadingAudioVizSkeleton() {
  return (
    <div className="loadingAudioVizSkeleton" aria-hidden="true">
      <div className="loadingAudioVizSkeletonBars">
        {Array.from({ length: SKELETON_BARS }, (_, i) => (
          <span
            key={i}
            className="loadingAudioVizSkeletonBar"
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoadingAudioViz({
  getAnalyser,
  getBeatAnalyser,
  isMusicPreloaded,
  isLoadingMusicPlaying,
  musicEnabled = true,
  onMusicEnabledChange,
  active = true,
  showToggle = true,
  showVisualizer = true,
  className = "",
  resetKey = "loading",
}) {
  const [vizLive, setVizLive] = useState(false);
  const vizEnabled = showToggle ? musicEnabled : true;

  useEffect(() => {
    if (!showVisualizer || !active || !vizEnabled) {
      setVizLive(false);
      return;
    }

    let rafId = 0;
    const tick = () => {
      const live =
        !!isMusicPreloaded?.() &&
        !!getAnalyser?.() &&
        !!isLoadingMusicPlaying?.();
      setVizLive((prev) => (prev === live ? prev : live));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    showVisualizer,
    active,
    vizEnabled,
    getAnalyser,
    isMusicPreloaded,
    isLoadingMusicPlaying,
  ]);

  return (
    <div className={`loadingAudioBar${className ? ` ${className}` : ""}`}>
      {showToggle ? (
        <div className="loadingAudioVizHeader">
          <label className="loadingMusicToggle">
            <input
              type="checkbox"
              checked={musicEnabled}
              onChange={(e) => {
                e.stopPropagation();
                onMusicEnabledChange?.(e.target.checked);
              }}
            />
            Music
          </label>
        </div>
      ) : null}
      {showVisualizer ? (
        <div className="loadingAudioVizWrap">
          {vizLive ? (
            <AudioSpectrumViz
              getAnalyser={getAnalyser}
              getBeatAnalyser={getBeatAnalyser}
              musicEnabled={vizEnabled}
              active={active}
              resetKey={resetKey}
              canvasClassName="loadingAudioViz"
              synthFallback={false}
            />
          ) : vizEnabled ? (
            <LoadingAudioVizSkeleton />
          ) : (
            <div className="loadingAudioVizIdle" aria-hidden="true" />
          )}
        </div>
      ) : null}
    </div>
  );
}
