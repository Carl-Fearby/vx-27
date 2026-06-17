"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_RECOIL_TUNING,
  formatRecoilTuningForCopy,
  RECOIL_TUNING_LIMITS,
} from "@/lib/player/RecoilTuning";

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

function TuningField({ fieldKey, label, tuning, onChange }) {
  const lim = RECOIL_TUNING_LIMITS[fieldKey];
  return (
    <SliderField
      label={label}
      value={tuning[fieldKey]}
      min={lim.min}
      max={lim.max}
      step={lim.step}
      nudgeStep={lim.nudge}
      decimals={lim.decimals}
      onChange={(value) => onChange({ [fieldKey]: value })}
    />
  );
}

function stopPanelEvent(e) {
  e.stopPropagation();
}

/**
 * @param {{
 *   tuning: import("@/lib/player/RecoilTuning.js").RecoilTuning,
 *   onChange: (next: import("@/lib/player/RecoilTuning.js").RecoilTuning) => void,
 *   onReleasePointer?: () => void,
 *   onClose?: () => void,
 * }} props
 */
export default function RecoilTunePanel({
  tuning,
  onChange,
  onReleasePointer,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const patch = (partial) => onChange({ ...tuning, ...partial });

  const handleReset = () => {
    onReleasePointer?.();
    onChange({ ...DEFAULT_RECOIL_TUNING });
  };

  const handleCopy = async () => {
    const text = formatRecoilTuningForCopy(tuning);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    console.log("Recoil tuning:", text);
  };

  const panel = (
    <aside
      className="weaponTunePanel recoilTunePanel"
      onMouseDown={stopPanelEvent}
      onClick={stopPanelEvent}
    >
      <div className="weaponTunePanelHeader">
        <div className="tunePanelHeader">
          <strong>Weapon recoil</strong>
          {onClose ? (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close recoil tuning"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="weaponTunePanelScroll">
        <p className="settingsHint">
          Live spring recoil while playing. Close settings, fire the gun, and
          tune until the kick feels right. Sliders auto-save.
        </p>

        <p className="settingsGroupLabel">Camera aim</p>
        <p className="settingsHint" style={{ marginTop: 0 }}>
          Net aim offset after settle. Higher kick velocity + stiffness = faster,
          snappier pull-up.
        </p>
        <TuningField
          fieldKey="aimRecoilPitch"
          label="Pitch offset"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="aimRecoilYaw"
          label="Yaw spread"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="kickVelScale"
          label="Kick velocity"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="springStiffness"
          label="Spring stiffness"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="springDamping"
          label="Spring damping"
          tuning={tuning}
          onChange={patch}
        />

        <p className="settingsGroupLabel">View weapon</p>
        <p className="settingsHint" style={{ marginTop: 0 }}>
          Visual kick only — returns to rest. Does not change final aim offset.
        </p>
        <TuningField
          fieldKey="fireRecoilBack"
          label="Backward kick"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="fireRecoilKickVelScale"
          label="Kick velocity"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="fireRecoilPitch"
          label="Muzzle flip"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="fireRecoilPitchVelScale"
          label="Flip velocity"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="fireRecoilStiffness"
          label="Spring stiffness"
          tuning={tuning}
          onChange={patch}
        />
        <TuningField
          fieldKey="fireRecoilDamping"
          label="Spring damping"
          tuning={tuning}
          onChange={patch}
        />
      </div>
      <div className="weaponTunePanelFooter">
        <button type="button" className="settingsBtn" onClick={handleReset}>
          Reset defaults
        </button>
        <button type="button" className="settingsBtn" onClick={handleCopy}>
          Copy JSON
        </button>
      </div>
      <p className="settingsHint weaponTunePanelFooter">
        Tip: raise kick velocity first for a quicker snap, then stiffness. Lower
        damping adds more bounce on the way back.
      </p>
    </aside>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
