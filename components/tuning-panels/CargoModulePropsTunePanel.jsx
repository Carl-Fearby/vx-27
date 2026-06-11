"use client";

import { createPortal } from "react-dom";
import {
  CARGO_BARREL_DEFAULT,
  CARGO_CONSOLE_DEFAULT,
  formatCargoModulePropsJson,
  saveCargoModulePropsPlacement,
} from "@/lib/vx27-container/CargoModulePropsTuning";

const POS_MIN = -6;
const POS_MAX = -1;
const Z_MIN = 4;
const Z_MAX = 13;
const ROT_MIN = -3.14;
const ROT_MAX = 3.14;
const POS_STEP = 0.01;
const ROT_STEP = 0.01;
const NUDGE_POS = 0.025;
const NUDGE_ROT = 0.05;

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
 *   placement: import("@/lib/vx27-container/CargoModulePropsTuning.js").CargoModulePropsPlacement,
 *   onChange: (next: import("@/lib/vx27-container/CargoModulePropsTuning.js").CargoModulePropsPlacement) => void,
 *   onClose?: () => void,
 * }} props
 */
export default function CargoModulePropsTunePanel({ placement, onChange, onClose }) {
  const patchConsole = (partial) =>
    onChange({
      ...placement,
      console: { ...placement.console, ...partial },
    });

  const patchBarrel = (partial) =>
    onChange({
      ...placement,
      barrel: { ...placement.barrel, ...partial },
    });

  const panel = (
    <aside
      className="weaponTunePanel cargoModulePropsTunePanel"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="weaponTunePanelHeader">
        <div className="tunePanelHeader">
          <strong>Cargo module props</strong>
          {onClose ? (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close cargo module props"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="weaponTunePanelScroll">
        <p className="settingsHint">
          Close settings and walk the container — props move live. Console at the
          door end, barrel on the opposite corner.
        </p>
        <p className="settingsGroupLabel">Console</p>
        <SliderField
          label="X"
          value={placement.console.x}
          min={POS_MIN}
          max={POS_MAX}
          step={POS_STEP}
          nudgeStep={NUDGE_POS}
          onChange={(x) => patchConsole({ x })}
        />
        <SliderField
          label="Z"
          value={placement.console.z}
          min={Z_MIN}
          max={Z_MAX}
          step={POS_STEP}
          nudgeStep={NUDGE_POS}
          onChange={(z) => patchConsole({ z })}
        />
        <SliderField
          label="Rotation Y"
          value={placement.console.rotationY}
          min={ROT_MIN}
          max={ROT_MAX}
          step={ROT_STEP}
          nudgeStep={NUDGE_ROT}
          onChange={(rotationY) => patchConsole({ rotationY })}
        />
        <p className="settingsGroupLabel">Barrel</p>
        <SliderField
          label="X"
          value={placement.barrel.x}
          min={POS_MIN}
          max={POS_MAX}
          step={POS_STEP}
          nudgeStep={NUDGE_POS}
          onChange={(x) => patchBarrel({ x })}
        />
        <SliderField
          label="Z"
          value={placement.barrel.z}
          min={Z_MIN}
          max={Z_MAX}
          step={POS_STEP}
          nudgeStep={NUDGE_POS}
          onChange={(z) => patchBarrel({ z })}
        />
      </div>
      <div className="weaponTunePanelFooter">
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            const next = {
              console: { ...CARGO_CONSOLE_DEFAULT },
              barrel: { ...CARGO_BARREL_DEFAULT },
            };
            onChange(next);
            saveCargoModulePropsPlacement(next);
          }}
        >
          Reset defaults
        </button>
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            navigator.clipboard?.writeText(
              formatCargoModulePropsJson(placement),
            );
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
