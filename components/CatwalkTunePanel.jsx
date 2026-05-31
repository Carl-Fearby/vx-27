"use client";

import {
  ROOM_CATWALK_MOUTH_PAD_MIN,
  ROOM_CATWALK_MOUTH_PAD_MAX,
  ROOM_CATWALK_MOUTH_PAD_STEP,
} from "@/lib/RoomCatwalkTuning";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function CatwalkTunePanel({
  catwalkDeckY,
  mouthPad,
  onMouthPadChange,
  onClose,
}) {
  const apply = (next) =>
    onMouthPadChange(
      clamp(next, ROOM_CATWALK_MOUTH_PAD_MIN, ROOM_CATWALK_MOUTH_PAD_MAX)
    );

  return (
    <aside className="posePanel posePanelCatwalk" aria-label="Catwalk tuning">
      <div className="posePanelHeader">
        <h2 className="posePanelTitle">Catwalk tuning</h2>
        <button type="button" className="posePanelClose" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="posePanelHint">
        Catwalk deck Y: {catwalkDeckY?.toFixed(2) ?? "—"} m
      </p>
      <div className="poseControl">
        <span className="sliderLabel">
          Room mouth overhang{" "}
          <output>{mouthPad.toFixed(2)} m</output>
        </span>
        <input
          type="range"
          className="poseRange"
          min={ROOM_CATWALK_MOUTH_PAD_MIN}
          max={ROOM_CATWALK_MOUTH_PAD_MAX}
          step={ROOM_CATWALK_MOUTH_PAD_STEP}
          value={mouthPad}
          onChange={(e) => apply(parseFloat(e.target.value))}
        />
        <div className="poseNudgeRow">
          <button
            type="button"
            className="poseNudgeBtn"
            aria-label="Decrease mouth overhang"
            onClick={() => apply(mouthPad - ROOM_CATWALK_MOUTH_PAD_STEP)}
          >
            −
          </button>
          <input
            type="number"
            className="poseNumber"
            min={ROOM_CATWALK_MOUTH_PAD_MIN}
            max={ROOM_CATWALK_MOUTH_PAD_MAX}
            step={ROOM_CATWALK_MOUTH_PAD_STEP}
            value={parseFloat(mouthPad.toFixed(3))}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              if (!Number.isNaN(parsed)) apply(parsed);
            }}
          />
          <button
            type="button"
            className="poseNudgeBtn"
            aria-label="Increase mouth overhang"
            onClick={() => apply(mouthPad + ROOM_CATWALK_MOUTH_PAD_STEP)}
          >
            +
          </button>
        </div>
      </div>
    </aside>
  );
}
