"use client";

import { createPortal } from "react-dom";
import {
  CARGO_DOORS_DEFAULT,
  CARGO_MODULE_DOOR_GEOMETRY_DEFAULT,
  formatCargoModuleDoorTuningJson,
  saveCargoModuleDoorTuning,
} from "@/lib/vx27-container/CargoModuleDoorGeometryTuning";
import {
  VX27_CONTAINER_DOOR_LIMITS,
  VX27_DOOR_MAX_OPEN_DEG,
} from "@/lib/vx27-container/Vx27ContainerDoorTuning";

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
 *   tuning: import("@/lib/vx27-container/CargoModuleDoorGeometryTuning.js").CargoModuleDoorTuning,
 *   onChange: (next: import("@/lib/vx27-container/CargoModuleDoorGeometryTuning.js").CargoModuleDoorTuning) => void,
 *   onClose?: () => void,
 * }} props
 */
export default function Vx27ContainerDoorTunePanel({ tuning, onChange, onClose }) {
  const L = VX27_CONTAINER_DOOR_LIMITS;
  const patch = (partial) => onChange({ ...tuning, ...partial });

  const doorFields = [
    { key: "frontLeftOpen", label: "Front left open °" },
    { key: "frontRightOpen", label: "Front right open °" },
    { key: "backLeftOpen", label: "Back left open °" },
    { key: "backRightOpen", label: "Back right open °" },
  ];

  const panel = (
    <aside
      className="weaponTunePanel vx27ContainerDoorTunePanel"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="weaponTunePanelHeader">
        <div className="tunePanelHeader">
          <strong>Cargo door geometry</strong>
          {onClose ? (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close cargo door geometry"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="weaponTunePanelScroll">
        <p className="settingsHint">
          Close settings and inspect the cargo module doors. Door hinge axis is on
          the leaf; inframe sliders move the frame hinge lines from the sill and
          side edges. Geometry changes rebuild meshes live; open angles update
          instantly. Paste JSON into <code>level1.json</code>{" "}
          <code>doorTuning</code>.
        </p>
        <SliderField
          label="Door hinge axis (m from door edge)"
          value={tuning.sideOffset}
          min={L.sideOffset.min}
          max={L.sideOffset.max}
          step={L.sideOffset.step}
          nudgeStep={L.sideOffset.nudge}
          onChange={(sideOffset) => patch({ sideOffset })}
        />
        <SliderField
          label="Door width (m)"
          value={tuning.width}
          min={L.width.min}
          max={L.width.max}
          step={L.width.step}
          nudgeStep={L.width.nudge}
          onChange={(width) => patch({ width })}
        />
        <SliderField
          label="Door height (m)"
          value={tuning.height}
          min={L.height.min}
          max={L.height.max}
          step={L.height.step}
          nudgeStep={L.height.nudge}
          onChange={(height) => patch({ height })}
        />
        <p className="settingsGroupLabel">Frame inframe (hinge on frame)</p>
        <SliderField
          label="Frame hinge from sill (m)"
          value={tuning.bottomOffset}
          min={L.bottomOffset.min}
          max={L.bottomOffset.max}
          step={L.bottomOffset.step}
          nudgeStep={L.bottomOffset.nudge}
          onChange={(bottomOffset) => patch({ bottomOffset })}
        />
        <SliderField
          label="Frame hinge from edge (m)"
          value={tuning.inframeFromEdge}
          min={L.inframeFromEdge.min}
          max={L.inframeFromEdge.max}
          step={L.inframeFromEdge.step}
          nudgeStep={L.inframeFromEdge.nudge}
          onChange={(inframeFromEdge) => patch({ inframeFromEdge })}
        />
        <p className="settingsGroupLabel">Open angles (0 = shut, 135 = open)</p>
        {doorFields.map(({ key, label }) => (
          <SliderField
            key={key}
            label={label}
            value={tuning[key]}
            min={0}
            max={VX27_DOOR_MAX_OPEN_DEG}
            step={1}
            nudgeStep={5}
            decimals={0}
            onChange={(value) => patch({ [key]: value })}
          />
        ))}
      </div>
      <div className="weaponTunePanelFooter">
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            const next = {
              ...CARGO_MODULE_DOOR_GEOMETRY_DEFAULT,
              ...CARGO_DOORS_DEFAULT,
            };
            onChange(next);
            saveCargoModuleDoorTuning(next);
          }}
        >
          Reset defaults
        </button>
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            navigator.clipboard?.writeText(formatCargoModuleDoorTuningJson(tuning));
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
