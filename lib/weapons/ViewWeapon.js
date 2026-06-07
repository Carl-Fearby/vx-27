import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { pinLightToLayers, setViewmodelLayer, WORLD_LAYER, VIEWMODEL_LAYER, ROOM_INTERIOR_LAYER } from "../lighting/LightingLayers.js";
import { renderViewmodelPass } from "../lighting/SceneEnvironment.js";
import { STAIRS_STEP_RUN } from "../stairs/LevelStairs.js";
import { DEFAULT_WALK_BOB_SIMPLE, resolveWalkBobTuning } from "../player/WalkBobTuning.js";
import {
  DEFAULT_STAIR_WALK_TUNING,
  normalizeStairWalkTuning,
} from "../stairs/StairWalkTuning.js";
import { createWeaponFlashlight } from "./WeaponFlashlight.js";
import {
  applyWeaponHolster,
  applyWeaponRaise,
  createWeaponRaiseState,
  resetWeaponRaiseState,
  updateWeaponRaiseState,
} from "./WeaponRaise.js";
import { createWeaponRoundDisplay } from "./WeaponRoundDisplay.js";
import { resolveRoundDisplayPose } from "./WeaponRoundDisplayTuning.js";

/** Meshy Aurora Pulse Rifle (~35MB textured export). */
export const RIFLE_MODEL_URL =
  "/models/aurora_pulse_rifle.glb?v=0606191856";

const FIT_PROFILES = {
  rifle: {
    targetLength: 0.62,
    muzzleYBiasFrac: 0.22,
    muzzleYFixed: 0.098,
  },
  pistol: {
    targetLength: 0.36,
    muzzleYBiasFrac: 0.15,
    muzzleYFixed: 0.05,
  },
};
/** Hip → ADS pose / FOV blend rate. */
export const AIM_BLEND_IN_SPEED = 22;
/** ADS → hip unwind — slower so the rifle eases back instead of snapping. */
export const AIM_BLEND_OUT_SPEED = 11;
/** @deprecated Use {@link AIM_BLEND_IN_SPEED} or {@link resolveAimBlendSpeed}. */
export const AIM_BLEND_SPEED = AIM_BLEND_IN_SPEED;

/** @param {number} aimTarget 0 hip · 1 ADS @param {number} aimBlend */
export function resolveAimBlendSpeed(aimTarget, aimBlend) {
  return aimTarget > aimBlend ? AIM_BLEND_IN_SPEED : AIM_BLEND_OUT_SPEED;
}
/** @deprecated Import from ./LightingLayers.js */
export { VIEWMODEL_LAYER } from "../lighting/LightingLayers.js";
const VIEWMODEL_RENDER_ORDER = 1000;

/** Spring return — lower = longer, smoother settle after look flicks. */
const SWAY_ROT_STIFFNESS = 28;
const SWAY_ROT_DAMPING = 4.2;
const SWAY_ROT_KICK = 1.05;
const SWAY_POS_STIFFNESS = 32;
const SWAY_POS_DAMPING = 4.8;
const SWAY_POS_KICK = 0.038;
const BOB_LERP = 6.5;
const BOB_ACTIVITY_LERP = 3.2;
const BOB_POS_Y = 0.03;
const BOB_POS_X = 0.014;
const BOB_POS_Z = 0.009;
const BOB_ROLL = 0.022;
const ADS_SWAY_MULT = 0.22;
/**
 * Hip-only body vs eye parallax (off when ADS). Level = tuned hip pose.
 * Look up / down apply along camera up + forward (tune amounts on weapon panel).
 */
const BODY_LEVEL_LOOK_UP_Y = 0.28;
const BODY_LEVEL_LOOK_UP_Z = 0.05;
const BODY_LEVEL_LOOK_DOWN_Y = 0.34;
const BODY_LEVEL_LOOK_DOWN_Z = 0.08;
/** Ease back toward level at the horizon (lower = softer). Tilting in tracks pitch immediately. */
const BODY_LOOK_RELEASE_SPEED = 4.5;

