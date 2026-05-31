"use client";

import { OIL_BARREL_TUNING_LIMITS as L } from "@/lib/OilBarrelTuning";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function BarControl({ label, value, min, max, step, nudge, format, onChange }) {
  const apply = (next) => onChange(clamp(next, min, max));
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
        <button type="button" className="poseNudgeBtn" onClick={() => apply(value - nudge)}>
          −
        </button>
        <input
          type="number"
          className="poseNumber"
          min={min}
          max={max}
          step={step}
          value={parseFloat(value.toFixed(3))}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!Number.isNaN(parsed)) apply(parsed);
          }}
        />
        <button type="button" className="poseNudgeBtn" onClick={() => apply(value + nudge)}>
          +
        </button>
      </div>
    </div>
  );
}

/** @param {{
 *   tuning: import("@/lib/OilBarrelTuning").OilBarrelTuning,
 *   onChange: (
 *     key: keyof import("@/lib/OilBarrelTuning").OilBarrelTuning,
 *     value: number | boolean
 *   ) => void,
 *   onReset: () => void,
 *   onCopy?: () => void,
 *   onClose?: () => void,
 *   pileSeed?: number,
 *   pileHubX?: number,
 *   pileHubZ?: number,
 *   pileStatus?: string,
 *   onPileSeedChange?: (seed: number) => void,
 *   onPileHubChange?: (x: number, z: number) => void,
 *   onPileGenerate?: () => void,
 *   pileBusy?: boolean,
 *   onPileCheck?: () => void,
 *   onPileCopyJson?: () => void,
 * }} props */
