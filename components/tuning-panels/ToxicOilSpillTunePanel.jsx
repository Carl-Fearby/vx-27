"use client";

import { createPortal } from "react-dom";
import {
  DEFAULT_TOXIC_OIL_SPILL_TUNING,
  formatToxicOilSpillTuningJson,
  saveToxicOilSpillTuning,
  TOXIC_OIL_SPILL_TUNING_LIMITS,
} from "@/lib/oil-barrel/ToxicOilSpillTuning";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  nudgeStep = step,
  decimals = 3,
  onChange,
}) {
  const apply = (next) => onChange(clamp(next, min, max));
  const display = parseFloat(Number(value).toFixed(decimals));

  return (
    <div className="poseControl">
      <span className="sliderLabel">
        {label} <output>{display.toFixed(decimals)}</output>
      </span>
      <input
        type="range"
        className="poseRange"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => apply(parseFloat(e.target.value))}
      />
      <div className="poseNudgeRow">
        <button
          type="button"
          className="poseNudgeBtn"
          aria-label={`Decrease ${label}`}
          onClick={() => apply(value - nudgeStep)}
        >
          −
        </button>
        <input
          type="number"
          className="poseNumber"
          min={min}
          max={max}
          step={step}
          value={display}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!Number.isNaN(parsed)) apply(parsed);
          }}
        />
        <button
          type="button"
          className="poseNudgeBtn"
          aria-label={`Increase ${label}`}
          onClick={() => apply(value + nudgeStep)}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   tuning: import("@/lib/oil-barrel/ToxicOilSpillTuning.js").ToxicOilSpillTuning,
 *   onChange: (next: import("@/lib/oil-barrel/ToxicOilSpillTuning.js").ToxicOilSpillTuning) => void,
 *   onClose?: () => void,
 * }} props
 */
export default function ToxicOilSpillTunePanel({ tuning, onChange, onClose }) {
  const lim = TOXIC_OIL_SPILL_TUNING_LIMITS;
  const patch = (partial) => onChange({ ...tuning, ...partial });

  const panel = (
    <aside
      className="weaponTunePanel toxicOilSpillTunePanel"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="weaponTunePanelHeader">
        <div className="tunePanelHeader">
          <strong>Toxic oil spill</strong>
          {onClose ? (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close toxic oil spill tuning"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="weaponTunePanelScroll">
        <p className="settingsHint">
          Floor decal under the container barrel pile. Close settings and walk
          the arena — position and scale update live.
        </p>
        <p className="settingsGroupLabel">Position</p>
        <SliderField
          label="X"
          value={tuning.x}
          min={lim.x.min}
          max={lim.x.max}
          step={lim.x.step}
          nudgeStep={lim.x.nudge}
          onChange={(x) => patch({ x })}
        />
        <SliderField
          label="Z"
          value={tuning.z}
          min={lim.z.min}
          max={lim.z.max}
          step={lim.z.step}
          nudgeStep={lim.z.nudge}
          onChange={(z) => patch({ z })}
        />
        <SliderField
          label="Rotation Y"
          value={tuning.rotationY}
          min={lim.rotationY.min}
          max={lim.rotationY.max}
          step={lim.rotationY.step}
          nudgeStep={lim.rotationY.nudge}
          decimals={4}
          onChange={(rotationY) => patch({ rotationY })}
        />
        <SliderField
          label="Floor lift"
          value={tuning.yOffset}
          min={lim.yOffset.min}
          max={lim.yOffset.max}
          step={lim.yOffset.step}
          nudgeStep={lim.yOffset.nudge}
          decimals={4}
          onChange={(yOffset) => patch({ yOffset })}
        />
        <p className="settingsGroupLabel">Size</p>
        <SliderField
          label="Width (X)"
          value={tuning.scaleX}
          min={lim.scaleX.min}
          max={lim.scaleX.max}
          step={lim.scaleX.step}
          nudgeStep={lim.scaleX.nudge}
          onChange={(scaleX) => patch({ scaleX })}
        />
        <SliderField
          label="Depth (Z)"
          value={tuning.scaleZ}
          min={lim.scaleZ.min}
          max={lim.scaleZ.max}
          step={lim.scaleZ.step}
          nudgeStep={lim.scaleZ.nudge}
          onChange={(scaleZ) => patch({ scaleZ })}
        />
        <p className="settingsGroupLabel">Look</p>
        <SliderField
          label="Emissive"
          value={tuning.emissiveIntensity}
          min={lim.emissiveIntensity.min}
          max={lim.emissiveIntensity.max}
          step={lim.emissiveIntensity.step}
          nudgeStep={lim.emissiveIntensity.nudge}
          decimals={2}
          onChange={(emissiveIntensity) => patch({ emissiveIntensity })}
        />
        <SliderField
          label="Opacity"
          value={tuning.opacity}
          min={lim.opacity.min}
          max={lim.opacity.max}
          step={lim.opacity.step}
          nudgeStep={lim.opacity.nudge}
          decimals={2}
          onChange={(opacity) => patch({ opacity })}
        />
      </div>
      <div className="weaponTunePanelFooter">
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            const next = { ...DEFAULT_TOXIC_OIL_SPILL_TUNING };
            onChange(next);
            saveToxicOilSpillTuning(next);
          }}
        >
          Reset defaults
        </button>
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            navigator.clipboard?.writeText(formatToxicOilSpillTuningJson(tuning));
          }}
        >
          Copy JSON
        </button>
      </div>
    </aside>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}
