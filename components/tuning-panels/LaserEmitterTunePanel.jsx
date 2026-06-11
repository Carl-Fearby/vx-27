"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_LASER_EMITTER_TUNING,
  formatLaserEmitterTuningForCopy,
  LASER_EMITTER_OFFSET_LIMITS,
  normalizeLaserEmitterOffset,
} from "@/lib/weapons/LaserEmitterTuning";
const OFFSET_STEP = 0.001;
const NUDGE_OFFSET = 0.001;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function OffsetControl({ label, value, min, max, onChange }) {
  const apply = (next) => onChange(clamp(next, min, max));
  const inputDisplay = parseFloat(value.toFixed(4));

  return (
    <div className="poseControl">
      <span className="sliderLabel">
        {label} <output>{value.toFixed(3)}m</output>
      </span>
      <input
        type="range"
        className="poseRange"
        min={min}
        max={max}
        step={OFFSET_STEP}
        value={value}
        onChange={(e) => apply(parseFloat(e.target.value))}
      />
      <div className="poseNudgeRow">
        <button
          type="button"
          className="poseNudgeBtn"
          aria-label={`Decrease ${label}`}
          onClick={() => apply(value - NUDGE_OFFSET)}
        >
          −
        </button>
        <input
          type="number"
          className="poseNumber"
          min={min}
          max={max}
          step={OFFSET_STEP}
          value={inputDisplay}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!Number.isNaN(parsed)) apply(parsed);
          }}
        />
        <button
          type="button"
          className="poseNudgeBtn"
          aria-label={`Increase ${label}`}
          onClick={() => apply(value + NUDGE_OFFSET)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function stopPanelEvent(e) {
  e.stopPropagation();
}

export default function LaserEmitterTunePanel({
  weaponId,
  tuning,
  onWeaponChange,
  onChange,
  onReleasePointer,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = normalizeLaserEmitterOffset(tuning?.[weaponId]);
  const releasePointer = () => onReleasePointer?.();

  const selectWeapon = (id) => {
    releasePointer();
    onWeaponChange(id);
  };

  const updateField = (field, value) => {
    onChange(weaponId, { ...current, [field]: value });
  };

  const copyJson = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    console.log(label, text);
  };

  const handleCopy = () => {
    copyJson(
      formatLaserEmitterTuningForCopy(tuning),
      "Laser emitter tuning:"
    );
  };

  const handleReset = () => {
    onChange(weaponId, DEFAULT_LASER_EMITTER_TUNING[weaponId]);
  };

  const panel = (
    <div
      className="weaponTunePanel laserEmitterTunePanel"
      onMouseDown={(e) => {
        stopPanelEvent(e);
        releasePointer();
      }}
      onClick={stopPanelEvent}
      onWheel={stopPanelEvent}
      onTouchMove={stopPanelEvent}
    >
      <div className="weaponTunePanelHeader">
        <div className="tunePanelHeader">
          <p className="weaponTuneTitle">Laser emitter</p>
          <button
            type="button"
            className="tunePanelClose"
            aria-label="Close laser emitter tuning"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="weaponTuneHint">
          Local offset from the model muzzle. +X moves forward along the barrel,
          +Y moves up, +Z moves sideways. The live beam shows the current
          emitter point.
        </p>
      </div>
      <div className="weaponTuneTabs">
        <button
          type="button"
          className={weaponId === "pistol" ? "weaponTuneTab active" : "weaponTuneTab"}
          onClick={() => selectWeapon("pistol")}
        >
          Pistol
        </button>
        <button
          type="button"
          className={weaponId === "rifle" ? "weaponTuneTab active" : "weaponTuneTab"}
          onClick={() => selectWeapon("rifle")}
        >
          Rifle
        </button>
      </div>
      <div className="weaponTunePanelScroll">
        <p className="settingsGroupLabel">Emitter offset</p>
        <OffsetControl
          label="Local X"
          value={current.x}
          min={LASER_EMITTER_OFFSET_LIMITS.x.min}
          max={LASER_EMITTER_OFFSET_LIMITS.x.max}
          onChange={(v) => updateField("x", v)}
        />
        <OffsetControl
          label="Local Y"
          value={current.y}
          min={LASER_EMITTER_OFFSET_LIMITS.y.min}
          max={LASER_EMITTER_OFFSET_LIMITS.y.max}
          onChange={(v) => updateField("y", v)}
        />
        <OffsetControl
          label="Local Z"
          value={current.z}
          min={LASER_EMITTER_OFFSET_LIMITS.z.min}
          max={LASER_EMITTER_OFFSET_LIMITS.z.max}
          onChange={(v) => updateField("z", v)}
        />
      </div>
      <div className="weaponTunePanelFooter">
        <button type="button" className="settingsBtn" onClick={handleCopy}>
          Copy JSON
        </button>
        <button type="button" className="settingsBtn" onClick={handleReset}>
          Reset {weaponId}
        </button>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
