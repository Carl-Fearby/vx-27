"use client";

import { createPortal } from "react-dom";
import {
  addBarrelToPlacement,
  BARREL_PLACEMENT_GROUPS,
  BARREL_PLACEMENT_POS_LIMITS,
  BARREL_PLACEMENT_ROT_LIMITS,
  barrelPlacementYLimits,
  canRemoveBarrelTarget,
  formatOilBarrelPlacementJson,
  getAddedBarrelOptions,
  getBarrelPlacementForTarget,
  isBarrelPlacementGroupTarget,
  LAY_ON_SIDE_ROTATION_Z,
  layOnSideTiltZ,
  LEVEL1_LOOSE_BARREL_OPTIONS,
  LEVEL1_PILE_BARREL_OPTIONS,
  patchOilBarrelGroupHub,
  patchOilBarrelSingle,
  removeBarrelFromPlacement,
  resetOilBarrelPlacementState,
  saveOilBarrelPlacementState,
} from "@/lib/oil-barrel/OilBarrelPlacementTuning";

const POS = BARREL_PLACEMENT_POS_LIMITS;
const ROT = BARREL_PLACEMENT_ROT_LIMITS;

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
 *   state: import("@/lib/oil-barrel/OilBarrelPlacementTuning.js").OilBarrelPlacementState,
 *   sceneRoot: import("three").Object3D | null | undefined,
 *   floorY?: number,
 *   floorY?: number,
 *   onChange: (next: import("@/lib/oil-barrel/OilBarrelPlacementTuning.js").OilBarrelPlacementState) => void,
 *   onAddBarrel?: () => void,
 *   onClose?: () => void,
 * }} props
 */
