"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_CROSSHAIR_TUNING,
  formatCrosshairTuningForCopy,
  saveCrosshairTuning,
} from "@/lib/weapons/CrosshairTuning";
import {
  DEFAULT_ADS_POSE,
  DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  DEFAULT_BODY_LOOK_UP_AMOUNT,
  DEFAULT_HIP_POSE,
  formatLookTuningForCopy,
  formatPoseForCopy,
  radToDeg,
  saveBodyLookDownAmount,
  saveBodyLookUpAmount,
  saveWeaponTuning,
} from "@/lib/weapons/WeaponTuning";

const POS_MIN = -2;
const POS_MAX = 2;
const ROT_MIN = -3.14159;
const ROT_MAX = 3.14159;
const SCALE_MIN = 0.25;
const SCALE_MAX = 2.5;
const POS_STEP = 0.001;
const ROT_STEP = 0.001;
const SCALE_STEP = 0.001;
const NUDGE_POS = 0.001;
const NUDGE_ROT = 0.001;
const NUDGE_SCALE = 0.001;

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
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!Number.isNaN(parsed)) apply(fromInput(parsed));
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

const MAX_LOOK_RATE_MIN = 2;
const MAX_LOOK_RATE_MAX = 24;
const MAX_LOOK_RATE_STEP = 0.5;
const LOOK_PARALLAX_AMOUNT_MIN = 0;
const LOOK_PARALLAX_AMOUNT_MAX = 1.5;
const LOOK_PARALLAX_AMOUNT_STEP = 0.05;
const CROSSHAIR_SIZE_MIN = 8;
const STANDARD_CROSSHAIR_SIZE_MAX = 48;
/** Reticule only — up to 500% larger than the old 128px cap. */
const RETICULE_CROSSHAIR_SIZE_MAX = 640;
const CROSSHAIR_SIZE_STEP = 1;
const CROSSHAIR_SIZE_NUDGE = 1;

function PoseFields({ pose, onUpdate }) {
  return (
    <>
      <p className="settingsGroup">Position (±{NUDGE_POS} nudge)</p>
      <PoseControl
        label="X"
        value={pose.posX}
        min={POS_MIN}
        max={POS_MAX}
        step={POS_STEP}
        nudgeStep={NUDGE_POS}
        format={(v) => v.toFixed(3)}
        onChange={(v) => onUpdate("posX", v)}
      />
      <PoseControl
        label="Y"
        value={pose.posY}
        min={POS_MIN}
        max={POS_MAX}
        step={POS_STEP}
        nudgeStep={NUDGE_POS}
        format={(v) => v.toFixed(3)}
        onChange={(v) => onUpdate("posY", v)}
      />
      <PoseControl
        label="Z"
        value={pose.posZ}
        min={POS_MIN}
        max={POS_MAX}
        step={POS_STEP}
        nudgeStep={NUDGE_POS}
        format={(v) => v.toFixed(3)}
        onChange={(v) => onUpdate("posZ", v)}
      />

      <p className="settingsGroup">Rotation (±{NUDGE_ROT} rad nudge)</p>
      <PoseControl
        label="Rot X"
        value={pose.rotX}
        min={ROT_MIN}
        max={ROT_MAX}
        step={ROT_STEP}
        nudgeStep={NUDGE_ROT}
        toInput={radToDeg}
        fromInput={(deg) => (deg * Math.PI) / 180}
        inputMin={-180}
        inputMax={180}
        inputStep={0.1}
        format={(v) => `${radToDeg(v).toFixed(1)}°`}
        onChange={(v) => onUpdate("rotX", v)}
      />
      <PoseControl
        label="Rot Y"
        value={pose.rotY}
        min={ROT_MIN}
        max={ROT_MAX}
        step={ROT_STEP}
        nudgeStep={NUDGE_ROT}
        toInput={radToDeg}
        fromInput={(deg) => (deg * Math.PI) / 180}
        inputMin={-180}
        inputMax={180}
        inputStep={0.1}
        format={(v) => `${radToDeg(v).toFixed(1)}°`}
        onChange={(v) => onUpdate("rotY", v)}
      />
      <PoseControl
        label="Rot Z"
        value={pose.rotZ}
        min={ROT_MIN}
        max={ROT_MAX}
        step={ROT_STEP}
        nudgeStep={NUDGE_ROT}
        toInput={radToDeg}
        fromInput={(deg) => (deg * Math.PI) / 180}
        inputMin={-180}
        inputMax={180}
        inputStep={0.1}
        format={(v) => `${radToDeg(v).toFixed(1)}°`}
        onChange={(v) => onUpdate("rotZ", v)}
      />

      <p className="settingsGroup">Scale</p>
      <PoseControl
        label="Scale"
        value={pose.scale}
        min={SCALE_MIN}
        max={SCALE_MAX}
        step={SCALE_STEP}
        nudgeStep={NUDGE_SCALE}
        format={(v) => v.toFixed(3)}
        onChange={(v) => onUpdate("scale", v)}
      />
    </>
  );
}