function readParallaxAmount(tuningRef, key) {
  const v = tuningRef.current[key];
  if (typeof v !== "number" || Number.isNaN(v)) return 0;
  return Math.max(0, v);
}

/** Track pitch when tilting in; ease only when returning toward the horizon. */
function blendParallaxScalar(current, target, dt, releaseSpeed) {
  if (Math.abs(target) >= Math.abs(current)) return target;
  const ease = 1 - Math.exp(-releaseSpeed * dt);
  return current + (target - current) * ease;
}

const _cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
const _camUp = new THREE.Vector3();
const _camForward = new THREE.Vector3();

function wrapAngle(delta) {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const { material } = obj;
    if (!material) return;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  });
}

const TEXTURE_KEYS = [
  "map",
  "normalMap",
  "metalnessMap",
  "roughnessMap",
  "emissiveMap",
  "aoMap",
];

function enhanceWeaponTextures(material, maxAnisotropy) {
  for (const key of TEXTURE_KEYS) {
    const tex = material[key];
    if (!tex) continue;
    tex.anisotropy = maxAnisotropy;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (key === "map" || key === "emissiveMap") {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
  }
}

function prepareViewMaterials(root, maxAnisotropy = 16) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.frustumCulled = false;
    obj.renderOrder = VIEWMODEL_RENDER_ORDER;

    const geo = obj.geometry;
    if (geo) {
      if (!geo.attributes.normal || geo.attributes.normal.count === 0) {
        geo.computeVertexNormals();
      }
      geo.computeBoundingSphere();
    }

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;
      mat.depthTest = false;
      mat.depthWrite = false;
      mat.transparent = false;
      mat.alphaTest = 0;
      if ("envMapIntensity" in mat) mat.envMapIntensity = 1.15;
      if ("normalScale" in mat && mat.normalMap) {
        mat.normalScale.set(1, 1);
      }
      enhanceWeaponTextures(mat, maxAnisotropy);
    }
  });
}

