"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_PISTOL_ADS_POSE,
  DEFAULT_PISTOL_HIP_POSE,
  formatPoseForCopy,
  savePistolTuning,
} from "@/lib/weapons/PistolTuning";
import { radToDeg } from "@/lib/weapons/WeaponTuning";

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

export default function PistolTunePanel({
  poseMode,
  onPoseModeChange,
  onReleasePointer,
  hipPose,
  adsPose,
  onHipChange,
  onAdsChange,
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
      savePistolTuning(next, adsPose);
      return;
    }
    if (poseMode === "ads") {
      const next = { ...adsPose, [field]: value };
      onAdsChange(next);
      savePistolTuning(hipPose, next);
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
    copyJson(formatPoseForCopy(pose), `Pistol ${poseMode} pose:`);
  };

  const handleReset = () => {
    if (poseMode === "hip") {
      const defaults = { ...DEFAULT_PISTOL_HIP_POSE };
      onHipChange(defaults);
      savePistolTuning(defaults, adsPose);
      return;
    }
    if (poseMode === "ads") {
      const defaults = { ...DEFAULT_PISTOL_ADS_POSE };
      onAdsChange(defaults);
      savePistolTuning(hipPose, defaults);
    }
  };

  const panel = (
    <div
      className="weaponTunePanel pistolTunePanel"
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
          <p className="weaponTuneTitle">Pistol tune</p>
          {onClose && (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close pistol tuning"
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
        </div>
      </div>

      <div className="weaponTunePanelScroll">
        <PoseFields
          pose={poseMode === "ads" ? adsPose : hipPose}
          onUpdate={updatePoseField}
        />
        <div className="weaponTuneActions">
          <button type="button" className="settingsBtn" onClick={handleCopy}>
            Copy pose JSON
          </button>
          <button type="button" className="settingsBtn" onClick={handleReset}>
            Reset pose
          </button>
        </div>
      </div>

      <p className="settingsHint weaponTunePanelFooter">
        {poseMode === "ads"
          ? "Aim tab previews ADS. Live laser shows hitscan aim — align the model to the beam."
          : "Hip carry pose for the Azure Pulse Pistol. Live laser shows hitscan aim."}
      </p>
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
