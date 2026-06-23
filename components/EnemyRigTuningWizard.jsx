"use client";

import {
  DEFAULT_ENEMY_RIG_IDLE,
  DEFAULT_ENEMY_RIG_MATERIAL,
  DEFAULT_ENEMY_RIG_MUZZLE,
  DEFAULT_ENEMY_RIG_TUNING,
  DEFAULT_ENEMY_RIG_WALK,
  ENEMY_RIG_MATERIAL_LIMITS,
  ENEMY_RIG_MUZZLE_LIMITS,
  ENEMY_RIG_TUNING_LIMITS,
  formatEnemyRigTuningForCopy,
} from "@/lib/combat/EnemyRigTuning.js";

const SLIDERS = [
  { key: "positionX", label: "Position X", suffix: "m", decimals: 2 },
  { key: "positionY", label: "Position Y", suffix: "m", decimals: 2 },
  { key: "positionZ", label: "Position Z", suffix: "m", decimals: 2 },
  { key: "rotationX", label: "Pitch X", suffix: "°", decimals: 0 },
  { key: "rotationY", label: "Facing Y", suffix: "°", decimals: 0 },
  { key: "rotationZ", label: "Roll Z", suffix: "°", decimals: 0 },
];

const MUZZLE_SLIDERS = [
  { key: "x", label: "Laser origin X", suffix: "×H", decimals: 3 },
  { key: "y", label: "Laser origin Y", suffix: "×H", decimals: 3 },
  { key: "z", label: "Laser origin Z", suffix: "×H", decimals: 3 },
];

const MATERIAL_SLIDERS = [
  { key: "brightness", label: "Brightness", suffix: "×", decimals: 2 },
  { key: "accentGlow", label: "Accent glow (night)", suffix: "", decimals: 1 },
  { key: "emissiveFill", label: "Emissive fill", suffix: "", decimals: 2 },
  { key: "metalness", label: "Metalness", suffix: "", decimals: 2 },
  { key: "roughness", label: "Roughness", suffix: "", decimals: 2 },
];

export default function EnemyRigTuningWizard({ tuning, onChange, onClose }) {
  const editingWalk = tuning.previewAnimation;
  const activePose = editingWalk ? tuning.walk : tuning.idle;
  const activeModeLabel = editingWalk ? "walking" : "stationary";

  function patchActivePose(patch) {
    const mode = editingWalk ? "walk" : "idle";
    onChange({
      [mode]: { ...tuning[mode], ...patch },
    });
  }

  function resetActivePose() {
    const mode = editingWalk ? "walk" : "idle";
    onChange({
      [mode]: editingWalk
        ? { ...DEFAULT_ENEMY_RIG_WALK }
        : { ...DEFAULT_ENEMY_RIG_IDLE },
    });
  }

  function patchMaterial(patch) {
    onChange({
      material: { ...tuning.material, ...patch },
    });
  }

  function patchMuzzle(patch) {
    onChange({
      muzzle: { ...tuning.muzzle, ...patch },
    });
  }

  return (
    <aside
      className="hudTunePanel enemyRigTunePanel"
      role="dialog"
      aria-labelledby="enemy-rig-wizard-title"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="hudTuneHeader">
        <span id="enemy-rig-wizard-title">Rifle enemy rig wizard</span>
        <button
          type="button"
          className="hudTuneClose"
          aria-label="Close enemy rig wizard"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="hudTuneBody">
        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">Safety and preview</span>
          <label className="hudTuneRow">
            <input
              type="checkbox"
              checked={tuning.damageEnabled}
              onChange={(event) => onChange({ damageEnabled: event.target.checked })}
            />
            Enemy damage enabled
          </label>
          <label className="hudTuneRow">
            <input
              type="checkbox"
              checked={tuning.previewAnimation}
              onChange={(event) => onChange({ previewAnimation: event.target.checked })}
            />
            Preview walk in place
          </label>
          <label className="hudTuneRow">
            <input
              type="checkbox"
              checked={tuning.previewReverse}
              disabled={!tuning.previewAnimation}
              onChange={(event) => onChange({ previewReverse: event.target.checked })}
            />
            Reverse preview
          </label>
        </div>

        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">
            {`Model transform (${activeModeLabel})`}
          </span>
          {SLIDERS.map((field) => {
            const limits = ENEMY_RIG_TUNING_LIMITS[field.key];
            const value = activePose[field.key];
            return (
              <label className="hudTuneRow" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="range"
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={value}
                  onChange={(event) => patchActivePose({
                    [field.key]: parseFloat(event.target.value),
                  })}
                />
                <output className="hudTuneVal">
                  {value.toFixed(field.decimals)}{field.suffix}
                </output>
              </label>
            );
          })}
        </div>

        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">
            Laser blast origin (× target height) — orange markers on enemies
          </span>
          {MUZZLE_SLIDERS.map((field) => {
            const limits = ENEMY_RIG_MUZZLE_LIMITS[field.key];
            const value = tuning.muzzle[field.key];
            return (
              <label className="hudTuneRow" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="range"
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={value}
                  onChange={(event) => patchMuzzle({
                    [field.key]: parseFloat(event.target.value),
                  })}
                />
                <output className="hudTuneVal">
                  {value.toFixed(field.decimals)}{field.suffix}
                </output>
              </label>
            );
          })}
        </div>

        <div className="hudTuneGroup">
          <span className="hudTuneGroupLabel">Material (PX-27 rig)</span>
          {MATERIAL_SLIDERS.map((field) => {
            const limits = ENEMY_RIG_MATERIAL_LIMITS[field.key];
            const value = tuning.material[field.key];
            return (
              <label className="hudTuneRow" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="range"
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={value}
                  onChange={(event) => patchMaterial({
                    [field.key]: parseFloat(event.target.value),
                  })}
                />
                <output className="hudTuneVal">
                  {value.toFixed(field.decimals)}{field.suffix}
                </output>
              </label>
            );
          })}
        </div>
      </div>

      <div className="enemyRigTuneActions">
        <button
          type="button"
          className="hudTuneReset"
          onClick={resetActivePose}
        >
          Reset pose
        </button>
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => patchMuzzle({ ...DEFAULT_ENEMY_RIG_MUZZLE })}
        >
          Reset laser origin
        </button>
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => patchMaterial({ ...DEFAULT_ENEMY_RIG_MATERIAL })}
        >
          Reset material
        </button>
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => onChange({
            idle: { ...DEFAULT_ENEMY_RIG_TUNING.idle },
            walk: { ...DEFAULT_ENEMY_RIG_TUNING.walk },
            muzzle: { ...DEFAULT_ENEMY_RIG_MUZZLE },
            material: { ...DEFAULT_ENEMY_RIG_MATERIAL },
            previewAnimation: false,
            previewReverse: false,
            damageEnabled: false,
          })}
        >
          Reset all
        </button>
        <button
          type="button"
          className="hudTuneReset"
          onClick={() => navigator.clipboard?.writeText(
            formatEnemyRigTuningForCopy(tuning),
          )}
        >
          Copy JSON
        </button>
      </div>
    </aside>
  );
}
