"use client";

import { useEffect, useRef, useState } from "react";

/** @typedef {'auto' | 'burst' | 'single'} FireMode */

const MODE_ARIA = {
  auto: "Automatic fire",
  burst: "Burst fire",
  single: "Semi-automatic fire",
};

/** @param {FireMode[]} modes @param {FireMode} from @param {FireMode} to */
function slideDirection(modes, from, to) {
  if (from === to) return "next";
  const fromIdx = modes.indexOf(from);
  const toIdx = modes.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return "next";
  const forward = (toIdx - fromIdx + modes.length) % modes.length;
  return forward === 1 ? "next" : "prev";
}

function FireModeBulletIcon() {
  return (
    <span className="hudFireCarouselBulletPair" aria-hidden>
      <img
        src="/ui/bullet_selected.webp"
        alt=""
        className="hudFireCarouselBullet hudFireCarouselBulletDay"
      />
      <img
        src="/ui/bullet.webp"
        alt=""
        className="hudFireCarouselBullet hudFireCarouselBulletNight"
      />
    </span>
  );
}

/** @param {{ mode: FireMode }} props */
function FireModeGlyph({ mode }) {
  if (mode === "burst") {
    return (
      <span className="hudFireCarouselBullets" aria-hidden>
        <FireModeBulletIcon />
        <FireModeBulletIcon />
        <FireModeBulletIcon />
      </span>
    );
  }
  return (
    <span className="hudFireCarouselBullets" aria-hidden>
      <FireModeBulletIcon />
      {mode === "auto" ? <span className="hudFireCarouselTag">A</span> : null}
    </span>
  );
}

/**
 * Active fire mode only — slides in on change; C / click cycles via parent.
 * @param {{
 *   modes: FireMode[],
 *   activeMode: FireMode,
 *   onCycle: () => void,
 * }} props
 */
export default function HudFireModeCarousel({ modes, activeMode, onCycle }) {
  const prevModeRef = useRef(activeMode);
  const [slideDir, setSlideDir] = useState(/** @type {'next' | 'prev' | null} */ (null));

  useEffect(() => {
    if (activeMode === prevModeRef.current) return;
    setSlideDir(slideDirection(modes, prevModeRef.current, activeMode));
    prevModeRef.current = activeMode;
  }, [activeMode, modes]);

  if (!modes?.length) return null;

  return (
    <div className="hudFireCarousel" role="group" aria-label="Fire mode">
      <button
        type="button"
        className="hudFireCarouselSlot hudFireCarouselSlotCenter"
        aria-label={`${MODE_ARIA[activeMode]} (press C to cycle)`}
        onClick={onCycle}
      >
        <span className="hudFireCarouselViewport" aria-hidden>
          <span
            key={activeMode}
            className={
              slideDir
                ? `hudFireCarouselSlide hudFireCarouselSlide--${slideDir}`
                : "hudFireCarouselSlide"
            }
          >
            <FireModeGlyph mode={activeMode} />
          </span>
        </span>
      </button>
    </div>
  );
}
