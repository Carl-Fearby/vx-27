"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CROSSHAIR_TUNING,
  formatCrosshairTuningForCopy,
} from "@/lib/weapons/CrosshairTuning";

const LIMITS = {
  width: { min: 4, max: 3200, step: 1 },
  height: { min: 4, max: 2800, step: 1 },
  offsetX: { min: -3000, max: 3000, step: 1 },
  offsetY: { min: -3000, max: 3000, step: 1 },
  offsetZ: { min: -3000, max: 2000, step: 1 },
  rotX: { min: -180, max: 180, step: 0.5 },
  rotY: { min: -180, max: 180, step: 0.5 },
  rotZ: { min: -180, max: 180, step: 0.5 },
};

const FIELDS = [
  { key: "width", label: "Width", suffix: "px", decimals: 0 },
  { key: "height", label: "Height", suffix: "px", decimals: 0 },
  { key: "offsetX", label: "Offset X", suffix: "px", decimals: 0 },
  { key: "offsetY", label: "Offset Y", suffix: "px", decimals: 0 },
  { key: "offsetZ", label: "Offset Z", suffix: "px", decimals: 0 },
  { key: "rotX", label: "Pitch X", suffix: "°", decimals: 1 },
  { key: "rotY", label: "Yaw Y", suffix: "°", decimals: 1 },
  { key: "rotZ", label: "Roll Z", suffix: "°", decimals: 1 },
];

function keyFor(mode, key) {
  const prefix = mode === "hip" ? "gunHip" : "gunAim";
  if (key === "width") return `${prefix}Width`;
  if (key === "height") return `${prefix}Height`;
  if (key === "offsetX") return `${prefix}OffsetX`;
  if (key === "offsetY") return `${prefix}OffsetY`;
  if (key === "offsetZ") return `${prefix}OffsetZ`;
  if (key === "rotX") return `${prefix}RotX`;
  if (key === "rotY") return `${prefix}RotY`;
  return `${prefix}RotZ`;
}

function clampField(field, value) {
  const limits = LIMITS[field];
  return Math.min(limits.max, Math.max(limits.min, value));
}

export default function RifleReticleTuningWizard({
  tuning,
  onChange,
  onClose,
  onModeChange,
}) {
  const [mode, setMode] = useState("hip");
  const modeLabel = mode === "hip" ? "Hip" : "ADS";

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  function patchField(field, rawValue) {
    const value = clampField(field, Number(rawValue));
    if (!Number.isFinite(value)) return;
    onChange({ [keyFor(mode, field)]: value });
  }

  function resetMode() {
    const patch = {};
    for (const field of FIELDS) {
      const key = keyFor(mode, field.key);
      patch[key] = DEFAULT_CROSSHAIR_TUNING[key];
    }
    onChange(patch);
  }

  return (
    <aside
      className="hudTunePanel enemyRigTunePanel"
      role="dialog"
      aria-labelledby="rifle-reticle-wizard-title"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="hudTuneHeader">
        <span id="rifle-reticle-wizard-title">Rifle reticle wizard</span>
        <button
          type="button"
          className="hudTuneClose"
          aria-label="Close rifle reticle wizard"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="hudTuneBody">
        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">Pose</span>
          <div className="enemyRigTuneActions">
            <button
              type="button"
              className="hudTuneReset"
              onClick={() => setMode("hip")}
              aria-pressed={mode === "hip"}
            >
              Hip
            </button>
            <button
              type="button"
              className="hudTuneReset"
              onClick={() => setMode("ads")}
              aria-pressed={mode === "ads"}
            >
              ADS
            </button>
          </div>
        </div>

        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">{modeLabel} reticle</span>
          {FIELDS.map((field) => {
            const key = keyFor(mode, field.key);
            const value = tuning[key] ?? DEFAULT_CROSSHAIR_TUNING[key] ?? 0;
            const limits = LIMITS[field.key];
            const sliderValue = clampField(field.key, value);
            return (
              <label className="hudTuneRow" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="range"
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={sliderValue}
                  onChange={(event) =>
                    patchField(field.key, Number(event.target.value))
                  }
                />
                <input
                  type="number"
                  className="hudTuneNumber"
                  style={{ width: "4.75rem" }}
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={sliderValue}
                  onChange={(event) =>
                    patchField(field.key, Number(event.target.value))
                  }
                />
              </label>
            );
          })}
        </div>

        <div className="enemyRigTuneActions">
          <button type="button" className="hudTuneReset" onClick={resetMode}>
            Reset {modeLabel}
          </button>
          <button
            type="button"
            className="hudTuneReset"
            onClick={() =>
              navigator.clipboard?.writeText(formatCrosshairTuningForCopy(tuning))
            }
          >
            Copy JSON
          </button>
        </div>

        <p className="hudTuneHint">
          Hip tab: hip pose preview. ADS tab: snaps the rifle to aim-down-sights
          so you can tune the sight reticle live.
        </p>
      </div>
    </aside>
  );
}
