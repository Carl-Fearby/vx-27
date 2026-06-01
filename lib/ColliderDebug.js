import * as THREE from "three";
import { setWorldLayer } from "./LightingLayers.js";

let _scene = null;
let _enabled = false;
let _overlay = null;
/** @type {string | null} */
let _overlayCacheKey = null;

const RED_BLOCK = 0xff0000;
const RED_CLAMP = 0xff2222;
const RED_DECK = 0xff4444;
const DIM_COLLIDER = 0x884444;

function boxToWorldAabb(box) {
  const min = new THREE.Vector3(
    box.x - box.halfX,
    box.bottomY ?? -1e6,
    box.z - box.halfZ
  );
  const max = new THREE.Vector3(
    box.x + box.halfX,
    box.topY ?? 1e6,
    box.z + box.halfZ
  );
  if (box.rotationY != null) {
    const center = new THREE.Vector3(box.x, (min.y + max.y) / 2, box.z);
    const size = new THREE.Vector3().subVectors(max, min);
    const half = size.multiplyScalar(0.5);
    const corners = [
      new THREE.Vector3(-half.x, -half.y, -half.z),
      new THREE.Vector3(half.x, -half.y, -half.z),
      new THREE.Vector3(-half.x, half.y, -half.z),
      new THREE.Vector3(half.x, half.y, -half.z),
      new THREE.Vector3(-half.x, -half.y, half.z),
      new THREE.Vector3(half.x, -half.y, half.z),
      new THREE.Vector3(-half.x, half.y, half.z),
      new THREE.Vector3(half.x, half.y, half.z),
    ];
    const m = new THREE.Matrix4().makeRotationY(box.rotationY);
    const world = new THREE.Box3();
    for (const c of corners) {
      c.applyMatrix4(m).add(center);
      world.expandByPoint(c);
    }
    return world;
  }
  return new THREE.Box3(min, max);
}

function addEdgeBox(group, world, color, opacity, renderOrder) {
  const size = new THREE.Vector3();
  world.getSize(size);
  if (size.x < 0.001 && size.y < 0.001 && size.z < 0.001) return;

  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  const mat = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity,
  });
  const lines = new THREE.LineSegments(edges, mat);
  world.getCenter(lines.position);
  lines.renderOrder = renderOrder;
  group.add(lines);
}

/** Rotated collider — matches resolveBoxCollider local axes. */
function addOrientedColliderBox(group, box, color, opacity, renderOrder) {
  const bottom = box.bottomY ?? -1e6;
  const top = box.topY ?? 1e6;
  const height = top - bottom;
  if (height < 0.001) return;

  const geo = new THREE.BoxGeometry(box.halfX * 2, height, box.halfZ * 2);
  const edges = new THREE.EdgesGeometry(geo);
  geo.dispose();
  const mat = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity,
  });
  const lines = new THREE.LineSegments(edges, mat);
  lines.position.set(box.x, (bottom + top) / 2, box.z);
  if (box.rotationY) lines.rotation.y = box.rotationY;
  lines.renderOrder = renderOrder;
  group.add(lines);
}

function addHorizontalRect(group, minX, maxX, minZ, maxZ, y, color, opacity) {
  if (maxX - minX < 0.01 || maxZ - minZ < 0.01) return;
  const points = [
    new THREE.Vector3(minX, y, minZ),
    new THREE.Vector3(maxX, y, minZ),
    new THREE.Vector3(maxX, y, maxZ),
    new THREE.Vector3(minX, y, maxZ),
    new THREE.Vector3(minX, y, minZ),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity,
  });
  const line = new THREE.Line(geo, mat);
  line.renderOrder = 9996;
  group.add(line);
}

/** Vertical red posts marking invisible walk clamp walls. */
function addClampPosts(group, walkClamp, footY, color) {
  const y0 = footY + 0.02;
  const y1 = footY + 1.85;
  const corners = [
    [walkClamp.minX, walkClamp.minZ],
    [walkClamp.maxX, walkClamp.minZ],
    [walkClamp.maxX, walkClamp.maxZ],
    [walkClamp.minX, walkClamp.maxZ],
  ];
  for (const [cx, cz] of corners) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx, y0, cz),
      new THREE.Vector3(cx, y1, cz),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 9997;
    group.add(line);
  }
}

function disposeOverlayMeshes() {
  if (!_overlay) return;
  _scene?.remove(_overlay);
  _overlay.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  _overlay = null;
}

function clearOverlay() {
  disposeOverlayMeshes();
  _overlayCacheKey = null;
}

/**
 * @param {object[]} colliders
 * @param {{ propId?: string | null }} options
 */