export default function OilBarrelTunePanel({
  tuning,
  onChange,
  onReset,
  onCopy,
  onClose,
  pileSeed = 7,
  pileHubX = -7.35,
  pileHubZ = -2.48,
  pileStatus = "",
  onPileSeedChange,
  onPileHubChange,
  onPileGenerate,
  pileBusy = false,
  onPileCheck,
  onPileCopyJson,
}) {
  return (
    <div
      className="hudBarTunePanel stairTunePanel"
      role="group"
      aria-label="Oil barrel material tuning"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tunePanelHeader">
        <p className="stairTuneTitle">Oil barrel (textured)</p>
        <div className="tunePanelHeaderActions">
          {onCopy && (
            <button type="button" className="tunePanelHeaderBtn" onClick={onCopy}>
              Copy JSON
            </button>
          )}
          <button type="button" className="tunePanelHeaderBtn" onClick={onReset}>
            Reset
          </button>
          {onClose && (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <p className="settingsGroup">Geometry</p>
      <label className="settingRow">
        <input
          type="checkbox"
          checked={tuning.topCap !== false}
          onChange={(e) => onChange("topCap", e.target.checked)}
        />
        Top endcap (flat lid)
      </label>
      <p className="settingsHint" style={{ marginTop: 0 }}>
        Off = open top with textured interior (rim kept, no flat lid). Rebuilds the barrel when
        toggled. Level JSON <code>topCap</code> only if you need a fixed lid that ignores this
        control.
      </p>

      <p className="settingsGroup">Interior wall (open top)</p>
      <BarControl
        label="Wall texture rotation (°)"
        value={tuning.interiorTextureRotation}
        min={L.interiorTextureRotation.min}
        max={L.interiorTextureRotation.max}
        step={L.interiorTextureRotation.step}
        nudge={L.interiorTextureRotation.nudge}
        format={(v) => `${Math.round(v)}°`}
        onChange={(v) => onChange("interiorTextureRotation", v)}
      />
      <p className="settingsHint" style={{ marginTop: 0 }}>
        Inner wall tiles 2× horizontally around the cylinder. Floor and exterior are not rotated.
      </p>

      <p className="settingsGroup">Interior video (open top)</p>
      <label className="settingRow">
        <input
          type="checkbox"
          checked={tuning.interiorFire !== false}
          onChange={(e) => onChange("interiorFire", e.target.checked)}
        />
        Flames
      </label>
      <p className="settingsHint" style={{ marginTop: 0 }}>
        Same as Gameplay → Oil barrel flames. Off hides the video; on rebuilds if needed.
      </p>
      <BarControl
        label="Fire light intensity"
        value={tuning.interiorFireLightIntensity}
        min={L.interiorFireLightIntensity.min}
        max={L.interiorFireLightIntensity.max}
        step={L.interiorFireLightIntensity.step}
        nudge={L.interiorFireLightIntensity.nudge}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onChange("interiorFireLightIntensity", v)}
      />
      <BarControl
        label="Video centre offset X (m)"
        value={tuning.interiorVideoCenterOffsetX}
        min={L.interiorVideoCenterOffsetX.min}
        max={L.interiorVideoCenterOffsetX.max}
        step={L.interiorVideoCenterOffsetX.step}
        nudge={L.interiorVideoCenterOffsetX.nudge}
        format={(v) => v.toFixed(3)}
        onChange={(v) => onChange("interiorVideoCenterOffsetX", v)}
      />
      <BarControl
        label="Video centre offset Y (m)"
        value={tuning.interiorVideoCenterOffsetY}
        min={L.interiorVideoCenterOffsetY.min}
        max={L.interiorVideoCenterOffsetY.max}
        step={L.interiorVideoCenterOffsetY.step}
        nudge={L.interiorVideoCenterOffsetY.nudge}
        format={(v) => v.toFixed(3)}
        onChange={(v) => onChange("interiorVideoCenterOffsetY", v)}
      />
      <BarControl
        label="Fire offset X (m)"
        value={tuning.interiorFireOffsetX}
        min={L.interiorFireOffsetX.min}
        max={L.interiorFireOffsetX.max}
        step={L.interiorFireOffsetX.step}
        nudge={L.interiorFireOffsetX.nudge}
        format={(v) => v.toFixed(3)}
        onChange={(v) => onChange("interiorFireOffsetX", v)}
      />
      <BarControl
        label="Video width scale"
        value={tuning.interiorVideoWidthScale}
        min={L.interiorVideoWidthScale.min}
        max={L.interiorVideoWidthScale.max}
        step={L.interiorVideoWidthScale.step}
        nudge={L.interiorVideoWidthScale.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("interiorVideoWidthScale", v)}
      />
      <BarControl
        label="Video height scale"
        value={tuning.interiorVideoHeightScale}
        min={L.interiorVideoHeightScale.min}
        max={L.interiorVideoHeightScale.max}
        step={L.interiorVideoHeightScale.step}
        nudge={L.interiorVideoHeightScale.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("interiorVideoHeightScale", v)}
      />
      <BarControl
        label="Video clip bottom (V)"
        value={tuning.interiorFlameTexBottom}
        min={L.interiorFlameTexBottom.min}
        max={L.interiorFlameTexBottom.max}
        step={L.interiorFlameTexBottom.step}
        nudge={L.interiorFlameTexBottom.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("interiorFlameTexBottom", v)}
      />
      <BarControl
        label="Video clip top (V)"
        value={tuning.interiorFlameTexTop}
        min={L.interiorFlameTexTop.min}
        max={L.interiorFlameTexTop.max}
        step={L.interiorFlameTexTop.step}
        nudge={L.interiorFlameTexTop.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("interiorFlameTexTop", v)}
      />
      <p className="settingsHint" style={{ marginTop: 0 }}>
        Centre offsets shift the fire screen in barrel space (Y = up). Fire offset X stacks on
        centre X for the flame video and flicker light. Scale 1.0 = base fit, up to 24×. Clip
        bottom/top pick which rows of the MP4 map to the plane (0 = bottom of frame, 1 = top).
        Clip top can go above 1.0 to push more of the frame toward the plane top (samples clamp at
        the top edge).
      </p>

      <p className="settingsGroup">Cylinder wall + rim</p>
      <BarControl
        label="Rim UV repeat (U)"
        value={tuning.rimTileU}
        min={L.rimTileU.min}
        max={L.rimTileU.max}
        step={L.rimTileU.step}
        nudge={L.rimTileU.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("rimTileU", v)}
      />
      <BarControl
        label="Rim UV repeat (V)"
        value={tuning.rimTileV}
        min={L.rimTileV.min}
        max={L.rimTileV.max}
        step={L.rimTileV.step}
        nudge={L.rimTileV.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("rimTileV", v)}
      />
      <p className="settingsHint" style={{ marginTop: 0 }}>
        Scales UVs on the rounded lip only (wall cylinder unchanged). 1 = one body texture wrap;
        higher = more repeats (RepeatWrapping).
      </p>
      <BarControl
        label="Body brightness"
        value={tuning.bodyBrightness}
        min={L.bodyBrightness.min}
        max={L.bodyBrightness.max}
        step={L.bodyBrightness.step}
        nudge={L.bodyBrightness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("bodyBrightness", v)}
      />

      <p className="settingsGroup">Top / bottom caps</p>
      <BarControl
        label="Cap brightness"
        value={tuning.capBrightness}
        min={L.capBrightness.min}
        max={L.capBrightness.max}
        step={L.capBrightness.step}
        nudge={L.capBrightness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("capBrightness", v)}
      />
      <BarControl
        label="Cap contrast"
        value={tuning.capContrast}
        min={L.capContrast.min}
        max={L.capContrast.max}
        step={L.capContrast.step}
        nudge={L.capContrast.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("capContrast", v)}
      />
      <BarControl
        label="Cap normal strength"
        value={tuning.capNormalScale}
        min={L.capNormalScale.min}
        max={L.capNormalScale.max}
        step={L.capNormalScale.step}
        nudge={L.capNormalScale.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("capNormalScale", v)}
      />
      <p className="settingsGroup">Shared</p>
      <BarControl
        label="Warmth (G)"
        value={tuning.warmth}
        min={L.warmth.min}
        max={L.warmth.max}
        step={L.warmth.step}
        nudge={L.warmth.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("warmth", v)}
      />
      <BarControl
        label="Blue tint (B)"
        value={tuning.blueTint}
        min={L.blueTint.min}
        max={L.blueTint.max}
        step={L.blueTint.step}
        nudge={L.blueTint.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("blueTint", v)}
      />
      <BarControl
        label="Roughness"
        value={tuning.roughness}
        min={L.roughness.min}
        max={L.roughness.max}
        step={L.roughness.step}
        nudge={L.roughness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("roughness", v)}
      />
      <BarControl
        label="Emissive lights"
        value={tuning.emissiveIntensity}
        min={L.emissiveIntensity.min}
        max={L.emissiveIntensity.max}
        step={L.emissiveIntensity.step}
        nudge={L.emissiveIntensity.nudge}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onChange("emissiveIntensity", v)}
      />
      <BarControl
        label="Normal strength"
        value={tuning.normalScale}
        min={L.normalScale.min}
        max={L.normalScale.max}
        step={L.normalScale.step}
        nudge={L.normalScale.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onChange("normalScale", v)}
      />

      <p className="settingsHint">
        Cap contrast adjusts the endcap albedo in code — no new PNG needed for tuning.
        Copy JSON includes <code>topCap</code> for level props when omitted there.
      </p>

      {onPileGenerate && (
        <>
          <p className="settingsGroup">Barrel pile (AI-authored)</p>
          <p className="settingsHint" style={{ marginTop: 0 }}>
            Layout lives in <code>LEVEL1_OIL_BARREL_PILE_DEFS</code> — edit with AI (see{" "}
            <code>docs/OIL_BARREL_PILE_AI.md</code>). Not procedural: dumped scatter on the
            floor, one optional stack. Apply moves hub X/Z; heights snap at spawn.
          </p>
          <div className="poseControl">
            <span className="sliderLabel">Hub X / Z (m)</span>
            <div className="poseNudgeRow">
              <input
                type="number"
                className="poseNumber"
                step={0.05}
                value={parseFloat(pileHubX.toFixed(3))}
                onChange={(e) => {
                  const x = parseFloat(e.target.value);
                  if (!Number.isNaN(x)) onPileHubChange?.(x, pileHubZ);
                }}
              />
              <input
                type="number"
                className="poseNumber"
                step={0.05}
                value={parseFloat(pileHubZ.toFixed(3))}
                onChange={(e) => {
                  const z = parseFloat(e.target.value);
                  if (!Number.isNaN(z)) onPileHubChange?.(pileHubX, z);
                }}
              />
            </div>
          </div>
          <div className="tunePanelHeaderActions" style={{ marginTop: "0.35rem" }}>
            <button
              type="button"
              className="tunePanelHeaderBtn"
              disabled={pileBusy}
              onClick={onPileGenerate}
            >
              {pileBusy ? "Applying…" : "Apply pile layout"}
            </button>
            {onPileCheck && (
              <button type="button" className="tunePanelHeaderBtn" onClick={onPileCheck}>
                Check pile
              </button>
            )}
            {onPileCopyJson && (
              <button type="button" className="tunePanelHeaderBtn" onClick={onPileCopyJson}>
                Copy pile JSON
              </button>
            )}
          </div>
          {pileStatus ? (
            <p className="stairTuneHint" style={{ marginTop: "0.5rem" }}>
              {pileStatus}
            </p>
          ) : null}
          <p className="stairTuneHint">
            CLI: <code>npm run pile:barrels</code>,{" "}
            <code>npm run pile:barrels:check</code>
          </p>
        </>
      )}
    </div>
  );
}