export default function OilBarrelPlacementTunePanel({
  state,
  sceneRoot,
  floorY = 0,
  onChange,
  onAddBarrel,
  onClose,
}) {
  const groupTarget = isBarrelPlacementGroupTarget(state.target);
  const hub =
    state.target === "sePile"
      ? state.hubs.sePile
      : state.hubs.containerPile;
  const resolved = sceneRoot
    ? getBarrelPlacementForTarget(sceneRoot, state, state.target)
    : null;
  const single = groupTarget
    ? null
    : (resolved ?? { x: 0, z: 0, rotationY: 0 });
  const layOnSideZ =
    single?.layOnSide === true
      ? layOnSideTiltZ(single)
      : (single?.rotationZ ?? 0);
  const yLimits = barrelPlacementYLimits(floorY);

  const patchHub = (partial) => {
    const groupKey = state.target === "sePile" ? "sePile" : "containerPile";
    onChange(patchOilBarrelGroupHub(state, groupKey, partial));
  };

  const patchSingle = (partial) => {
    onChange(patchOilBarrelSingle(state, sceneRoot, state.target, floorY, partial));
  };

  const panel = (
    <aside
      className="weaponTunePanel oilBarrelPlacementTunePanel"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="weaponTunePanelHeader">
        <div className="tunePanelHeader">
          <strong>Oil barrel placement</strong>
          {onClose ? (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close oil barrel placement"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="weaponTunePanelScroll">
        <p className="settingsHint">
          Close settings and walk the pile with WASD and arrow keys (no mouse
          look). Click a barrel to select it; click the same barrel again to
          select its group. Entering edit keeps JSON spawn (including stacks); hub X/Z
          moves the group only after you change a slider; tune one
          barrel — X/Z overlap auto-stacks while editing; rotation re-seats on
          floor or stack; Y overrides height (Copy JSON includes <code>y</code> for
          stacked barrels.) Paste into <code>level1.json</code> <code>props</code>.
        </p>
        <label className="settingsGroupLabel" htmlFor="barrel-placement-target">
          Target
        </label>
        <select
          id="barrel-placement-target"
          className="settingsSelect"
          value={state.target}
          onChange={(e) => onChange({ ...state, target: e.target.value })}
        >
          <optgroup label="Groups">
            {Object.values(BARREL_PLACEMENT_GROUPS).map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Container pile barrels">
            {LEVEL1_PILE_BARREL_OPTIONS.filter((o) => !o.id.includes("_se_")).map(
              (o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ),
            )}
          </optgroup>
          <optgroup label="SE pile barrels">
            {LEVEL1_PILE_BARREL_OPTIONS.filter((o) => o.id.includes("_se_")).map(
              (o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ),
            )}
          </optgroup>
          <optgroup label="Loose barrels">
            {LEVEL1_LOOSE_BARREL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Added barrels">
            {getAddedBarrelOptions(state).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} (added)
              </option>
            ))}
          </optgroup>
        </select>
        {groupTarget ? (
          <>
            <p className="settingsGroupLabel">Group hub</p>
            <SliderField
              label="Hub X"
              value={hub.x}
              min={POS.min}
              max={POS.max}
              step={POS.step}
              nudgeStep={POS.nudge}
              onChange={(x) => patchHub({ x })}
            />
            <SliderField
              label="Hub Z"
              value={hub.z}
              min={POS.min}
              max={POS.max}
              step={POS.step}
              nudgeStep={POS.nudge}
              onChange={(z) => patchHub({ z })}
            />
            <SliderField
              label="Hub rotation Y"
              value={hub.rotationY}
              min={ROT.min}
              max={ROT.max}
              step={ROT.step}
              nudgeStep={ROT.nudge}
              onChange={(rotationY) => patchHub({ rotationY })}
            />
          </>
        ) : (
          <>
            <p className="settingsGroupLabel">Single barrel</p>
            <SliderField
              label="X"
              value={single?.x ?? 0}
              min={POS.min}
              max={POS.max}
              step={POS.step}
              nudgeStep={POS.nudge}
              onChange={(x) => patchSingle({ x })}
            />
            <SliderField
              label="Z"
              value={single?.z ?? 0}
              min={POS.min}
              max={POS.max}
              step={POS.step}
              nudgeStep={POS.nudge}
              onChange={(z) => patchSingle({ z })}
            />
            <SliderField
              label="Y (foot)"
              value={single?.y ?? floorY}
              min={yLimits.min}
              max={yLimits.max}
              step={yLimits.step}
              nudgeStep={yLimits.nudge}
              onChange={(y) => patchSingle({ y })}
            />
            <SliderField
              label="Rotation Y"
              value={single?.rotationY ?? 0}
              min={ROT.min}
              max={ROT.max}
              step={ROT.step}
              nudgeStep={ROT.nudge}
              onChange={(rotationY) => patchSingle({ rotationY, layOnSide: false })}
            />
            <SliderField
              label="Rotation X"
              value={single?.rotationX ?? 0}
              min={ROT.min}
              max={ROT.max}
              step={ROT.step}
              nudgeStep={ROT.nudge}
              onChange={(rotationX) => patchSingle({ rotationX, layOnSide: false })}
            />
            <SliderField
              label="Rotation Z"
              value={layOnSideZ}
              min={ROT.min}
              max={ROT.max}
              step={ROT.step}
              nudgeStep={ROT.nudge}
              onChange={(rotationZ) =>
                patchSingle(
                  single?.layOnSide
                    ? { rotationZ, layOnSide: true }
                    : { rotationZ, layOnSide: false },
                )
              }
            />
            <label className="settingsCheckboxRow">
              <input
                type="checkbox"
                checked={single?.interiorFire === true}
                onChange={(e) =>
                  patchSingle(
                    e.target.checked
                      ? { interiorFire: true, topCap: false }
                      : { interiorFire: false, topCap: true },
                  )
                }
              />
              Fire (open top)
            </label>
            <label className="settingsCheckboxRow">
              <input
                type="checkbox"
                checked={single?.layOnSide === true}
                onChange={(e) =>
                  patchSingle(
                    e.target.checked
                      ? {
                          layOnSide: true,
                          rotationY: single?.rotationY ?? 0,
                          rotationZ: LAY_ON_SIDE_ROTATION_Z,
                          rotationX: 0,
                        }
                      : {
                          layOnSide: false,
                          rotationX: 0,
                          rotationY: single?.rotationY ?? 0,
                          rotationZ: 0,
                        },
                  )
                }
              />
              Lay on side
            </label>
          </>
        )}
        <div className="weaponTunePanelBtnRow">
          <button
            type="button"
            className="settingsBtn settingsInlineBtn"
            disabled={!sceneRoot}
            onClick={() => {
              if (!sceneRoot) return;
              if (onAddBarrel) {
                onAddBarrel();
                return;
              }
              onChange(addBarrelToPlacement(state, sceneRoot, floorY));
            }}
          >
            Add barrel
          </button>
          <button
            type="button"
            className="settingsBtn settingsInlineBtn"
            disabled={!sceneRoot || !canRemoveBarrelTarget(state)}
            onClick={() => {
              if (!sceneRoot || !canRemoveBarrelTarget(state)) return;
              onChange(
                removeBarrelFromPlacement(state, sceneRoot, state.target),
              );
            }}
          >
            Remove barrel
          </button>
        </div>
      </div>
      <div className="weaponTunePanelFooter">
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            const next = resetOilBarrelPlacementState();
            onChange(next);
            saveOilBarrelPlacementState(next);
          }}
        >
          Reset defaults
        </button>
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            if (!sceneRoot) return;
            navigator.clipboard?.writeText(
              formatOilBarrelPlacementJson(state, sceneRoot, floorY),
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
