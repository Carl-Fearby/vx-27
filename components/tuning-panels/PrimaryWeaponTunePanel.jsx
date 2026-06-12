"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_LASER_EMITTER_TUNING,
  formatLaserEmitterTuningForCopy,
  LASER_EMITTER_OFFSET_LIMITS,
  normalizeLaserEmitterOffset,
} from "@/lib/weapons/LaserEmitterTuning";
import {
  DEFAULT_PISTOL_ADS_POSE,
  DEFAULT_PISTOL_HIP_POSE,
  formatPoseForCopy as formatPistolPoseForCopy,
  savePistolTuning,
} from "@/lib/weapons/PistolTuning";
import {
  DEFAULT_ADS_POSE,
  DEFAULT_BODY_LOOK_DOWN_AMOUNT,
  DEFAULT_BODY_LOOK_UP_AMOUNT,
  DEFAULT_HIP_POSE,
  formatLookTuningForCopy,
  formatPoseForCopy as formatRiflePoseForCopy,
  radToDeg,
  saveBodyLookDownAmount,
  saveBodyLookUpAmount,
  saveWeaponTuning,
} from "@/lib/weapons/WeaponTuning";
import {
  DEFAULT_CROSSHAIR_TUNING,
  formatCrosshairTuningForCopy,
  saveCrosshairTuning,
} from "@/lib/weapons/CrosshairTuning";

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

const OFFSET_STEP = 0.001;
const NUDGE_OFFSET = 0.001;