function stopPanelEvent(e) {
  e.stopPropagation();
}

export default function WeaponTunePanel({
  poseMode,
  onPoseModeChange,
  onReleasePointer,
  hipPose,
  adsPose,
  onHipChange,
  onAdsChange,
  crosshairTuning,
  onCrosshairTuningChange,
  maxLookRate,
  onMaxLookRateChange,
  bodyLookUpAmount,
  onBodyLookUpAmountChange,
  bodyLookDownAmount,
  onBodyLookDownAmountChange,
  defaultMaxLookRate = 2.5,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const releasePointer = () => onReleasePointer?.();

  const selectMode = (mode) => {
    releasePointer();
    onPoseModeChange(mode);
  };

  const updatePoseField = (field, value) => {
    if (poseMode === "hip") {
      const next = { ...hipPose, [field]: value };
      onHipChange(next);
      saveWeaponTuning(next, adsPose);
      return;
    }
    if (poseMode === "ads") {
      const next = { ...adsPose, [field]: value };
      onAdsChange(next);
      saveWeaponTuning(hipPose, next);
    }
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
    const pose = poseMode === "ads" ? adsPose : hipPose;
    copyJson(formatPoseForCopy(pose), `Weapon ${poseMode} pose:`);
  };

  const handleCopyLook = () => {
    copyJson(
      formatLookTuningForCopy({
        maxLookRate,
        bodyLookUpAmount,
        bodyLookDownAmount,
      }),
      "Weapon look tuning:",
    );
  };

  const handleResetLook = () => {
    onMaxLookRateChange(defaultMaxLookRate);
    onBodyLookUpAmountChange(DEFAULT_BODY_LOOK_UP_AMOUNT);
    onBodyLookDownAmountChange(DEFAULT_BODY_LOOK_DOWN_AMOUNT);
    saveBodyLookUpAmount(DEFAULT_BODY_LOOK_UP_AMOUNT);
    saveBodyLookDownAmount(DEFAULT_BODY_LOOK_DOWN_AMOUNT);
  };

  const updateCrosshairField = (field, value) => {
    const next = { ...crosshairTuning, [field]: value };
    onCrosshairTuningChange(next);
    saveCrosshairTuning(next);
  };

  const handleReset = () => {
    if (poseMode === "hip") {
      const defaults = { ...DEFAULT_HIP_POSE };
      onHipChange(defaults);
      saveWeaponTuning(defaults, adsPose);
      return;
    }
    if (poseMode === "ads") {
      const defaults = { ...DEFAULT_ADS_POSE };
      onAdsChange(defaults);
      saveWeaponTuning(hipPose, defaults);
    }
  };

  const handleResetCrosshair = () => {
    const defaults = { ...DEFAULT_CROSSHAIR_TUNING };
    onCrosshairTuningChange(defaults);
    saveCrosshairTuning(defaults);
  };

  const panel = (
    <div
      className="weaponTunePanel"
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
          <p className="weaponTuneTitle">Weapon tune</p>
          {onClose && (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close weapon tuning"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>
        <div className="weaponTuneTabs">
          <button
            type="button"
            className={
              poseMode === "hip" ? "weaponTuneTab active" : "weaponTuneTab"
            }
            onClick={() => selectMode("hip")}
          >
            Hip
          </button>
          <button
            type="button"
            className={
              poseMode === "ads" ? "weaponTuneTab active" : "weaponTuneTab"
            }
            onClick={() => selectMode("ads")}
          >
            Aim
          </button>
          <button
            type="button"
            className={
              poseMode === "look" ? "weaponTuneTab active" : "weaponTuneTab"
            }
            onClick={() => selectMode("look")}
          >
            Look
          </button>
        </div>
      </div>

      <div className="weaponTunePanelScroll">
        {poseMode === "hip" && (
          <>
            <PoseFields pose={hipPose} onUpdate={updatePoseField} />
            <p className="settingsGroup">Standard crosshair</p>
            <PoseControl
              label="Width"
              value={crosshairTuning.standardWidth}
              min={CROSSHAIR_SIZE_MIN}
              max={STANDARD_CROSSHAIR_SIZE_MAX}
              step={CROSSHAIR_SIZE_STEP}
              nudgeStep={CROSSHAIR_SIZE_NUDGE}
              format={(v) => `${Math.round(v)}px`}
              toInput={(v) => Math.round(v)}
              fromInput={(n) => Math.round(n)}
              inputStep={1}
              onChange={(v) => updateCrosshairField("standardWidth", Math.round(v))}
            />
            <PoseControl
              label="Height"
              value={crosshairTuning.standardHeight}
              min={CROSSHAIR_SIZE_MIN}
              max={STANDARD_CROSSHAIR_SIZE_MAX}
              step={CROSSHAIR_SIZE_STEP}
              nudgeStep={CROSSHAIR_SIZE_NUDGE}
              format={(v) => `${Math.round(v)}px`}
              toInput={(v) => Math.round(v)}
              fromInput={(n) => Math.round(n)}
              inputStep={1}
              onChange={(v) =>
                updateCrosshairField("standardHeight", Math.round(v))
              }
            />
          </>
        )}
        {poseMode === "ads" && (
          <>
            <PoseFields pose={adsPose} onUpdate={updatePoseField} />
            <p className="settingsGroup">Reticule (ADS)</p>
            <PoseControl
              label="Width"
              value={crosshairTuning.gunWidth}
              min={CROSSHAIR_SIZE_MIN}
              max={RETICULE_CROSSHAIR_SIZE_MAX}
              step={CROSSHAIR_SIZE_STEP}
              nudgeStep={CROSSHAIR_SIZE_NUDGE}
              format={(v) => `${Math.round(v)}px`}
              toInput={(v) => Math.round(v)}
              fromInput={(n) => Math.round(n)}
              inputStep={1}
              onChange={(v) => updateCrosshairField("gunWidth", Math.round(v))}
            />
            <PoseControl
              label="Height"
              value={crosshairTuning.gunHeight}
              min={CROSSHAIR_SIZE_MIN}
              max={RETICULE_CROSSHAIR_SIZE_MAX}
              step={CROSSHAIR_SIZE_STEP}
              nudgeStep={CROSSHAIR_SIZE_NUDGE}
              format={(v) => `${Math.round(v)}px`}
              toInput={(v) => Math.round(v)}
              fromInput={(n) => Math.round(n)}
              inputStep={1}
              onChange={(v) => updateCrosshairField("gunHeight", Math.round(v))}
            />
          </>
        )}
        {poseMode === "look" && (
          <>
            <p className="settingsGroup">Parallax &amp; turn cap</p>
            <PoseControl
              label="Max turn speed"
              value={maxLookRate}
              min={MAX_LOOK_RATE_MIN}
              max={MAX_LOOK_RATE_MAX}
              step={MAX_LOOK_RATE_STEP}
              nudgeStep={MAX_LOOK_RATE_STEP}
              format={(v) => `${((v * 180) / Math.PI).toFixed(0)}°/s`}
              onChange={onMaxLookRateChange}
            />
            <PoseControl
              label="Look-up shift"
              value={bodyLookUpAmount}
              min={LOOK_PARALLAX_AMOUNT_MIN}
              max={LOOK_PARALLAX_AMOUNT_MAX}
              step={LOOK_PARALLAX_AMOUNT_STEP}
              nudgeStep={LOOK_PARALLAX_AMOUNT_STEP}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => {
                onBodyLookUpAmountChange(v);
                saveBodyLookUpAmount(v);
              }}
            />
            <PoseControl
              label="Look-down shift"
              value={bodyLookDownAmount}
              min={LOOK_PARALLAX_AMOUNT_MIN}
              max={LOOK_PARALLAX_AMOUNT_MAX}
              step={LOOK_PARALLAX_AMOUNT_STEP}
              nudgeStep={LOOK_PARALLAX_AMOUNT_STEP}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => {
                onBodyLookDownAmountChange(v);
                saveBodyLookDownAmount(v);
              }}
            />
            <p className="settingsHint">
              Hip-only gun shift when looking up or down. Aim stays on the
              sight.
            </p>
          </>
        )}

        {poseMode === "look" && (
          <div className="weaponTuneActions">
            <button type="button" className="settingsBtn" onClick={handleCopyLook}>
              Copy JSON
            </button>
            <button type="button" className="settingsBtn" onClick={handleResetLook}>
              Reset
            </button>
          </div>
        )}

        {(poseMode === "hip" || poseMode === "ads") && (
          <div className="weaponTuneActions">
            <button type="button" className="settingsBtn" onClick={handleCopy}>
              Copy pose JSON
            </button>
            <button type="button" className="settingsBtn" onClick={handleReset}>
              Reset pose
            </button>
            <button
              type="button"
              className="settingsBtn"
              onClick={() =>
                copyJson(
                  formatCrosshairTuningForCopy(crosshairTuning),
                  "Crosshair tuning:",
                )
              }
            >
              Copy crosshair JSON
            </button>
            <button
              type="button"
              className="settingsBtn"
              onClick={handleResetCrosshair}
            >
              Reset crosshair
            </button>
          </div>
        )}
      </div>

      <p className="settingsHint weaponTunePanelFooter">
        {poseMode === "ads"
          ? "Aim tab previews ADS pose and gun crosshair. Hold aim in-game to compare."
          : poseMode === "look"
            ? "Scroll this panel if needed on small screens."
            : "Hip carry pose and standard crosshair size."}
      </p>
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
