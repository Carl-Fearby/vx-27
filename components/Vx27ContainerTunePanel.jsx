"use client";

import {
  CONTAINER_EDGE_RADIUS_NUDGE,
  CONTAINER_EDGE_RADIUS_STEP,
  CONTAINER_EXTERIOR_CORNER_RADIUS_NUDGE,
  CONTAINER_EXTERIOR_CORNER_RADIUS_STEP,
  CONTAINER_INSET_NUDGE_STEP,
  CONTAINER_INSET_SLIDER_STEP,
  CONTAINER_VERTICAL_OFFSET_NUDGE,
  CONTAINER_VERTICAL_OFFSET_STEP,
  CONTAINER_POS_NUDGE_STEP,
  CONTAINER_POS_SLIDER_STEP,
  CONTAINER_ROTATION_NUDGE,
  CONTAINER_ROTATION_STEP,
  CONTAINER_SCALE_NUDGE,
  CONTAINER_SCALE_STEP,
  CONTAINER_Y_NUDGE_STEP,
  CONTAINER_Y_SLIDER_STEP,
  RAD_TO_DEG,
  VX27_EDGE_RADIUS_MAX,
  VX27_EDGE_RADIUS_MIN,
  VX27_EXTERIOR_CORNER_RADIUS_MAX,
  VX27_EXTERIOR_CORNER_RADIUS_MIN,
  VX27_CONTAINER_SCALE_MAX,
  VX27_CONTAINER_SCALE_MIN,
  VX27_INTERIOR_CEILING_OFFSET_MAX,
  VX27_INTERIOR_CEILING_OFFSET_MIN,
  VX27_INTERIOR_FLOOR_OFFSET_MAX,
  VX27_INTERIOR_FLOOR_OFFSET_MIN,
  VX27_INTERIOR_INSET_MAX,
  VX27_INTERIOR_INSET_MIN,
} from "@/lib/Vx27ContainerTuning";
import {
  VX27_CONTAINER_MATERIAL_LIMITS as ML,
} from "@/lib/Vx27ContainerMaterialTuning";
import { VX27_CONTAINER_DOOR_LIMITS as DL } from "@/lib/Vx27ContainerDoorTuning";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function AxisControl({
  label,
  value,
  min,
  max,
  sliderStep,
  nudgeStep,
  format,
  onChange,
  extraAction = null,
}) {
  const apply = (next) => onChange(clamp(next, min, max));
  const inputDecimals = sliderStep < 0.01 ? 4 : 3;

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
        step={sliderStep}
        value={value}
        onChange={(e) => apply(parseFloat(e.target.value))}
      />
      <div className={`poseNudgeRow${extraAction ? " poseNudgeRowWithExtra" : ""}`}>
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
          step={sliderStep}
          value={parseFloat(value.toFixed(inputDecimals))}
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
        {extraAction}
      </div>
    </div>
  );
}