const MAX_LOOK_RATE_MIN = 2;
const MAX_LOOK_RATE_MAX = 24;
const MAX_LOOK_RATE_STEP = 0.5;
const LOOK_PARALLAX_AMOUNT_MIN = 0;
const LOOK_PARALLAX_AMOUNT_MAX = 1.5;
const LOOK_PARALLAX_AMOUNT_STEP = 0.05;
const CROSSHAIR_SIZE_MIN = 8;
const STANDARD_CROSSHAIR_SIZE_MAX = 48;
const RETICULE_CROSSHAIR_SIZE_MAX = 640;
const CROSSHAIR_SIZE_STEP = 1;
const CROSSHAIR_SIZE_NUDGE = 1;
const RETICULE_OFFSET_MIN = -320;
const RETICULE_OFFSET_MAX = 320;
const RETICULE_OFFSET_STEP = 1;
const RETICULE_OFFSET_NUDGE = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stopPanelEvent(e) {
  e.stopPropagation();
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
      <p className="settingsGroup">Position</p>
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
      <p className="settingsGroup">Rotation</p>
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

export default function PrimaryWeaponTunePanel({
  weaponId,
  onWeaponChange,
  tuneMode,
  onTuneModeChange,
  pistolHipPose,
  pistolAdsPose,
  onPistolHipChange,
  onPistolAdsChange,
  rifleHipPose,
  rifleAdsPose,
  onRifleHipChange,
  onRifleAdsChange,
  laserTuning,
  onLaserChange,
  crosshairTuning,
  onCrosshairChange,
  maxLookRate,
  onMaxLookRateChange,
  bodyLookUpAmount,
  onBodyLookUpAmountChange,
  bodyLookDownAmount,
  onBodyLookDownAmountChange,
  defaultMaxLookRate = 2.5,
  onReleasePointer,
  onClose,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const releasePointer = () => onReleasePointer?.();
  const isPistol = weaponId === "pistol";
  const laserOffset = normalizeLaserEmitterOffset(laserTuning?.[weaponId]);

  const selectWeapon = (id) => {
    releasePointer();
    onWeaponChange(id);
    if (id === "pistol" && tuneMode === "look") {
      onTuneModeChange("hip");
    }
    if (tuneMode === "laser") {
      onTuneModeChange("hip");
    }
  };

  useEffect(() => {
    if (tuneMode === "laser") {
      onTuneModeChange("hip");
    }
  }, []);

  const selectMode = (mode) => {
    releasePointer();
    onTuneModeChange(mode);
  };

  const copyJson = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    console.log(label, text);
  };

  const updatePistolPoseField = (field, value) => {
    if (tuneMode === "hip") {
      const next = { ...pistolHipPose, [field]: value };
      onPistolHipChange(next);
      savePistolTuning(next, pistolAdsPose);
      return;
    }
    if (tuneMode === "ads") {
      const next = { ...pistolAdsPose, [field]: value };
      onPistolAdsChange(next);
      savePistolTuning(pistolHipPose, next);
    }
  };

  const updateRiflePoseField = (field, value) => {
    if (tuneMode === "hip") {
      const next = { ...rifleHipPose, [field]: value };
      onRifleHipChange(next);
      saveWeaponTuning(next, rifleAdsPose);
      return;
    }
    if (tuneMode === "ads") {
      const next = { ...rifleAdsPose, [field]: value };
      onRifleAdsChange(next);
      saveWeaponTuning(rifleHipPose, next);
    }
  };

  const updateLaserField = (field, value) => {
    onLaserChange(weaponId, { ...laserOffset, [field]: value });
  };

  const updateCrosshairField = (field, value) => {
    const next = { ...crosshairTuning, [field]: value };
    onCrosshairChange(next);
    saveCrosshairTuning(next);
  };

  const handleCopyPose = () => {
    if (isPistol) {
      const pose = tuneMode === "ads" ? pistolAdsPose : pistolHipPose;
      copyJson(formatPistolPoseForCopy(pose), `Pistol ${tuneMode} pose:`);
      return;
    }
    const pose = tuneMode === "ads" ? rifleAdsPose : rifleHipPose;
    copyJson(formatRiflePoseForCopy(pose), `Rifle ${tuneMode} pose:`);
  };

  const handleResetPose = () => {
    if (isPistol) {
      if (tuneMode === "hip") {
        const defaults = { ...DEFAULT_PISTOL_HIP_POSE };
        onPistolHipChange(defaults);
        savePistolTuning(defaults, pistolAdsPose);
        return;
      }
      if (tuneMode === "ads") {
        const defaults = { ...DEFAULT_PISTOL_ADS_POSE };
        onPistolAdsChange(defaults);
        savePistolTuning(pistolHipPose, defaults);
      }
      return;
    }
    if (tuneMode === "hip") {
      const defaults = { ...DEFAULT_HIP_POSE };
      onRifleHipChange(defaults);
      saveWeaponTuning(defaults, rifleAdsPose);
      return;
    }
    if (tuneMode === "ads") {
      const defaults = { ...DEFAULT_ADS_POSE };
      onRifleAdsChange(defaults);
      saveWeaponTuning(rifleHipPose, defaults);
    }
  };

  const handleResetLaser = () => {
    onLaserChange(weaponId, DEFAULT_LASER_EMITTER_TUNING[weaponId]);
  };

  const handleResetCrosshair = () => {
    const defaults = { ...DEFAULT_CROSSHAIR_TUNING };
    onCrosshairChange(defaults);
    saveCrosshairTuning(defaults);
  };

  const handleCopyLaser = () => {
    copyJson(
      formatLaserEmitterTuningForCopy(laserTuning),
      `${isPistol ? "Pistol" : "Rifle"} laser emitter tuning:`,
    );
  };

  const modeTabs = isPistol ? ["hip", "ads"] : ["hip", "ads", "look"];

  const laserOffsetFields = (
    <>
      <p className="settingsGroup">
        Laser emitter ({isPistol ? "pistol" : "rifle"})
      </p>
      <p className="settingsHint" style={{ marginTop: 0 }}>
        Offset from the model muzzle for this weapon. +X along barrel, +Y up, +Z
        sideways.
      </p>
      <OffsetControl
        label="Local X"
        value={laserOffset.x}
        min={LASER_EMITTER_OFFSET_LIMITS.x.min}
        max={LASER_EMITTER_OFFSET_LIMITS.x.max}
        onChange={(v) => updateLaserField("x", v)}
      />
      <OffsetControl
        label="Local Y"
        value={laserOffset.y}
        min={LASER_EMITTER_OFFSET_LIMITS.y.min}
        max={LASER_EMITTER_OFFSET_LIMITS.y.max}
        onChange={(v) => updateLaserField("y", v)}
      />
      <OffsetControl
        label="Local Z"
        value={laserOffset.z}
        min={LASER_EMITTER_OFFSET_LIMITS.z.min}
        max={LASER_EMITTER_OFFSET_LIMITS.z.max}
        onChange={(v) => updateLaserField("z", v)}
      />
    </>
  );

  const panel = (
    <div
      className="weaponTunePanel primaryWeaponTunePanel"
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
          <p className="weaponTuneTitle">Weapon &amp; laser tune</p>
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
        <p className="weaponTuneHint">
          Align gun pose and laser emitter with the live beam — no firing needed.
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

      <div className="weaponTuneTabs">
        {modeTabs.map((mode) => (
          <button
            key={mode}
            type="button"
            className={tuneMode === mode ? "weaponTuneTab active" : "weaponTuneTab"}
            onClick={() => selectMode(mode)}
          >
            {mode === "hip" ? "Hip" : mode === "ads" ? "Aim" : "Look"}
          </button>
        ))}
      </div>

      <div className="weaponTunePanelScroll">
        {(tuneMode === "hip" || tuneMode === "ads") && (
          <>
            <PoseFields
              pose={
                isPistol
                  ? tuneMode === "ads"
                    ? pistolAdsPose
                    : pistolHipPose
                  : tuneMode === "ads"
                    ? rifleAdsPose
                    : rifleHipPose
              }
              onUpdate={isPistol ? updatePistolPoseField : updateRiflePoseField}
            />
            {laserOffsetFields}
            {!isPistol && tuneMode === "hip" && (
              <>
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
                  onChange={(v) =>
                    updateCrosshairField("standardWidth", Math.round(v))
                  }
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
            {!isPistol && tuneMode === "ads" && (
              <>
                <p className="settingsGroup">Reticule (ADS)</p>
                <p className="settingsHint" style={{ marginTop: 0 }}>
                  Tune rifle aim reticle size and screen offset while ADS preview
                  is active.
                </p>
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
                <PoseControl
                  label="Offset X"
                  value={crosshairTuning.gunOffsetX ?? 0}
                  min={RETICULE_OFFSET_MIN}
                  max={RETICULE_OFFSET_MAX}
                  step={RETICULE_OFFSET_STEP}
                  nudgeStep={RETICULE_OFFSET_NUDGE}
                  format={(v) => `${Math.round(v)}px`}
                  toInput={(v) => Math.round(v)}
                  fromInput={(n) => Math.round(n)}
                  inputStep={1}
                  onChange={(v) =>
                    updateCrosshairField("gunOffsetX", Math.round(v))
                  }
                />
                <PoseControl
                  label="Offset Y"
                  value={crosshairTuning.gunOffsetY ?? 0}
                  min={RETICULE_OFFSET_MIN}
                  max={RETICULE_OFFSET_MAX}
                  step={RETICULE_OFFSET_STEP}
                  nudgeStep={RETICULE_OFFSET_NUDGE}
                  format={(v) => `${Math.round(v)}px`}
                  toInput={(v) => Math.round(v)}
                  fromInput={(n) => Math.round(n)}
                  inputStep={1}
                  onChange={(v) =>
                    updateCrosshairField("gunOffsetY", Math.round(v))
                  }
                />
              </>
            )}
          </>
        )}

        {!isPistol && tuneMode === "look" && (
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
          </>
        )}

      </div>

      <div className="weaponTunePanelFooter">
        {tuneMode === "look" ? (
          <>
            <button
              type="button"
              className="settingsBtn"
              onClick={() =>
                copyJson(
                  formatLookTuningForCopy({
                    maxLookRate,
                    bodyLookUpAmount,
                    bodyLookDownAmount,
                  }),
                  "Look tuning:",
                )
              }
            >
              Copy look JSON
            </button>
            <button
              type="button"
              className="settingsBtn"
              onClick={() => {
                onMaxLookRateChange(defaultMaxLookRate);
                onBodyLookUpAmountChange(DEFAULT_BODY_LOOK_UP_AMOUNT);
                onBodyLookDownAmountChange(DEFAULT_BODY_LOOK_DOWN_AMOUNT);
                saveBodyLookUpAmount(DEFAULT_BODY_LOOK_UP_AMOUNT);
                saveBodyLookDownAmount(DEFAULT_BODY_LOOK_DOWN_AMOUNT);
              }}
            >
              Reset look
            </button>
          </>
        ) : (
          <>
            <button type="button" className="settingsBtn" onClick={handleCopyPose}>
              Copy pose JSON
            </button>
            <button type="button" className="settingsBtn" onClick={handleResetPose}>
              Reset pose
            </button>
            <button type="button" className="settingsBtn" onClick={handleCopyLaser}>
              Copy laser JSON
            </button>
            <button type="button" className="settingsBtn" onClick={handleResetLaser}>
              Reset laser
            </button>
            {!isPistol && (
              <>
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
              </>
            )}
          </>
        )}
      </div>

      <p className="settingsHint weaponTunePanelFooter">
        {tuneMode === "ads"
          ? "Aim pose, reticle, and laser offset for the selected weapon. Live beam shows hitscan aim."
          : tuneMode === "look"
            ? "Rifle hip parallax when looking up or down."
            : "Hip pose and laser offset for the selected weapon. Live beam shows hitscan aim."}
      </p>
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
