import * as THREE from "three";

/** Seconds before despawn when rewards begin flashing. */
export const REWARD_FLASH_WARN_SEC = 5;
/** Blink cycle length at the start of the warn window. */
const FLASH_INTERVAL_START = 0.5;
/** Blink cycle length just before despawn. */
const FLASH_INTERVAL_END = 0.2;

/** VX-27 blue — warn blink, not orange (grenade mesh reads harsh on warm emissive). */
const _warnEmissive = new THREE.Color(0x5eaaff);

/**
 * @param {number} time - seconds since spawn
 * @param {number} lifetime - seconds until instant despawn
 */
export function getRewardExpireVisuals(time, lifetime) {
  const timeLeft = lifetime - time;

  if (timeLeft <= 0) {
    return { remove: true, flashing: false, flashOn: false, urgency: 1 };
  }

  const warnStart = lifetime - REWARD_FLASH_WARN_SEC;
  if (time < warnStart) {
    return { remove: false, flashing: false, flashOn: true, urgency: 0 };
  }

  const elapsed = time - warnStart;
  const urgency = Math.min(1, elapsed / REWARD_FLASH_WARN_SEC);
  const interval = THREE.MathUtils.lerp(FLASH_INTERVAL_START, FLASH_INTERVAL_END, urgency);
  const flashOn = (elapsed / interval) % 1 < 0.5;

  return { remove: false, flashing: true, flashOn, urgency };
}

function captureFlashBase(material) {
  return {
    emissive: material.emissive?.clone?.() ?? new THREE.Color(0x000000),
    emissiveIntensity: material.emissiveIntensity ?? 0,
    opacity: material.opacity ?? 1,
  };
}

/**
 * Clone mesh materials so flash does not affect shared assets.
 * @param {object} drop
 * @param {() => THREE.Material[]} cloneMaterialsFn
 */
export function ensureRewardOwnMaterials(drop, cloneMaterialsFn) {
  if (drop.ownMats) return;
  drop.ownMats = true;
  drop.mesh.material = cloneMaterialsFn().map((m) => m.clone());
  drop.flashMats = drop.mesh.material;
  drop.flashBase = drop.flashMats.map(captureFlashBase);
  for (const m of drop.flashMats) {
    m.transparent = true;
    m.depthWrite = false;
  }
}

/** Clone all materials on a multi-mesh pickup (e.g. grenade model). */
export function ensureTraverseOwnMaterials(drop) {
  if (drop.ownMats) return;
  drop.ownMats = true;
  drop.flashMats = [];
  drop.flashBase = [];
  drop.mesh.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.depthWrite = false;
        drop.flashMats.push(c);
        drop.flashBase.push(captureFlashBase(c));
        return c;
      });
    } else {
      const c = child.material.clone();
      c.transparent = true;
      c.depthWrite = false;
      child.material = c;
      drop.flashMats.push(c);
      drop.flashBase.push(captureFlashBase(c));
    }
  });
}

/**
 * Clone grenade-style multi-mesh materials once at spawn — emissive stays off so
 * expire blink can use opacity only (no white emissive pop on metal).
 * @param {THREE.Object3D} root
 * @param {{ emissiveIntensity?: number }} [opts]
 * @returns {{ flashMats: THREE.Material[], flashBase: ReturnType<typeof captureFlashBase>[] }}
 */
export function initTraversePickupMaterials(root, opts = {}) {
  /** @type {THREE.Material[]} */
  const flashMats = [];
  /** @type {ReturnType<typeof captureFlashBase>[]} */
  const flashBase = [];
  const emissiveIntensity = opts.emissiveIntensity ?? 0;

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const applyMat = (source) => {
      const c = source.clone();
      c.emissive.setHex(0x000000);
      c.emissiveIntensity = emissiveIntensity;
      c.opacity = 1;
      c.transparent = false;
      c.depthWrite = true;
      flashMats.push(c);
      flashBase.push(captureFlashBase(c));
      return c;
    };
    if (Array.isArray(child.material)) {
      child.material = child.material.map(applyMat);
    } else {
      child.material = applyMat(child.material);
    }
  });

  root.userData.pickupFlashMats = flashMats;
  root.userData.pickupFlashBase = flashBase;
  return { flashMats, flashBase };
}

