import * as THREE from "three";
import { isBulletPassthroughMesh } from "../combat/BulletHoles.js";
import { formatBindingValue } from "../player/KeyBindings.js";
import { isControlPanelScreenCHackBlocked } from "./ControlPanelScreenCHackFlash.js";

/** Max distance from camera to console interact point (m). */
export const CONTROL_PANEL_HACK_MAX_DIST = 2.5;

/** Minimum dot(camera forward, direction to panel) to count as facing. */
export const CONTROL_PANEL_HACK_MIN_FACING = 0.35;

/** Minimum dot(panel→camera, panel front) — player must stand in front, not behind. */
export const CONTROL_PANEL_HACK_MIN_FRONT = 0.2;

/** Console screen + front hull — not container geometry or side panels. */
const HACK_INTERACT_MESH_NAMES = new Set([
  "control_panel_screen_c",
  "control_panel_mesh",
]);

const _panelPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _toPanel = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const _panelFront = new THREE.Vector3();
const _hitNormal = new THREE.Vector3();
const _hits = [];

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

/** @param {THREE.Object3D | null | undefined} obj */
function isControlPanelHackInteractMesh(obj) {
  return obj?.isMesh && HACK_INTERACT_MESH_NAMES.has(obj.name);
}

/** @param {THREE.Group} group @param {THREE.Camera} camera */
function isPlayerInFrontOfControlPanel(group, camera) {
  getControlPanelInteractPoint(group);
  _camPos.copy(camera.position);
  _toCam.subVectors(_camPos, _panelPos);
  _toCam.y = 0;
  if (_toCam.lengthSq() < 1e-8) return false;
  _toCam.normalize();

  _panelFront.set(-1, 0, 0);
  _panelFront.applyQuaternion(group.quaternion);
  _panelFront.y = 0;
  if (_panelFront.lengthSq() < 1e-8) return false;
  _panelFront.normalize();

  return _toCam.dot(_panelFront) >= CONTROL_PANEL_HACK_MIN_FRONT;
}

/** @param {THREE.Intersection} hit @param {THREE.Raycaster} raycaster */
function isControlPanelFrontFaceHit(hit, raycaster) {
  if (!hit.face) return true;
  _hitNormal.copy(hit.face.normal);
  hit.object.updateMatrixWorld(true);
  _hitNormal.transformDirection(hit.object.matrixWorld);
  return _hitNormal.dot(raycaster.ray.direction) < -0.02;
}

/**
 * Hack target when the crosshair ray hits the console screen/body in front —
 * blocked by walls and other level geometry (no through-wall hacks).
 *
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D[]} levelHitMeshes
 * @param {number} [maxDist]
 */
export function pickHackableControlPanelUnderCrosshair(
  raycaster,
  camera,
  levelHitMeshes,
  maxDist = CONTROL_PANEL_HACK_MAX_DIST,
) {
  if (!levelHitMeshes?.length) return null;

  _hits.length = 0;
  raycaster.intersectObjects(levelHitMeshes, false, _hits);
  _camPos.copy(camera.position);
  camera.getWorldDirection(_camFwd);

  for (const hit of _hits) {
    if (isBulletPassthroughMesh(hit.object)) continue;
    if (hit.distance > maxDist) break;

    const group = findControlPanelGroup(hit.object);
    if (!group?.userData?.controlPanel) continue;
    if (!isControlPanelHackInteractMesh(hit.object)) continue;
    if (isControlPanelScreenCHackBlocked(group)) continue;
    if (!isControlPanelFrontFaceHit(hit, raycaster)) continue;
    if (!isPlayerInFrontOfControlPanel(group, camera)) continue;

    getControlPanelInteractPoint(group);
    _toPanel.subVectors(_panelPos, _camPos);
    const dist = _toPanel.length();
    if (dist > maxDist) continue;
    _toPanel.multiplyScalar(1 / dist);
    if (_camFwd.dot(_toPanel) < CONTROL_PANEL_HACK_MIN_FACING) continue;

    return { group, distance: hit.distance };
  }

  return null;
}

/**
 * Nearest hackable console the player is close to and roughly facing.
 * @deprecated Prefer {@link pickHackableControlPanelUnderCrosshair} — this ignores walls.
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
    if (!isPlayerInFrontOfControlPanel(group, camera)) continue;
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

/** @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings */
export function getControlPanelHackPromptContent(bindings) {
  return `Press ${formatControlPanelHackKeyLabel(bindings)} or click to hack`;
}