export default function Vx27ContainerTunePanel({
  propLabel,
  propLabels = [],
  selectedIndex = 0,
  onSelectedIndexChange,
  bounds,
  floorDeckY,
  x,
  z,
  floorY,
  rotationY,
  scale = 1,
  onXChange,
  onZChange,
  onFloorYChange,
  onRotationChange,
  onScaleChange,
  insetLeft,
  insetRight,
  insetFront,
  insetBack,
  floorOffset,
  ceilingOffset,
  edgeRadius,
  exteriorCornerRadius,
  onInsetLeftChange,
  onInsetRightChange,
  onInsetFrontChange,
  onInsetBackChange,
  onFloorOffsetChange,
  onCeilingOffsetChange,
  onEdgeRadiusChange,
  onExteriorCornerRadiusChange,
  doorTuning,
  onDoorChange,
  doorWizardEnabled = false,
  onDoorWizardEnabledChange,
  materialTuning,
  onMaterialChange,
  onMaterialReset,
  onSnapToPlayer,
  onCopyJson,
  showCollidersOnly = false,
  onShowCollidersOnlyChange,
  onClose,
}) {
  const rotDeg = rotationY * RAD_TO_DEG;

  return (
    <div
      className="stairTunePanel"
      role="group"
      aria-label="VX-27 container placement"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tunePanelHeader">
        <p className="stairTuneTitle">VX-27 container</p>
        {onClose && (
          <button
            type="button"
            className="tunePanelClose"
            aria-label="Close container tuning"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      {propLabels.length > 1 && onSelectedIndexChange && (
        <label className="settingRow" style={{ marginBottom: "0.5rem" }}>
          <span className="settingsHint">Prop</span>
          <select
            style={{ marginLeft: "0.5rem", flex: 1, maxWidth: "100%" }}
            value={selectedIndex}
            onChange={(e) => onSelectedIndexChange(parseInt(e.target.value, 10))}
          >
            {propLabels.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      {propLabel && propLabels.length <= 1 && (
        <p className="settingsHint" style={{ marginTop: 0 }}>
          {propLabel}
        </p>
      )}

      <AxisControl
        label="X"
        value={x}
        min={bounds.minX}
        max={bounds.maxX}
        sliderStep={CONTAINER_POS_SLIDER_STEP}
        nudgeStep={CONTAINER_POS_NUDGE_STEP}
        format={(v) => v.toFixed(3)}
        onChange={onXChange}
      />
      <AxisControl
        label="Z"
        value={z}
        min={bounds.minZ}
        max={bounds.maxZ}
        sliderStep={CONTAINER_POS_SLIDER_STEP}
        nudgeStep={CONTAINER_POS_NUDGE_STEP}
        format={(v) => v.toFixed(3)}
        onChange={onZChange}
      />
      <AxisControl
        label="Floor Y"
        value={floorY}
        min={bounds.minY}
        max={bounds.maxY}
        sliderStep={CONTAINER_Y_SLIDER_STEP}
        nudgeStep={CONTAINER_Y_NUDGE_STEP}
        format={(v) => v.toFixed(4)}
        onChange={onFloorYChange}
        extraAction={
          <button
            type="button"
            className="poseNudgeBtn stairDeckSnapBtn"
            title="Snap container base to arena floor deck"
            onClick={() => onFloorYChange(floorDeckY)}
          >
            Deck
          </button>
        }
      />
      <AxisControl
        label="Rotation"
        value={rotationY}
        min={-Math.PI}
        max={Math.PI}
        sliderStep={CONTAINER_ROTATION_STEP}
        nudgeStep={CONTAINER_ROTATION_NUDGE}
        format={() => `${rotDeg.toFixed(1)}°`}
        onChange={onRotationChange}
      />
      {onScaleChange && (
        <AxisControl
          label="Scale"
          value={scale}
          min={VX27_CONTAINER_SCALE_MIN}
          max={VX27_CONTAINER_SCALE_MAX}
          sliderStep={CONTAINER_SCALE_STEP}
          nudgeStep={CONTAINER_SCALE_NUDGE}
          format={(v) => `${v.toFixed(3)}×`}
          onChange={onScaleChange}
        />
      )}

      <p className="settingsGroup">Interior wall inset (m from exterior)</p>
      <AxisControl
        label="Left"
        value={insetLeft}
        min={VX27_INTERIOR_INSET_MIN}
        max={VX27_INTERIOR_INSET_MAX}
        sliderStep={CONTAINER_INSET_SLIDER_STEP}
        nudgeStep={CONTAINER_INSET_NUDGE_STEP}
        format={(v) => v.toFixed(4)}
        onChange={onInsetLeftChange}
      />
      <AxisControl
        label="Right"
        value={insetRight}
        min={VX27_INTERIOR_INSET_MIN}
        max={VX27_INTERIOR_INSET_MAX}
        sliderStep={CONTAINER_INSET_SLIDER_STEP}
        nudgeStep={CONTAINER_INSET_NUDGE_STEP}
        format={(v) => v.toFixed(4)}
        onChange={onInsetRightChange}
      />
      <AxisControl
        label="Front (+Z)"
        value={insetFront}
        min={VX27_INTERIOR_INSET_MIN}
        max={VX27_INTERIOR_INSET_MAX}
        sliderStep={CONTAINER_INSET_SLIDER_STEP}
        nudgeStep={CONTAINER_INSET_NUDGE_STEP}
        format={(v) => v.toFixed(4)}
        onChange={onInsetFrontChange}
      />
      <AxisControl
        label="Back (−Z)"
        value={insetBack}
        min={VX27_INTERIOR_INSET_MIN}
        max={VX27_INTERIOR_INSET_MAX}
        sliderStep={CONTAINER_INSET_SLIDER_STEP}
        nudgeStep={CONTAINER_INSET_NUDGE_STEP}
        format={(v) => v.toFixed(4)}
        onChange={onInsetBackChange}
      />

      <p className="settingsGroup">Interior floor / ceiling offset (m)</p>
      <AxisControl
        label="Floor offset"
        value={floorOffset}
        min={VX27_INTERIOR_FLOOR_OFFSET_MIN}
        max={VX27_INTERIOR_FLOOR_OFFSET_MAX}
        sliderStep={CONTAINER_VERTICAL_OFFSET_STEP}
        nudgeStep={CONTAINER_VERTICAL_OFFSET_NUDGE}
        format={(v) => v.toFixed(4)}
        onChange={onFloorOffsetChange}
      />
      <AxisControl
        label="Ceiling offset"
        value={ceilingOffset}
        min={VX27_INTERIOR_CEILING_OFFSET_MIN}
        max={VX27_INTERIOR_CEILING_OFFSET_MAX}
        sliderStep={CONTAINER_VERTICAL_OFFSET_STEP}
        nudgeStep={CONTAINER_VERTICAL_OFFSET_NUDGE}
        format={(v) => v.toFixed(4)}
        onChange={onCeilingOffsetChange}
      />

      <p className="settingsGroup">Exterior shell</p>
      <AxisControl
        label="Edge radius (inset walls & end caps)"
        value={edgeRadius}
        min={VX27_EDGE_RADIUS_MIN}
        max={VX27_EDGE_RADIUS_MAX}
        sliderStep={CONTAINER_EDGE_RADIUS_STEP}
        nudgeStep={CONTAINER_EDGE_RADIUS_NUDGE}
        format={(v) => v.toFixed(4)}
        onChange={onEdgeRadiusChange}
      />
      <AxisControl
        label="Exterior corner radius — collision (0 = match edge)"
        value={exteriorCornerRadius}
        min={VX27_EXTERIOR_CORNER_RADIUS_MIN}
        max={VX27_EXTERIOR_CORNER_RADIUS_MAX}
        sliderStep={CONTAINER_EXTERIOR_CORNER_RADIUS_STEP}
        nudgeStep={CONTAINER_EXTERIOR_CORNER_RADIUS_NUDGE}
        format={(v) => v.toFixed(4)}
        onChange={onExteriorCornerRadiusChange}
      />

      {doorTuning && onDoorChange && (
        <>
          <p className="settingsGroup">End doors (double, both ends)</p>
          {onDoorWizardEnabledChange && (
            <label className="settingRow">
              <input
                type="checkbox"
                checked={doorWizardEnabled}
                onChange={(e) => onDoorWizardEnabledChange(e.target.checked)}
              />
              Door fit wizard (blue outline)
            </label>
          )}
          <AxisControl
            label="Door width"
            value={doorTuning.width}
            min={DL.width.min}
            max={DL.width.max}
            sliderStep={DL.width.step}
            nudgeStep={DL.width.nudge}
            format={(v) => v.toFixed(4)}
            onChange={(v) => onDoorChange("width", v)}
          />
          <AxisControl
            label="Door height"
            value={doorTuning.height}
            min={DL.height.min}
            max={DL.height.max}
            sliderStep={DL.height.step}
            nudgeStep={DL.height.nudge}
            format={(v) => v.toFixed(4)}
            onChange={(v) => onDoorChange("height", v)}
          />
          <AxisControl
            label="Door bottom offset"
            value={doorTuning.bottomOffset}
            min={DL.bottomOffset.min}
            max={DL.bottomOffset.max}
            sliderStep={DL.bottomOffset.step}
            nudgeStep={DL.bottomOffset.nudge}
            format={(v) => v.toFixed(4)}
            onChange={(v) => onDoorChange("bottomOffset", v)}
          />
          <AxisControl
            label="Door side offset (hinge inset)"
            value={doorTuning.sideOffset}
            min={DL.sideOffset.min}
            max={DL.sideOffset.max}
            sliderStep={DL.sideOffset.step}
            nudgeStep={DL.sideOffset.nudge}
            format={(v) => v.toFixed(4)}
            onChange={(v) => onDoorChange("sideOffset", v)}
          />
          <AxisControl
            label="Door thickness"
            value={doorTuning.thickness}
            min={DL.thickness.min}
            max={DL.thickness.max}
            sliderStep={DL.thickness.step}
            nudgeStep={DL.thickness.nudge}
            format={(v) => v.toFixed(4)}
            onChange={(v) => onDoorChange("thickness", v)}
          />
          <AxisControl
            label="Opening edge radius"
            value={doorTuning.openingEdgeRadius}
            min={DL.openingEdgeRadius.min}
            max={DL.openingEdgeRadius.max}
            sliderStep={DL.openingEdgeRadius.step}
            nudgeStep={DL.openingEdgeRadius.nudge}
            format={(v) => v.toFixed(4)}
            onChange={(v) => onDoorChange("openingEdgeRadius", v)}
          />
          <AxisControl
            label="Front left open"
            value={doorTuning.frontLeftOpen}
            min={DL.doorOpen.min}
            max={DL.doorOpen.max}
            sliderStep={DL.doorOpen.step}
            nudgeStep={DL.doorOpen.nudge}
            format={(v) => `${v.toFixed(0)}°`}
            onChange={(v) => onDoorChange("frontLeftOpen", v)}
          />
          <AxisControl
            label="Front right open"
            value={doorTuning.frontRightOpen}
            min={DL.doorOpen.min}
            max={DL.doorOpen.max}
            sliderStep={DL.doorOpen.step}
            nudgeStep={DL.doorOpen.nudge}
            format={(v) => `${v.toFixed(0)}°`}
            onChange={(v) => onDoorChange("frontRightOpen", v)}
          />
          <AxisControl
            label="Back left open"
            value={doorTuning.backLeftOpen}
            min={DL.doorOpen.min}
            max={DL.doorOpen.max}
            sliderStep={DL.doorOpen.step}
            nudgeStep={DL.doorOpen.nudge}
            format={(v) => `${v.toFixed(0)}°`}
            onChange={(v) => onDoorChange("backLeftOpen", v)}
          />
          <AxisControl
            label="Back right open"
            value={doorTuning.backRightOpen}
            min={DL.doorOpen.min}
            max={DL.doorOpen.max}
            sliderStep={DL.doorOpen.step}
            nudgeStep={DL.doorOpen.nudge}
            format={(v) => `${v.toFixed(0)}°`}
            onChange={(v) => onDoorChange("backRightOpen", v)}
          />
        </>
      )}

      <p className="settingsGroup">Exterior material</p>
      <AxisControl
        label="Brightness"
        value={materialTuning.exteriorBrightness}
        min={ML.exteriorBrightness.min}
        max={ML.exteriorBrightness.max}
        sliderStep={ML.exteriorBrightness.step}
        nudgeStep={ML.exteriorBrightness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("exteriorBrightness", v)}
      />
      <AxisControl
        label="Roughness"
        value={materialTuning.exteriorRoughness}
        min={ML.exteriorRoughness.min}
        max={ML.exteriorRoughness.max}
        sliderStep={ML.exteriorRoughness.step}
        nudgeStep={ML.exteriorRoughness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("exteriorRoughness", v)}
      />
      <AxisControl
        label="Metallic"
        value={materialTuning.exteriorMetalness}
        min={ML.exteriorMetalness.min}
        max={ML.exteriorMetalness.max}
        sliderStep={ML.exteriorMetalness.step}
        nudgeStep={ML.exteriorMetalness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("exteriorMetalness", v)}
      />
      <AxisControl
        label="Light intensity"
        value={materialTuning.exteriorEmissiveIntensity}
        min={ML.exteriorEmissiveIntensity.min}
        max={ML.exteriorEmissiveIntensity.max}
        sliderStep={ML.exteriorEmissiveIntensity.step}
        nudgeStep={ML.exteriorEmissiveIntensity.nudge}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onMaterialChange("exteriorEmissiveIntensity", v)}
      />
      <AxisControl
        label="Endcap texture scale"
        value={materialTuning.endcapTextureScale}
        min={ML.endcapTextureScale.min}
        max={ML.endcapTextureScale.max}
        sliderStep={ML.endcapTextureScale.step}
        nudgeStep={ML.endcapTextureScale.nudge}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(v) => onMaterialChange("endcapTextureScale", v)}
      />
      <AxisControl
        label="Roof/floor cap UV scale"
        value={materialTuning.roofFloorFootprintScale}
        min={ML.roofFloorFootprintScale.min}
        max={ML.roofFloorFootprintScale.max}
        sliderStep={ML.roofFloorFootprintScale.step}
        nudgeStep={ML.roofFloorFootprintScale.nudge}
        format={(v) => `${(v * 100).toFixed(1)}%`}
        onChange={(v) => onMaterialChange("roofFloorFootprintScale", v)}
      />
      <AxisControl
        label="Roof/floor edge UV repeat U"
        value={materialTuning.roofFloorUvRepeatU}
        min={ML.roofFloorUvRepeatU.min}
        max={ML.roofFloorUvRepeatU.max}
        sliderStep={ML.roofFloorUvRepeatU.step}
        nudgeStep={ML.roofFloorUvRepeatU.nudge}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(v) => onMaterialChange("roofFloorUvRepeatU", v)}
      />
      <AxisControl
        label="Roof/floor edge UV repeat V"
        value={materialTuning.roofFloorUvRepeatV}
        min={ML.roofFloorUvRepeatV.min}
        max={ML.roofFloorUvRepeatV.max}
        sliderStep={ML.roofFloorUvRepeatV.step}
        nudgeStep={ML.roofFloorUvRepeatV.nudge}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(v) => onMaterialChange("roofFloorUvRepeatV", v)}
      />
      <AxisControl
        label="Corner bevel UV repeat U"
        value={materialTuning.cornerBevelUvRepeatU}
        min={ML.cornerBevelUvRepeatU.min}
        max={ML.cornerBevelUvRepeatU.max}
        sliderStep={ML.cornerBevelUvRepeatU.step}
        nudgeStep={ML.cornerBevelUvRepeatU.nudge}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(v) => onMaterialChange("cornerBevelUvRepeatU", v)}
      />
      <AxisControl
        label="Corner bevel UV repeat V"
        value={materialTuning.cornerBevelUvRepeatV}
        min={ML.cornerBevelUvRepeatV.min}
        max={ML.cornerBevelUvRepeatV.max}
        sliderStep={ML.cornerBevelUvRepeatV.step}
        nudgeStep={ML.cornerBevelUvRepeatV.nudge}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(v) => onMaterialChange("cornerBevelUvRepeatV", v)}
      />
      <AxisControl
        label="Corner bevel brightness"
        value={materialTuning.cornerBevelBrightness}
        min={ML.cornerBevelBrightness.min}
        max={ML.cornerBevelBrightness.max}
        sliderStep={ML.cornerBevelBrightness.step}
        nudgeStep={ML.cornerBevelBrightness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("cornerBevelBrightness", v)}
      />
      <AxisControl
        label="Corner bevel roughness"
        value={materialTuning.cornerBevelRoughness}
        min={ML.cornerBevelRoughness.min}
        max={ML.cornerBevelRoughness.max}
        sliderStep={ML.cornerBevelRoughness.step}
        nudgeStep={ML.cornerBevelRoughness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("cornerBevelRoughness", v)}
      />
      <AxisControl
        label="Corner bevel metallic"
        value={materialTuning.cornerBevelMetalness}
        min={ML.cornerBevelMetalness.min}
        max={ML.cornerBevelMetalness.max}
        sliderStep={ML.cornerBevelMetalness.step}
        nudgeStep={ML.cornerBevelMetalness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("cornerBevelMetalness", v)}
      />
      <AxisControl
        label="Door texture scale"
        value={materialTuning.doorTextureScale}
        min={ML.doorTextureScale.min}
        max={ML.doorTextureScale.max}
        sliderStep={ML.doorTextureScale.step}
        nudgeStep={ML.doorTextureScale.nudge}
        format={(v) => `${v.toFixed(2)}x`}
        onChange={(v) => onMaterialChange("doorTextureScale", v)}
      />

      <p className="settingsGroup">Interior material</p>
      <AxisControl
        label="Brightness"
        value={materialTuning.interiorBrightness}
        min={ML.interiorBrightness.min}
        max={ML.interiorBrightness.max}
        sliderStep={ML.interiorBrightness.step}
        nudgeStep={ML.interiorBrightness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("interiorBrightness", v)}
      />
      <AxisControl
        label="Roughness"
        value={materialTuning.interiorRoughness}
        min={ML.interiorRoughness.min}
        max={ML.interiorRoughness.max}
        sliderStep={ML.interiorRoughness.step}
        nudgeStep={ML.interiorRoughness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("interiorRoughness", v)}
      />
      <AxisControl
        label="Metallic"
        value={materialTuning.interiorMetalness}
        min={ML.interiorMetalness.min}
        max={ML.interiorMetalness.max}
        sliderStep={ML.interiorMetalness.step}
        nudgeStep={ML.interiorMetalness.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("interiorMetalness", v)}
      />
      <AxisControl
        label="Light intensity"
        value={materialTuning.interiorEmissiveIntensity}
        min={ML.interiorEmissiveIntensity.min}
        max={ML.interiorEmissiveIntensity.max}
        sliderStep={ML.interiorEmissiveIntensity.step}
        nudgeStep={ML.interiorEmissiveIntensity.nudge}
        format={(v) => v.toFixed(1)}
        onChange={(v) => onMaterialChange("interiorEmissiveIntensity", v)}
      />

      <p className="settingsGroup">Shared</p>
      <AxisControl
        label="Normal strength"
        value={materialTuning.normalScale}
        min={ML.normalScale.min}
        max={ML.normalScale.max}
        sliderStep={ML.normalScale.step}
        nudgeStep={ML.normalScale.nudge}
        format={(v) => v.toFixed(2)}
        onChange={(v) => onMaterialChange("normalScale", v)}
      />

      {onShowCollidersOnlyChange && (
        <>
          <p className="settingsGroup">Debug</p>
          <label className="settingRow">
            <input
              type="checkbox"
              checked={showCollidersOnly}
              onChange={(e) => onShowCollidersOnlyChange(e.target.checked)}
            />
            Show colliders (this container only)
          </label>
        </>
      )}

      <div className="weaponTuneActions">
        {onMaterialReset && (
          <button type="button" className="settingsBtn" onClick={onMaterialReset}>
            Reset materials
          </button>
        )}
        {onSnapToPlayer && (
          <button type="button" className="settingsBtn" onClick={onSnapToPlayer}>
            Snap to player
          </button>
        )}
        {onCopyJson && (
          <button type="button" className="settingsBtn" onClick={onCopyJson}>
            Copy JSON
          </button>
        )}
      </div>

      <p className="stairTuneHint">
        Anchor = container floor (base). 0° rotation faces +Z. Bounds cover arena and
        attached rooms. Floor deck ≈ {floorDeckY.toFixed(3)} m. ± nudge{" "}
        {CONTAINER_POS_NUDGE_STEP} m / {CONTAINER_Y_NUDGE_STEP} m /{" "}
        {(CONTAINER_ROTATION_NUDGE * RAD_TO_DEG).toFixed(1)}°
      </p>
    </div>
  );
}
