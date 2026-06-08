import * as THREE from "three";
import { formatBindingValue } from "../player/KeyBindings.js";
import { isControlPanelScreenCHackBlocked } from "./ControlPanelScreenCHackFlash.js";

/** Max distance from camera to console interact point (m). */
export const CONTROL_PANEL_HACK_MAX_DIST = 2.5;

/** Minimum dot(camera forward, direction to panel) to count as facing. */
export const CONTROL_PANEL_HACK_MIN_FACING = 0.35;

const _panelPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _toPanel = new THREE.Vector3();
const _camFwd = new THREE.Vector3();

/** @param {THREE.Group} group */
export function getControlPanelInteractPoint(group) {
  const height = group.userData.controlPanelHeight ?? 1.65;
  group.getWorldPosition(_panelPos);
  _panelPos.y += height * 0.45;
  return _panelPos;
}

/** @param {THREE.Object3D | null | undefined} obj */
export function findControlPanelGroup(obj) {
  let p = obj;
  while (p) {
    if (p.userData?.controlPanel) return /** @type {THREE.Group} */ (p);
    p = p.parent;
  }
  return null;
}

/**
 * Nearest hackable console the player is close to and roughly facing.
 * @param {THREE.Camera} camera
 * @param {THREE.Group[]} panels
 * @param {number} [maxDist]
 */
export function findNearestHackableControlPanel(
  camera,
  panels,
  maxDist = CONTROL_PANEL_HACK_MAX_DIST,
) {
  if (!panels.length) return null;

  _camPos.copy(camera.position);
  camera.getWorldDirection(_camFwd);

  /** @type {{ group: THREE.Group, distance: number } | null} */
  let best = null;

  for (const group of panels) {
    if (!group?.userData?.controlPanel) continue;
    if (isControlPanelScreenCHackBlocked(group)) continue;
    getControlPanelInteractPoint(group);
    _toPanel.subVectors(_panelPos, _camPos);
    const dist = _toPanel.length();
    if (dist > maxDist) continue;
    _toPanel.multiplyScalar(1 / dist);
    if (_camFwd.dot(_toPanel) < CONTROL_PANEL_HACK_MIN_FACING) continue;
    if (!best || dist < best.distance) {
      best = { group, distance: dist };
    }
  }

  return best;
}

/**
 * Nearest console the player is close to and roughly facing (tuning preview).
 * Unlike {@link findNearestHackableControlPanel}, does not skip flashing panels.
 *
 * @param {THREE.Camera} camera
 * @param {THREE.Group[]} panels
 * @param {number} [maxDist]
 */
export function findNearestFacingControlPanel(
  camera,
  panels,
  maxDist = CONTROL_PANEL_HACK_MAX_DIST,
) {
  if (!panels.length) return null;

  _camPos.copy(camera.position);
  camera.getWorldDirection(_camFwd);

  /** @type {{ group: THREE.Group, distance: number } | null} */
  let best = null;

  for (const group of panels) {
    if (!group?.userData?.controlPanel) continue;
    getControlPanelInteractPoint(group);
    _toPanel.subVectors(_panelPos, _camPos);
    const dist = _toPanel.length();
    if (dist > maxDist) continue;
    _toPanel.multiplyScalar(1 / dist);
    if (_camFwd.dot(_toPanel) < CONTROL_PANEL_HACK_MIN_FACING) continue;
    if (!best || dist < best.distance) {
      best = { group, distance: dist };
    }
  }

  return best;
}

/** @param {THREE.Group} group */
export function getControlPanelHackLabel(group) {
  const id = group.userData.controlPanelPropId;
  return id ? `Console ${id}` : "Control console";
}

/** @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings */
export function formatControlPanelHackKeyLabel(bindings) {
  return formatBindingValue(bindings.hack);
}

/**
 * @param {HTMLElement | null} el
 * @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings
 * @param {boolean} visible
 */
export function updateControlPanelHackPrompt(el, bindings, visible) {
  if (!el) return;
  if (!visible) {
    el.classList.remove("gameplayHintVisible");
    el.innerHTML = "";
    el.setAttribute("aria-hidden", "true");
    return;
  }

  const keyLabel = formatControlPanelHackKeyLabel(bindings);
  el.innerHTML = `<span class="gameplayHintKey">${keyLabel}</span><span class="gameplayHintText">to hack</span>`;
  el.classList.add("gameplayHintVisible");
  el.setAttribute("aria-hidden", "false");
}