/**
 * Opacity pulse for multi-mesh pickups (grenade) — no emissive or visibility blink
 * (metal + emissive reads harsh white; hide/show pops read like a flash).
 * @param {THREE.Object3D} root
 * @param {{ flashing: boolean, flashOn: boolean, urgency: number }} vis
 * @param {{ flashMats?: THREE.Material[], flashBase?: ReturnType<typeof captureFlashBase>[] }} drop
 */
export function applyTraverseRewardExpireVisual(root, vis, drop) {
  const mats = drop.flashMats;
  const base = drop.flashBase;
  if (!mats?.length || !base?.length) return;

  root.visible = true;
  if (!vis.flashing) {
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      const b = base[i];
      m.transparent = false;
      m.depthWrite = true;
      m.emissive.copy(b.emissive);
      m.emissiveIntensity = b.emissiveIntensity;
      m.opacity = b.opacity;
    }
    return;
  }

  const dimMul = THREE.MathUtils.lerp(0.38, 0.14, vis.urgency);
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i];
    const b = base[i];
    m.transparent = true;
    m.depthWrite = false;
    m.emissive.copy(b.emissive);
    m.emissiveIntensity = b.emissiveIntensity;
    m.opacity = vis.flashOn ? b.opacity : b.opacity * dimMul;
  }
}

/**
 * Apply blink. Caller must clone materials first when flashing.
 * @param {THREE.Object3D} root
 * @param {{ flashing: boolean, flashOn: boolean, urgency: number }} vis
 * @param {{ flashMats?: THREE.Material[], flashBase?: ReturnType<typeof captureFlashBase>[] }} drop
 */
export function applyRewardExpireVisual(root, vis, drop) {
  if (!vis.flashing) {
    root.visible = true;
    return;
  }

  root.visible = vis.flashOn;

  const mats = drop.flashMats;
  const base = drop.flashBase;
  if (!mats?.length || !base?.length) return;

  const warnBoost = 1.2 + vis.urgency * 1.8;
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i];
    const b = base[i];
    m.opacity = b.opacity;
    if (vis.flashOn) {
      m.emissive.copy(_warnEmissive);
      m.emissiveIntensity = Math.max(b.emissiveIntensity, 0.35) + warnBoost;
    } else {
      m.emissive.copy(b.emissive);
      m.emissiveIntensity = b.emissiveIntensity;
    }
  }
}

/**
 * Prime pickup expire-blink emissive paths during optional GPU preload helpers.
 * @param {THREE.Object3D} root
 * @param {{ ownMats?: boolean, flashMats?: THREE.Material[], flashBase?: ReturnType<typeof captureFlashBase>[], mesh?: THREE.Object3D }} drop
 * @param {() => void} ensureOwnMaterials
 * @param {{ renderFrame?: (r: THREE.WebGLRenderer, s: THREE.Scene, c: THREE.Camera) => void, frames?: number, renderer?: THREE.WebGLRenderer, scene?: THREE.Scene, camera?: THREE.Camera }} [opts]
 */
export async function warmupRewardFlashGpu(root, drop, ensureOwnMaterials, opts = {}) {
  if (!root || !drop || !ensureOwnMaterials) return;

  ensureOwnMaterials();
  const vis = getRewardExpireVisuals(REWARD_FLASH_WARN_SEC + 0.05, REWARD_FLASH_WARN_SEC + 30);
  const wasVisible = root.visible;

  applyRewardExpireVisual(root, { ...vis, flashOn: true }, drop);
  applyRewardExpireVisual(root, { ...vis, flashOn: false }, drop);
  applyRewardExpireVisual(root, { ...vis, flashOn: true }, drop);

  const renderFrame = opts.renderFrame;
  const frames = opts.frames ?? 2;
  if (renderFrame) {
    for (let i = 0; i < frames; i += 1) {
      renderFrame(opts.renderer, opts.scene, opts.camera);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  root.visible = wasVisible;
  applyRewardExpireVisual(root, { remove: false, flashing: false, flashOn: true, urgency: 0 }, drop);
}
