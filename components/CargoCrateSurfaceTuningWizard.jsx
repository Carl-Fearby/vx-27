"use client";

import {
  DEFAULT_VX27_CONTAINER_MATERIAL_TUNING,
  formatVx27ContainerMaterialTuningForCopy,
  VX27_CONTAINER_MATERIAL_LIMITS,
} from "@/lib/vx27-container/Vx27ContainerMaterialTuning.js";

const GROUPS = [
  {
    label: "Exterior shell",
    keys: [
      "exteriorBrightness",
      "exteriorRoughness",
      "exteriorMetalness",
      "exteriorEmissiveIntensity",
    ],
  },
  {
    label: "Interior surfaces",
    keys: [
      "interiorBrightness",
      "interiorRoughness",
      "interiorMetalness",
      "interiorEmissiveIntensity",
    ],
  },
  {
    label: "Corner bevels",
    keys: [
      "cornerBevelBrightness",
      "cornerBevelRoughness",
      "cornerBevelMetalness",
      "cornerBevelUvRepeatU",
      "cornerBevelUvRepeatV",
    ],
  },
  {
    label: "Texture scale",
    keys: [
      "normalScale",
      "endcapTextureScale",
      "doorTextureScale",
      "roofFloorFootprintScale",
      "roofFloorUvRepeatU",
      "roofFloorUvRepeatV",
    ],
  },
];

const LABELS = {
  exteriorBrightness: "Brightness",
  exteriorRoughness: "Roughness",
  exteriorMetalness: "Metalness",
  exteriorEmissiveIntensity: "Emissive",
  interiorBrightness: "Brightness",
  interiorRoughness: "Roughness",
  interiorMetalness: "Metalness",
  interiorEmissiveIntensity: "Emissive",
  cornerBevelBrightness: "Brightness",
  cornerBevelRoughness: "Roughness",
  cornerBevelMetalness: "Metalness",
  cornerBevelUvRepeatU: "UV repeat U",
  cornerBevelUvRepeatV: "UV repeat V",
  normalScale: "Normal scale",
  endcapTextureScale: "Endcap scale",
  doorTextureScale: "Door scale",
  roofFloorFootprintScale: "Roof/floor footprint",
  roofFloorUvRepeatU: "Roof/floor UV U",
  roofFloorUvRepeatV: "Roof/floor UV V",
};

function sliderDecimals(step) {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

export default function CargoCrateSurfaceTuningWizard({ tuning, onChange, onClose }) {
  return (
    <aside
      className="hudTunePanel enemyRigTunePanel"
      role="dialog"
      aria-labelledby="cargo-crate-surface-wizard-title"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="hudTuneHeader">
        <span id="cargo-crate-surface-wizard-title">Cargo crate surfaces</span>
        <button
          type="button"
          className="hudTuneClose"
          aria-label="Close cargo crate surface wizard"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="hudTuneBody">
        {GROUPS.map((group) => (
          <div className="hudTuneGroup" key={group.label}>
            <span className="hudTuneGroupLabel">{group.label}</span>
            {group.keys.map((key) => {
              const limits = VX27_CONTAINER_MATERIAL_LIMITS[key];
              const value = tuning[key];
              const decimals = sliderDecimals(limits.step);
              return (
                <label className="hudTuneRow" key={key}>
                  <span>{LABELS[key]}</span>
                  <input
                    type="range"
                    min={limits.min}
                    max={limits.max}
                    step={limits.step}
                    value={value}
                    onChange={(event) => onChange({
                      [key]: parseFloat(event.target.value),
                    })}
                  />
                  <output className="hudTuneVal">
                    {value.toFixed(decimals)}
                  </output>
                </label>
              );
            })}
          </div>
        ))}
      </div>

      <div className="enemyRigTuneActions">
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => onChange({ ...DEFAULT_VX27_CONTAINER_MATERIAL_TUNING })}
        >
          Reset all
        </button>
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => navigator.clipboard?.writeText(
            formatVx27ContainerMaterialTuningForCopy(tuning),
          )}
        >
          Copy JSON
        </button>
      </div>
    </aside>
  );
}