function colliderDebugCacheKey(colliders, options = {}) {
  const parts = [options.propId ?? ""];
  for (const box of colliders) {
    if (box.active === false) continue;
    parts.push(
      [
        box.kind,
        box.propId ?? "",
        box.containerPart ?? "",
        box.x?.toFixed(3) ?? "",
        box.z?.toFixed(3) ?? "",
        box.bottomY?.toFixed(3) ?? "",
        box.topY?.toFixed(3) ?? "",
        box.rotationY?.toFixed(4) ?? "",
        box.halfX?.toFixed(3) ?? "",
        box.halfZ?.toFixed(3) ?? "",
      ].join(",")
    );
  }
  return parts.join("|");
}

/**
 * @param {THREE.Scene | null} scene
 * @param {boolean} enabled
 */
export function setColliderDebug(scene, enabled) {
  _scene = scene;
  _enabled = enabled;
  if (!enabled) clearOverlay();
}

/** Force the next overlay update to rebuild wireframes (e.g. after level reload). */
export function invalidateColliderDebugOverlay() {
  _overlayCacheKey = null;
}

/**
 * @param {object[]} colliders
 * @param {{ x: number, y: number, z: number, radius?: number, height?: number }} [player]
 * @param {ReturnType<import("./PlayerController.js").createPlayerController>["getMovementDebugSnapshot"] extends () => infer R ? R : never} [movement]
 * @param {{ propId?: string | null }} [options]
 */
export function updateColliderDebugOverlay(
  colliders,
  player = null,
  movement = null,
  options = {}
) {
  if (!_enabled || !_scene) return;

  const containerOnly = options.propId != null;
  const visibleColliders = containerOnly
    ? colliders.filter(
        (c) => c.kind === "vx27ContainerWall" && c.propId === options.propId
      )
    : colliders;

  const cacheKey = colliderDebugCacheKey(visibleColliders, options);
  if (_overlay && cacheKey === _overlayCacheKey) return;

  _overlayCacheKey = cacheKey;
  disposeOverlayMeshes();
  _overlay = new THREE.Group();
  _overlay.name = "collider_debug";

  const blocking = new Set(movement?.blockingColliders ?? []);

  for (const box of visibleColliders) {
    if (box.active === false) continue;
    const isBlocking = blocking.has(box);
    const color = isBlocking ? RED_BLOCK : DIM_COLLIDER;
    const opacity = isBlocking ? 1 : 0.28;
    const renderOrder = isBlocking ? 10000 : 9990;

    if (box.rotationY != null) {
      addOrientedColliderBox(_overlay, box, color, opacity, renderOrder);
    } else {
      addEdgeBox(_overlay, boxToWorldAabb(box), color, opacity, renderOrder);
    }
  }

  const footY = movement?.footY ?? (player ? player.y - (player.height ?? 1.65) : 0);
  const deckY = footY + 0.06;

  if (!containerOnly && movement?.deckPieces?.length) {
    for (const piece of movement.deckPieces) {
      addHorizontalRect(
        _overlay,
        piece.minX,
        piece.maxX,
        piece.minZ,
        piece.maxZ,
        (piece.y ?? footY) + 0.04,
        RED_DECK,
        0.75
      );
    }
  }

  if (!containerOnly && movement?.catwalkUnion) {
    const u = movement.catwalkUnion;
    addHorizontalRect(
      _overlay,
      u.minX,
      u.maxX,
      u.minZ,
      u.maxZ,
      deckY,
      0xff6666,
      0.45
    );
  }

  if (!containerOnly && movement?.walkClamp) {
    addHorizontalRect(
      _overlay,
      movement.walkClamp.minX,
      movement.walkClamp.maxX,
      movement.walkClamp.minZ,
      movement.walkClamp.maxZ,
      deckY + 0.02,
      RED_CLAMP,
      1
    );
    addClampPosts(_overlay, movement.walkClamp, footY, RED_CLAMP);
  }

  if (player) {
    const r = player.radius ?? 0.35;
    const h = player.height ?? 1.65;
    const playerFootY = player.y - h;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(player.x - r, playerFootY, player.z - r),
      new THREE.Vector3(player.x + r, playerFootY + h, player.z + r)
    );
    const size = new THREE.Vector3();
    playerBox.getSize(size);
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geo);
    geo.dispose();
    const mat = new THREE.LineBasicMaterial({
      color: 0x33ff88,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const lines = new THREE.LineSegments(edges, mat);
    playerBox.getCenter(lines.position);
    lines.renderOrder = 10001;
    _overlay.add(lines);
  }

  for (const caster of (containerOnly ? [] : movement?.shadowCasters) ?? []) {
    if (!caster?.isMesh) continue;
    caster.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(caster);
    addEdgeBox(_overlay, box, 0xff00ff, 0.85, 9995);
  }

  setWorldLayer(_overlay);
  _scene.add(_overlay);
}

export function isColliderDebugEnabled() {
  return _enabled;
}
