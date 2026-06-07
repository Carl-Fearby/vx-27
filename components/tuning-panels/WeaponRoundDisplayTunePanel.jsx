"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_AIM_ROUND_DISPLAY,
  DEFAULT_HIP_ROUND_DISPLAY,
  formatRoundDisplayForCopy,
  saveWeaponRoundDisplayTuning,
} from "@/lib/weapons/WeaponRoundDisplayTuning";
import { radToDeg } from "@/lib/weapons/WeaponTuning";

const POS_MIN = -2;
const POS_MAX = 2;
const ROT_MIN = -3.14159;
const ROT_MAX = 3.14159;
const SCALE_MIN = 0.1;
const SCALE_MAX = 12;
const PLANE_MIN = 0.01;
const PLANE_MAX = 0.4;
const FONT_MIN = 12;
const FONT_MAX = 128;
const POS_STEP = 0.001;
const ROT_STEP = 0.001;
const SCALE_STEP = 0.001;
const PLANE_STEP = 0.001;
const FONT_STEP = 1;
const NUDGE_POS = 0.001;
const NUDGE_ROT = 0.001;
const NUDGE_SCALE = 0.001;
const NUDGE_PLANE = 0.001;
const NUDGE_FONT = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function PoseControl({
  label,
  value,
  min,
  max,
  step,
  nudgeStep,
  format,
  onChange,
  toInput = (v) => v,
  fromInput = (n) => n,
  inputMin,
  inputMax,
  inputStep,
}) {
  const apply = (next) => onChange(clamp(next, min, max));
  const numMin = inputMin ?? min;
  const numMax = inputMax ?? max;
  const numStep = inputStep ?? step;
  const inputDecimals =
    inputStep != null && inputStep < 0.01
      ? 4
      : inputStep != null && inputStep < 0.1
        ? 2
        : 3;
  const inputDisplay = parseFloat(toInput(value).toFixed(inputDecimals));

  return (
    <div className="poseControl">
      <span className="sliderLabel">
        {label} <output>{format(value)}</output>
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
          min={numMin}
          max={numMax}
          step={numStep}
          value={inputDisplay}
          onChange={(e) => apply(fromInput(parseFloat(e.target.value)))}
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

function stopPanelEvent(e) {
  e.stopPropagation();
}

export default function WeaponRoundDisplayTunePanel({
  previewAim,
  onPreviewAimChange,
  hipTuning,
  aimTuning,
  onHipChange,
  onAimChange,
  onSnapToReceiver,
  onReleasePointer,
  onClose,
}) {
  const tuning = previewAim ? aimTuning : hipTuning;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const releasePointer = () => onReleasePointer?.();

  const selectPreview = (aim) => {
    releasePointer();
    onPreviewAimChange?.(aim);
  };

  const updateField = (field, value) => {
    if (previewAim) {
      const next = { ...aimTuning, [field]: value };
      onAimChange(next);
      saveWeaponRoundDisplayTuning(hipTuning, next);
      return;
    }
    const next = { ...hipTuning, [field]: value };
    onHipChange(next);
    saveWeaponRoundDisplayTuning(next, aimTuning);
  };

  const handleCopy = async () => {
    const text = formatRoundDisplayForCopy(tuning);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    console.log("Weapon round display tuning:", text);
  };

  const handleReset = () => {
    if (previewAim) {
      const defaults = { ...DEFAULT_AIM_ROUND_DISPLAY };
      onAimChange(defaults);
      saveWeaponRoundDisplayTuning(hipTuning, defaults);
      return;
    }
    const defaults = { ...DEFAULT_HIP_ROUND_DISPLAY };
    onHipChange(defaults);
    saveWeaponRoundDisplayTuning(defaults, aimTuning);
  };

  const panel = (
    <div
      className="weaponTunePanel weaponRoundDisplayTunePanel"
      onMouseDown={(e) => {
        stopPanelEvent(e);
        releasePointer();
      }}
      onClick={stopPanelEvent}
      onWheel={stopPanelEvent}
      onTouchMove={stopPanelEvent}
    >
      <div className="weaponTunePanelHeader">
        <div>
          <p className="weaponTuneTitle">Rifle round display</p>
          <p className="weaponTuneHint">
            Hip and Aim each have their own pose (blended in-game). Sliders auto-save.
            +X barrel, −X stock.
          </p>
        </div>
        <button type="button" className="weaponTuneClose" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="weaponTuneTabs">
        <button
          type="button"
          className={
            !previewAim ? "weaponTuneTab active" : "weaponTuneTab"
          }
          onClick={() => selectPreview(false)}
        >
          Hip
        </button>
        <button
          type="button"
          className={previewAim ? "weaponTuneTab active" : "weaponTuneTab"}
          onClick={() => selectPreview(true)}
        >
          Aim
        </button>
      </div>
      <div className="weaponTunePanelScroll">
        <PoseControl
          label="Pos X"
          value={tuning.posX}
          min={POS_MIN}
          max={POS_MAX}
          step={POS_STEP}
          nudgeStep={NUDGE_POS}
          format={(v) => v.toFixed(3)}
          onChange={(v) => updateField("posX", v)}
        />
        <PoseControl
          label="Pos Y"
          value={tuning.posY}
          min={POS_MIN}
          max={POS_MAX}
          step={POS_STEP}
          nudgeStep={NUDGE_POS}
          format={(v) => v.toFixed(3)}
          onChange={(v) => updateField("posY", v)}
        />
        <PoseControl
          label="Pos Z"
          value={tuning.posZ}
          min={POS_MIN}
          max={POS_MAX}
          step={POS_STEP}
          nudgeStep={NUDGE_POS}
          format={(v) => v.toFixed(3)}
          onChange={(v) => updateField("posZ", v)}
        />
        <PoseControl
          label="Rot X"
          value={tuning.rotX}
          min={ROT_MIN}
          max={ROT_MAX}
          step={ROT_STEP}
          nudgeStep={NUDGE_ROT}
          format={(v) => `${radToDeg(v).toFixed(1)}°`}
          onChange={(v) => updateField("rotX", v)}
        />
        <PoseControl
          label="Rot Y"
          value={tuning.rotY}
          min={ROT_MIN}
          max={ROT_MAX}
          step={ROT_STEP}
          nudgeStep={NUDGE_ROT}
          format={(v) => `${radToDeg(v).toFixed(1)}°`}
          onChange={(v) => updateField("rotY", v)}
        />
        <PoseControl
          label="Rot Z"
          value={tuning.rotZ}
          min={ROT_MIN}
          max={ROT_MAX}
          step={ROT_STEP}
          nudgeStep={NUDGE_ROT}
          format={(v) => `${radToDeg(v).toFixed(1)}°`}
          onChange={(v) => updateField("rotZ", v)}
        />
        <PoseControl
          label="Scale"
          value={tuning.scale}
          min={SCALE_MIN}
          max={SCALE_MAX}
          step={SCALE_STEP}
          nudgeStep={NUDGE_SCALE}
          format={(v) => v.toFixed(3)}
          onChange={(v) => updateField("scale", v)}
        />
        <PoseControl
          label="Plane width"
          value={tuning.planeWidth}
          min={PLANE_MIN}
          max={PLANE_MAX}
          step={PLANE_STEP}
          nudgeStep={NUDGE_PLANE}
          format={(v) => v.toFixed(3)}
          onChange={(v) => updateField("planeWidth", v)}
        />
        <PoseControl
          label="Plane height"
          value={tuning.planeHeight}
          min={PLANE_MIN}
          max={PLANE_MAX}
          step={PLANE_STEP}
          nudgeStep={NUDGE_PLANE}
          format={(v) => v.toFixed(3)}
          onChange={(v) => updateField("planeHeight", v)}
        />
        <PoseControl
          label="Font size"
          value={tuning.fontSize}
          min={FONT_MIN}
          max={FONT_MAX}
          step={FONT_STEP}
          nudgeStep={NUDGE_FONT}
          format={(v) => String(Math.round(v))}
          onChange={(v) => updateField("fontSize", Math.round(v))}
          toInput={(v) => Math.round(v)}
          fromInput={(n) => Math.round(n)}
          inputStep={1}
        />
      </div>
      <div className="weaponTunePanelFooter">
        <button type="button" className="settingsBtn" onClick={handleCopy}>
          Copy JSON
        </button>
        <button type="button" className="settingsBtn" onClick={handleReset}>
          Reset defaults
        </button>
        <button
          type="button"
          className="settingsBtn"
          onClick={() => {
            const suggested = onSnapToReceiver?.();
            if (!suggested) return;
            if (previewAim) {
              onAimChange(suggested);
              saveWeaponRoundDisplayTuning(hipTuning, suggested);
            } else {
              onHipChange(suggested);
              saveWeaponRoundDisplayTuning(suggested, aimTuning);
            }
          }}
        >
          Snap to receiver top
        </button>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