/** Center mesh and uniform scale only — rotation comes from tuning sliders. */
function fitWeaponModel(model, profile = "rifle") {
  const fit = FIT_PROFILES[profile] ?? FIT_PROFILES.rifle;
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  model.position.sub(center);

  if (size.x > 0) {
    model.scale.setScalar(fit.targetLength / size.x);
  }

  model.rotation.set(0, 0, 0);
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

/** Local axis that points out the barrel (matches fitRifleModel length along X). */
const BARREL_LOCAL = new THREE.Vector3(1, 0, 0);

const _flashlightPos = new THREE.Vector3();
const _flashlightDir = new THREE.Vector3();
const _muzzlePosScratch = new THREE.Vector3();

/**
 * Empirical Y bias from the model's bbox center to the upper barrel bore. The
 * mag well + grip drag the bbox center well below the barrel, so taking the
 * X-tip at center.y lands on the lower vent (the wrong opening). MUZZLE_Y_FIXED
 * is the user-calibrated trim on top of the proportional bias.
 */
const MUZZLE_TIP_PADDING = 0.04;

/** Muzzle at the forward tip of the upper barrel so hip/ADS spawn from the right end. */
function placeMuzzle(model, profile = "rifle") {
  const fit = FIT_PROFILES[profile] ?? FIT_PROFILES.rifle;
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const muzzle = new THREE.Object3D();
  const muzzleY =
    center.y + size.y * fit.muzzleYBiasFrac + fit.muzzleYFixed;
  // Barrel runs along X (see fitRifleModel); tip is +X after centering.
  if (size.x >= size.y && size.x >= size.z) {
    muzzle.position.set(box.max.x + MUZZLE_TIP_PADDING, muzzleY, center.z);
  } else if (size.z >= size.y) {
    muzzle.position.set(center.x, muzzleY, box.max.z + MUZZLE_TIP_PADDING);
  } else {
    muzzle.position.set(center.x, box.max.y + MUZZLE_TIP_PADDING, center.z);
  }
  model.add(muzzle);

  const muzzleFlash = new THREE.PointLight(0x66ccff, 0, 12);
  muzzle.add(muzzleFlash);

  return { muzzle, muzzleFlash };
}

function lerpPose(a, b, t) {
  return {
    posX: THREE.MathUtils.lerp(a.posX, b.posX, t),
    posY: THREE.MathUtils.lerp(a.posY, b.posY, t),
    posZ: THREE.MathUtils.lerp(a.posZ, b.posZ, t),
    rotX: THREE.MathUtils.lerp(a.rotX, b.rotX, t),
    rotY: THREE.MathUtils.lerp(a.rotY, b.rotY, t),
    rotZ: THREE.MathUtils.lerp(a.rotZ, b.rotZ, t),
    scale: THREE.MathUtils.lerp(a.scale, b.scale, t),
  };
}

function applyPose(pivot, pose) {
  pivot.rotation.set(pose.rotX, pose.rotY, pose.rotZ, "YXZ");
  pivot.scale.setScalar(pose.scale);
}

/**
 * @param {import("./WeaponTuning.js").WeaponPose} hip
 * @param {import("./WeaponTuning.js").WeaponPose} ads
 */
function getBlendedPose(hip, ads, aimBlend) {
  return aimBlend <= 0 ? hip : aimBlend >= 1 ? ads : lerpPose(hip, ads, aimBlend);
}

export async function loadViewWeapon(
  camera,
  scene,
  url = RIFLE_MODEL_URL,
  options = {}
) {
  const maxAnisotropy = options.maxAnisotropy ?? 16;
  const fitProfile = options.fitProfile ?? "rifle";
  const enableRoundDisplay = options.roundDisplay !== false;
  const enableFlashlight = options.flashlight !== false;

  const holder = new THREE.Group();
  holder.name = options.weaponId
    ? `view_weapon_${options.weaponId}`
    : "view_weapon";
  scene.add(holder);

  const sway = new THREE.Group();
  holder.add(sway);

  const pivot = new THREE.Group();
  sway.add(pivot);

  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  prepareViewMaterials(model, maxAnisotropy);

  pivot.add(model);
  fitWeaponModel(model, fitProfile);
  const { muzzle, muzzleFlash } = placeMuzzle(model, fitProfile);
  const roundDisplay = enableRoundDisplay
    ? createWeaponRoundDisplay(sway)
    : null;
  const weaponFlashlight = enableFlashlight
    ? createWeaponFlashlight(scene)
    : null;
  holder.traverse(setViewmodelLayer);
  // Muzzle flash rides on the weapon transform but must light the world/room,
  // not the gun itself. The traversal above put it on VIEWMODEL_LAYER, which
  // would flood the viewmodel with blue every shot — re-pin to the scene layers.
  pinLightToLayers(muzzleFlash, WORLD_LAYER, ROOM_INTERIOR_LAYER);

  const currentOffset = new THREE.Vector3();
  const offsetWorld = new THREE.Vector3();
  const _muzzleQuat = new THREE.Quaternion();
  const _camForward = new THREE.Vector3();
  let aimBlend = 0;
  let prevPitch = 0;
  let prevYaw = 0;
  let swayPitch = 0;
  let swayYaw = 0;
  let swayPitchVel = 0;
  let swayYawVel = 0;
  let swayPosX = 0;
  let swayPosY = 0;
  let swayPosXVel = 0;
  let swayPosYVel = 0;
  let bobPhase = 0;
  let bobActivity = 0;
  let smoothBobY = 0;
  let smoothBobX = 0;
  let smoothBobZ = 0;
  let smoothBobRoll = 0;
  let lookInitialized = false;
  let smoothParallaxY = 0;
  let smoothParallaxZ = 0;
  let flashlightOn = false;
  let fireRecoilBack = 0;
  const FIRE_RECOIL_BACK = 0.032;
  const FIRE_RECOIL_RETURN_SPEED = 0.26;
  let holsterAmount = 0;

  const raiseState = createWeaponRaiseState();
  holder.visible = false;

  function springStep(value, velocity, stiffness, damping, dt) {
    velocity += (-value * stiffness - velocity * damping) * dt;
    value += velocity * dt;
    return { value, velocity };
  }

  function sampleMuzzleWorld(outPosition, outDirection, camera) {
    holder.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    muzzle.getWorldPosition(outPosition);

    model.getWorldQuaternion(_muzzleQuat);
    outDirection.copy(BARREL_LOCAL).applyQuaternion(_muzzleQuat).normalize();

    if (camera) {
      _camForward.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      if (aimBlend > 0.5) {
        outDirection.copy(_camForward);
      } else if (outDirection.dot(_camForward) < 0.25) {
        outDirection.copy(_camForward);
      }
    }
  }

  return {
    holder,
    sway,
    pivot,
    model,
    muzzle,
    muzzleFlash,
    ready: true,
    toggleFlashlight() {
      if (!weaponFlashlight) return false;
      flashlightOn = !flashlightOn;
      return flashlightOn;
    },
    isFlashlightOn() {
      return Boolean(weaponFlashlight && flashlightOn);
    },
    isFlashlightCastingShadow() {
      return weaponFlashlight?.isCastingShadow?.() ?? false;
    },
    getAimBlend() {
      return aimBlend;
    },
    setHolsterAmount(amount) {
      holsterAmount = THREE.MathUtils.clamp(amount, 0, 1);
    },
    getHolsterAmount() {
      return holsterAmount;
    },
    replayRaise() {
      resetWeaponRaiseState(raiseState);
    },
    getRoundDisplaySuggestedPose() {
      return roundDisplay?.getSuggestedPose?.() ?? null;
    },
    /** Snap the whole view-model backward for one frame (no spring). */
    applyFireKick(aimBlend = 0) {
      const scale = 1 - aimBlend * 0.35;
      fireRecoilBack = FIRE_RECOIL_BACK * scale;
    },
    /** World-space muzzle position and shoot direction (camera forward when ADS). */
    getMuzzleWorld(outPosition, outDirection, camera) {
      sampleMuzzleWorld(outPosition, outDirection, camera);
    },
    /**
     * @param {number} aimTarget 0 = hip, 1 = ADS
     * @param {{ current: { hip: import("./WeaponTuning.js").WeaponPose, ads: import("./WeaponTuning.js").WeaponPose } }} tuningRef
     * @param {{
     *   snapAim?: boolean,
     *   moveSpeed?: number,
     *   roundCount?: number,
     *   roundDisplayLow?: boolean,
     *   roundDisplayTuningRef?: {
     *     current: {
     *       hip: import("./WeaponRoundDisplayTuning.js").WeaponRoundDisplayPose,
     *       aim: import("./WeaponRoundDisplayTuning.js").WeaponRoundDisplayPose,
     *     },
     *   },
     * }} [options]
     */
    update(camera, aimTarget, dt, tuningRef, options = {}) {
      const raiseProgress = updateWeaponRaiseState(raiseState, dt);

      const aimSpeed = resolveAimBlendSpeed(aimTarget, aimBlend);
      const blend = options.snapAim ? 1 : 1 - Math.exp(-aimSpeed * dt);
      aimBlend += (aimTarget - aimBlend) * blend;
      if (Math.abs(aimTarget - aimBlend) < 0.001) aimBlend = aimTarget;

      const { hip, ads } = tuningRef.current;
      const pose = getBlendedPose(hip, ads, aimBlend);

      _cameraEuler.setFromQuaternion(camera.quaternion, "YXZ");
      const pitch = _cameraEuler.x;
      const pitchLimit = Math.PI / 2 - 0.05;
      const pitchNorm = THREE.MathUtils.clamp(pitch / pitchLimit, -1, 1);
      const hipParallax = 1 - aimBlend;

      const lookUpAmount = readParallaxAmount(tuningRef, "bodyLookUpAmount");
      const lookDownAmount = readParallaxAmount(tuningRef, "bodyLookDownAmount");

      // PlayerController: pitch > 0 = look up, pitch < 0 = look down (YXZ euler.x)
      let targetParallaxY = 0;
      let targetParallaxZ = 0;
      if (pitchNorm > 0 && lookUpAmount > 0) {
        targetParallaxY =
          pitchNorm * lookUpAmount * hipParallax * BODY_LEVEL_LOOK_UP_Y;
        targetParallaxZ =
          pitchNorm * lookUpAmount * hipParallax * BODY_LEVEL_LOOK_UP_Z;
      } else if (pitchNorm < 0 && lookDownAmount > 0) {
        const downBlend = -pitchNorm * lookDownAmount * hipParallax;
        targetParallaxY = downBlend * BODY_LEVEL_LOOK_DOWN_Y;
        targetParallaxZ = downBlend * BODY_LEVEL_LOOK_DOWN_Z;
      }

      smoothParallaxY = blendParallaxScalar(
        smoothParallaxY,
        targetParallaxY,
        dt,
        BODY_LOOK_RELEASE_SPEED
      );
      smoothParallaxZ = blendParallaxScalar(
        smoothParallaxZ,
        targetParallaxZ,
        dt,
        BODY_LOOK_RELEASE_SPEED
      );

      currentOffset.set(pose.posX, pose.posY, pose.posZ);
      applyPose(pivot, pose);
      const yaw = _cameraEuler.y;
      if (!lookInitialized) {
        prevPitch = pitch;
        prevYaw = yaw;
        lookInitialized = true;
      }
      const deltaPitch = wrapAngle(pitch - prevPitch);
      const deltaYaw = wrapAngle(yaw - prevYaw);
      prevPitch = pitch;
      prevYaw = yaw;

      const swayScale = THREE.MathUtils.lerp(1, ADS_SWAY_MULT, aimBlend);

      // Hip: parallax sliders own vertical pitch; no pitch kick sway until ADS
      swayPitchVel += -deltaPitch * SWAY_ROT_KICK * aimBlend;
      swayYawVel += -deltaYaw * SWAY_ROT_KICK;
      swayPosXVel += -deltaYaw * SWAY_POS_KICK;
      swayPosYVel += deltaPitch * SWAY_POS_KICK * aimBlend;

      let s = springStep(
        swayPitch,
        swayPitchVel,
        SWAY_ROT_STIFFNESS,
        SWAY_ROT_DAMPING,
        dt
      );
      swayPitch = s.value;
      swayPitchVel = s.velocity;

      s = springStep(swayYaw, swayYawVel, SWAY_ROT_STIFFNESS, SWAY_ROT_DAMPING, dt);
      swayYaw = s.value;
      swayYawVel = s.velocity;

      s = springStep(
        swayPosX,
        swayPosXVel,
        SWAY_POS_STIFFNESS,
        SWAY_POS_DAMPING,
        dt
      );
      swayPosX = s.value;
      swayPosXVel = s.velocity;

      s = springStep(
        swayPosY,
        swayPosYVel,
        SWAY_POS_STIFFNESS,
        SWAY_POS_DAMPING,
        dt
      );
      swayPosY = s.value;
      swayPosYVel = s.velocity;

      const moveSpeed = options.moveSpeed ?? 0;
      const onStairs = options.onStairs ?? false;
      const walkBobTuning =
        options.walkBobTuning ??
        resolveWalkBobTuning(DEFAULT_WALK_BOB_SIMPLE);
      const stairWalkTuning = normalizeStairWalkTuning(
        options.stairWalkTuning ?? DEFAULT_STAIR_WALK_TUNING
      );
      const activityTarget = moveSpeed > 0.35 ? 1 : 0;
      bobActivity +=
        (activityTarget - bobActivity) *
        (1 - Math.exp(-BOB_ACTIVITY_LERP * dt));

      const speedFactor = THREE.MathUtils.clamp(
        moveSpeed / Math.max(walkBobTuning.walkSpeed, 0.1),
        0,
        1.2
      );
      const bobIntensity =
        (1 - aimBlend) * bobActivity * speedFactor * walkBobTuning.weaponBobScale;

      if (bobIntensity > 0.01) {
        const bobFreq = onStairs
          ? Math.max(
              stairWalkTuning.bobFreqMin,
              (moveSpeed / STAIRS_STEP_RUN) * stairWalkTuning.bobFreqSpeedScale
            )
          : walkBobTuning.walkFreqBase +
            moveSpeed * walkBobTuning.walkFreqPerSpeed;
        bobPhase += dt * bobFreq * Math.PI * 2 * bobIntensity;
      }

      const stairBobIntensity = onStairs
        ? bobIntensity * stairWalkTuning.weaponBobScale
        : bobIntensity;

      let targetBobY = Math.sin(bobPhase) * BOB_POS_Y * stairBobIntensity;
      if (onStairs) {
        targetBobY *= stairWalkTuning.weaponBobY;
      }
      const targetBobX =
        Math.sin(bobPhase * 0.5 + Math.PI * 0.2) *
        BOB_POS_X *
        stairBobIntensity *
        (onStairs ? stairWalkTuning.weaponBobX : 1);
      const targetBobZ =
        Math.cos(bobPhase) * BOB_POS_Z * stairBobIntensity;
      const targetBobRoll =
        Math.sin(bobPhase * 0.5) *
        BOB_ROLL *
        stairBobIntensity *
        (onStairs ? stairWalkTuning.weaponBobRoll : 1);

      const bobEase = 1 - Math.exp(-BOB_LERP * dt);
      smoothBobY += (targetBobY - smoothBobY) * bobEase;
      smoothBobX += (targetBobX - smoothBobX) * bobEase;
      smoothBobZ += (targetBobZ - smoothBobZ) * bobEase;
      smoothBobRoll += (targetBobRoll - smoothBobRoll) * bobEase;

      sway.rotation.set(
        (swayPitch + smoothBobRoll) * swayScale,
        swayYaw * swayScale,
        0,
        "YXZ"
      );
      sway.position.set(
        (swayPosX + smoothBobX) * swayScale,
        (swayPosY + smoothBobY) * swayScale,
        smoothBobZ * swayScale
      );

      offsetWorld.copy(currentOffset).applyQuaternion(camera.quaternion);
      holder.position.copy(camera.position).add(offsetWorld);

      const appliedParallaxY = smoothParallaxY * hipParallax;
      const appliedParallaxZ = smoothParallaxZ * hipParallax;
      if (
        Math.abs(appliedParallaxY) > 0.0001 ||
        Math.abs(appliedParallaxZ) > 0.0001
      ) {
        _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
        _camForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        holder.position.addScaledVector(_camUp, -appliedParallaxY);
        holder.position.addScaledVector(_camForward, -appliedParallaxZ);
      }

      if (holsterAmount > 0.0005) {
        applyWeaponHolster(holder, pivot, camera, holsterAmount, aimBlend);
      } else if (raiseProgress < 1) {
        applyWeaponRaise(holder, pivot, camera, raiseProgress, aimBlend);
      }

      if (fireRecoilBack > 0) {
        _camForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        holder.position.addScaledVector(_camForward, -fireRecoilBack);
        fireRecoilBack = Math.max(0, fireRecoilBack - FIRE_RECOIL_RETURN_SPEED * dt);
      }

      holder.quaternion.copy(camera.quaternion);
      holder.updateMatrixWorld(true);

      if (roundDisplay) {
        const roundTuning = options.roundDisplayTuningRef?.current;
        if (roundTuning?.hip && roundTuning?.aim) {
          const displayPose = resolveRoundDisplayPose(
            roundTuning.hip,
            roundTuning.aim,
            aimBlend,
          );
          roundDisplay.syncToModelSurface(displayPose, model, sway);
        }
        const roundCount =
          typeof options.roundCount === "number" ? options.roundCount : 88;
        roundDisplay.setCount(roundCount, Boolean(options.roundDisplayLow));
      }

      if (weaponFlashlight) {
        muzzle.getWorldPosition(_muzzlePosScratch);
        weaponFlashlight.sampleFromCamera(
          camera,
          _muzzlePosScratch,
          aimBlend,
          _flashlightPos,
          _flashlightDir
        );
        weaponFlashlight.sync(_flashlightPos, _flashlightDir, flashlightOn, {
          nightness: options.nightness,
        });
      }
    },
    /** Lit by world/room lights on VIEWMODEL_LAYER (see syncLightLayersForZone). */
    renderViewmodel(renderer, worldScene, camera) {
      renderViewmodelPass(renderer, worldScene, camera);
    },
    /**
     * Prime the weapon spotlight + shadow map during GPU preload so the first
     * F-key toggle does not hitch. Uses the same render path as gameplay when
     * `renderFrame` is provided (layered world + room passes).
     */
    async preloadFlashlightGpu(renderer, scene, camera, opts = {}) {
      if (!weaponFlashlight || !renderer || !scene || !camera) return;

      const frames = opts.frames ?? 5;
      const renderFrame =
        opts.renderFrame ??
        ((r, s, c) => {
          r.render(s, c);
        });

      const wasVisible = holder.visible;
      holder.visible = true;
      holder.position.copy(camera.position);
      holder.quaternion.copy(camera.quaternion);
      holder.updateMatrixWorld(true);
      model.updateMatrixWorld(true);
      muzzle.getWorldPosition(_muzzlePosScratch);
      weaponFlashlight.sampleFromCamera(
        camera,
        _muzzlePosScratch,
        1,
        _flashlightPos,
        _flashlightDir
      );

      weaponFlashlight.sync(_flashlightPos, _flashlightDir, true, { nightness: 1 });
      renderer.shadowMap.needsUpdate = true;

      if (typeof renderer.compile === "function") {
        renderer.compile(scene, camera, scene);
      }

      for (let i = 0; i < frames; i += 1) {
        renderFrame(renderer, scene, camera);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      weaponFlashlight.primeShadowMaps(renderer);
      weaponFlashlight.markShadowMapsPrimed(renderer);
      weaponFlashlight.sync(_flashlightPos, _flashlightDir, flashlightOn, {
        nightness: 1,
      });
      if (!wasVisible) holder.visible = false;
    },
    /** Prime blue + green muzzle flash lights during GPU preload. */
    async preloadMuzzleFlashGpu(renderer, scene, camera, opts = {}) {
      if (!renderer || !scene || !camera) return;

      const frames = opts.frames ?? 2;
      const renderFrame =
        opts.renderFrame ??
        ((r, s, c) => {
          r.render(s, c);
        });
      const wasVisible = holder.visible;
      const savedIntensity = muzzleFlash.intensity;
      const savedColor = muzzleFlash.color.getHex();

      holder.visible = true;
      holder.position.copy(camera.position);
      holder.quaternion.copy(camera.quaternion);
      holder.updateMatrixWorld(true);

      for (const radioactive of [false, true]) {
        const palette = getLaserPalette(radioactive);
        muzzleFlash.color.setHex(palette.muzzle);
        muzzleFlash.intensity = 5;
        for (let i = 0; i < frames; i += 1) {
          renderFrame(renderer, scene, camera);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      muzzleFlash.intensity = savedIntensity;
      muzzleFlash.color.setHex(savedColor);
      if (!wasVisible) holder.visible = false;
    },
    dispose() {
      roundDisplay?.dispose?.();
      weaponFlashlight?.dispose?.();
      scene.remove(holder);
      disposeObject3D(model);
    },
  };
}

/** Muzzle / hitscan impact palette — blue normal, green when HP > 100. */
export const LASER_PALETTES = {
  normal: { core: 0x0a66fa, muzzle: 0x0a66fa},
  radioactive: { core: 0x99ff77, muzzle: 0x77ff66 },
};

export function getLaserPalette(radioactive) {
  return radioactive ? LASER_PALETTES.radioactive : LASER_PALETTES.normal;
}
