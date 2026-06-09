"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import * as THREE from "three";
import MusicTrackPlayer from "@/components/MusicTrackPlayer";
import {
  createSoundManager,
  DEFAULT_LOADING_TRACK_ID,
  MUSIC_TRACKS,
} from "@/lib/audio/Sound.js";
import { trackTagline, trackUsageLabel } from "@/lib/audio/MusicTrackMeta.js";

export default function GameMusicPage() {
  const soundsRef = useRef(null);
  const [activeTrackId, setActiveTrackId] = useState(DEFAULT_LOADING_TRACK_ID);

  useEffect(() => {
    const camera = new THREE.PerspectiveCamera();
    const sounds = createSoundManager(camera);
    soundsRef.current = sounds;

    let cancelled = false;
    sounds.preload().then(() => {
      if (cancelled) return;
      sounds.resume();
      sounds.startLoadingMusic({ trackId: DEFAULT_LOADING_TRACK_ID });
    });

    return () => {
      cancelled = true;
      sounds.dispose();
      soundsRef.current = null;
    };
  }, []);

  const handleTrackSelect = useCallback((trackId) => {
    setActiveTrackId(trackId);
    const s = soundsRef.current;
    if (!s) return;
    s.resume();
    s.setLoadingTrack(trackId);
    if (!s.isLoadingMusicPlaying()) {
      s.startLoadingMusic({ trackId });
    }
  }, []);

  const activeTrack =
    MUSIC_TRACKS.find((track) => track.id === activeTrackId) ?? MUSIC_TRACKS[0];

  return (
    <div className="musicRoot">
      <div className="musicGrid" aria-hidden />
      <div className="musicVignette" aria-hidden />

      <header className="musicNav">
        <Link href="/" className="musicNavBrand">
          <Image
            src="/ui/logo.png"
            alt="VX-27 home"
            width={120}
            height={42}
            className="musicNavLogo"
            priority
          />
        </Link>
        <nav className="musicNavLinks" aria-label="Music page">
          <Link href="/">Home</Link>
          <Link href="/credits">Credits</Link>
          <Link href="/version">Version</Link>
          <Link href="/game" className="musicNavPlay">
            Play
          </Link>
        </nav>
      </header>

      <main className="musicMain">
        <div className="musicIntro">
          <p className="musicKicker">Original soundtrack</p>
          <h1 className="musicTitle">VX-27 Audio</h1>
          <p className="musicDeck">
            Pick a track below to preview. Full gag credits live on the credits roll.
          </p>
        </div>

        <MusicTrackPlayer
          soundsRef={soundsRef}
          activeTrackId={activeTrackId}
          onTrackSelect={handleTrackSelect}
          modal={false}
          showDismissHint={false}
        />

        <div className="musicNowPlaying" aria-live="polite">
          <p className="musicNowPlayingLabel">Now playing</p>
          <p className="musicNowPlayingTitle">{activeTrack.label}</p>
          <p className="musicNowPlayingUsage">{trackUsageLabel(activeTrack.id)}</p>
          <p className="musicNowPlayingTagline">{trackTagline(activeTrack.id)}</p>
        </div>
      </main>
    </div>
  );
}
