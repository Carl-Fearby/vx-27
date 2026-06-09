"use client";

import LoadingAudioViz from "@/components/LoadingAudioViz";
import { MUSIC_TRACKS } from "@/lib/audio/Sound.js";
import { trackUsageLabel } from "@/lib/audio/MusicTrackMeta.js";

/**
 * @param {{
 *   soundsRef: import("react").RefObject<{
 *     getLoadingAnalyser?: () => unknown,
 *     getLoadingBeatAnalyser?: () => unknown,
 *     isMusicPreloaded?: () => boolean,
 *     isLoadingMusicPlaying?: () => boolean,
 *   } | null>,
 *   activeTrackId: string,
 *   onTrackSelect: (trackId: string) => void,
 *   onClose?: () => void,
 *   modal?: boolean,
 *   showDismissHint?: boolean,
 * }} props
 */
export default function MusicTrackPlayer({
  soundsRef,
  activeTrackId,
  onTrackSelect,
  onClose,
  modal = true,
  showDismissHint = true,
}) {
  const inner = (
    <div className="creditsTrackPlayerInner" onClick={(e) => e.stopPropagation()}>
      <div className="creditsTrackPlayerViz" aria-hidden>
        <LoadingAudioViz
          showToggle={false}
          getAnalyser={() => soundsRef.current?.getLoadingAnalyser()}
          getBeatAnalyser={() => soundsRef.current?.getLoadingBeatAnalyser()}
          isMusicPreloaded={() => soundsRef.current?.isMusicPreloaded()}
          isLoadingMusicPlaying={() => soundsRef.current?.isLoadingMusicPlaying()}
          resetKey={activeTrackId}
        />
      </div>
      <div className="creditsTrackPlayerPanel">
        <p className="creditsTrackPlayerLabel">Soundtrack</p>
        {showDismissHint && modal ? (
          <p className="creditsTrackPlayerDismiss">Click outside · M · or Esc to close</p>
        ) : null}
        <ul className="creditsTrackList">
          {MUSIC_TRACKS.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                className={`creditsTrackBtn${activeTrackId === track.id ? " creditsTrackBtn--active" : ""}`}
                onClick={() => onTrackSelect(track.id)}
                aria-current={activeTrackId === track.id ? "true" : undefined}
              >
                <span className="creditsTrackBtnLabel">{track.label}</span>
                <span className="creditsTrackBtnMeta">{trackUsageLabel(track.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  if (!modal) {
    return <div className="musicTrackPlayerInline">{inner}</div>;
  }

  return (
    <div
      className="creditsTrackPlayer"
      onClick={(e) => {
        e.stopPropagation();
        onClose?.();
      }}
    >
      {inner}
    </div>
  );
}
