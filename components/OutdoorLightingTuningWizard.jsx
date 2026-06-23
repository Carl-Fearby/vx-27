"use client";

import {
  DEFAULT_HEMI_DAY,
  HEMI_INTENSITY_MAX,
  HEMI_INTENSITY_MIN,
  HEMI_INTENSITY_STEP,
  HEMI_TEMPERATURE_MAX,
  HEMI_TEMPERATURE_MIN,
  HEMI_TEMPERATURE_STEP,
} from "@/lib/lighting/HemisphereTuning.js";
import {
  DEFAULT_OUTDOOR_LIGHTING,
  formatOutdoorLightingForCopy,
} from "@/lib/lighting/OutdoorLightingTuning.js";
import {
  SHELTERED_HEMI_MUL_MAX,
  SHELTERED_HEMI_MUL_MIN,
  SHELTERED_HEMI_MUL_STEP,
  SUN_INTENSITY_MAX,
  SUN_INTENSITY_MIN,
  SUN_INTENSITY_STEP,
  SUN_TEMPERATURE_MAX,
  SUN_TEMPERATURE_MIN,
  SUN_TEMPERATURE_STEP,
} from "@/lib/lighting/SunLightTuning.js";

const SUN_SLIDERS = [
  {
    key: "sunIntensity",
    label: "Sun intensity",
    min: SUN_INTENSITY_MIN,
    max: SUN_INTENSITY_MAX,
    step: SUN_INTENSITY_STEP,
    decimals: 2,
    suffix: "",
  },
  {
    key: "sunTemperature",
    label: "Sun temperature",
    min: SUN_TEMPERATURE_MIN,
    max: SUN_TEMPERATURE_MAX,
    step: SUN_TEMPERATURE_STEP,
    decimals: 0,
    suffix: "K",
  },
];

const HEMI_SLIDERS = [
  {
    key: "temperature",
    label: "Hemi temperature",
    min: HEMI_TEMPERATURE_MIN,
    max: HEMI_TEMPERATURE_MAX,
    step: HEMI_TEMPERATURE_STEP,
    decimals: 0,
    suffix: "K",
  },
  {
    key: "intensity",
    label: "Hemi intensity",
    min: HEMI_INTENSITY_MIN,
    max: HEMI_INTENSITY_MAX,
    step: HEMI_INTENSITY_STEP,
    decimals: 2,
    suffix: "",
  },
];

export default function OutdoorLightingTuningWizard({ tuning, onChange, onClose }) {
  function patchHemiDay(patch) {
    onChange({
      hemiDay: { ...tuning.hemiDay, ...patch },
    });
  }

  return (
    <aside
      className="hudTunePanel enemyRigTunePanel"
      role="dialog"
      aria-labelledby="outdoor-lighting-wizard-title"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="hudTuneHeader">
        <span id="outdoor-lighting-wizard-title">Outdoor lighting wizard</span>
        <button
          type="button"
          className="hudTuneClose"
          aria-label="Close outdoor lighting wizard"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="hudTuneBody">
        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">Sun (directional)</span>
          {SUN_SLIDERS.map((field) => (
            <label className="hudTuneRow" key={field.key}>
              <span>{field.label}</span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={tuning[field.key]}
                onChange={(event) => onChange({
                  [field.key]: parseFloat(event.target.value),
                })}
              />
              <output className="hudTuneVal">
                {tuning[field.key].toFixed(field.decimals)}{field.suffix}
              </output>
            </label>
          ))}
        </div>

        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">Hemisphere (day fill)</span>
          {HEMI_SLIDERS.map((field) => (
            <label className="hudTuneRow" key={field.key}>
              <span>{field.label}</span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={tuning.hemiDay[field.key]}
                onChange={(event) => patchHemiDay({
                  [field.key]: parseFloat(event.target.value),
                })}
              />
              <output className="hudTuneVal">
                {tuning.hemiDay[field.key].toFixed(field.decimals)}{field.suffix}
              </output>
            </label>
          ))}
          <label className="hudTuneRow">
            <span>Sheltered hemi scale</span>
            <input
              type="range"
              min={SHELTERED_HEMI_MUL_MIN}
              max={SHELTERED_HEMI_MUL_MAX}
              step={SHELTERED_HEMI_MUL_STEP}
              value={tuning.shelteredHemiMul}
              onChange={(event) => onChange({
                shelteredHemiMul: parseFloat(event.target.value),
              })}
            />
            <output className="hudTuneVal">
              {tuning.shelteredHemiMul.toFixed(2)}×
            </output>
          </label>
        </div>
      </div>

      <div className="enemyRigTuneActions">
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => onChange({
            hemiDay: { ...DEFAULT_HEMI_DAY },
          })}
        >
          Reset hemi
        </button>
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => onChange({ ...DEFAULT_OUTDOOR_LIGHTING, hemiDay: { ...DEFAULT_OUTDOOR_LIGHTING.hemiDay } })}
        >
          Reset all
        </button>
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => navigator.clipboard?.writeText(
            formatOutdoorLightingForCopy(tuning),
          )}
        >
          Copy JSON
        </button>
      </div>
    </aside>
  );
}
