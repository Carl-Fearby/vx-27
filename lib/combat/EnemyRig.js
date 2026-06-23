import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { setWorldLayer } from "../lighting/LightingLayers.js";
import { enableShadowsOn } from "../lighting/SceneEnvironment.js";
import {
  useSimpleEnemyMeshes,
} from "./EnemyRigPerf.js";
import {
  getEnemyRigPoseForState,
  getEnemyRigTuning,
  isEnemyRigWizardPreviewActive,
  normalizeEnemyRigMuzzle,
} from "./EnemyRigTuning.js";
import { hitZoneBodyCategory } from "./WeaponDamage.js";

const DEATH_CLIP_STANDARD = 0;
const DEATH_CLIP_ABDOMINAL = 1;

const ENEMY_CHARACTER_URL = "/models/enemies/px27-android-character.glb";
const ENEMY_WALK_URL = "/models/enemies/px27-android-walk.glb";
const ENEMY_RUN_URL = "/models/enemies/px27-android-run.glb";
const ENEMY_DEATH_URL = "/models/enemies/px27-android-death.glb";
const ENEMY_DEATH_ABDOMINAL_URL =
  "/models/enemies/px27-android-death-abdominal.glb";
const ENEMY_RIG_DEATH_SETTLE_SEC = 0.35;
const ENEMY_RIG_DEATH_FADE_SEC = 0.8;
/** Grenade blast profile — kept in sync with Targets.js HIT_PROFILES.grenade. */
const GRENADE_LAUNCH_MUL = 2.0;
const GRENADE_LAUNCH_BACK_BOOST = 1.45;
const LAUNCH_UP_VEL = 1.6;
const LAUNCH_BACK_VEL = 1.2;
const LAUNCH_GRAVITY = 22;
const LAUNCH_GROUND_FRICTION = 6;
/** Above this move speed enemies use the run clip instead of walk. */
const ENEMY_RUN_SPEED_THRESHOLD = 1.35;
/** World m/s at which the run clip plays at 1× — keep near ROOKIE_ENEMY_AI.runMoveSpeed. */
const RUN_ANIM_LOCOMOTION_REF = 3.55;
const WALK_ANIM_LOCOMOTION_REF = 1.15;

let _loadPromise = null;
let _template = null;
let _walkClip = null;
let _runClip = null;
let _deathClips = [];
let _walkClipDuration = 1;
let _runClipDuration = 1;
let _templateHeight = 1.7;
let _enemyRigNightness = 0;
const _rigInstances = new Set();
const _grenadeBlastDir = new THREE.Vector3();
/** @type {WeakMap<THREE.Texture, THREE.CanvasTexture>} */
const _greenAccentMapCache = new WeakMap();

function getGreenAccentEmissiveMap(sourceTexture) {
  if (!sourceTexture) return null;
  const cached = _greenAccentMapCache.get(sourceTexture);
  if (cached) return cached;

  const image = sourceTexture.image;
  if (!image?.width || !image?.height || typeof document === "undefined") {
    return null;
  }

  const maxEdge = 1024;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxRb = Math.max(r, b);
    const greenExcess = g - maxRb;
    if (greenExcess > 28 && g > 40) {
      const strength = Math.min(1, greenExcess / 110);
      data[i] = 0;
      data[i + 1] = Math.round(g * strength);
      data[i + 2] = 0;
      data[i + 3] = 255;
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const accentMap = new THREE.CanvasTexture(canvas);
  accentMap.colorSpace = THREE.SRGBColorSpace;
  accentMap.flipY = sourceTexture.flipY;
  accentMap.wrapS = sourceTexture.wrapS;
  accentMap.wrapT = sourceTexture.wrapT;
  accentMap.needsUpdate = true;
  _greenAccentMapCache.set(sourceTexture, accentMap);
  return accentMap;
}

export function resolveEnemyMuzzleLocal(
  height,
  muzzle = getEnemyRigTuning().muzzle,
  out = new THREE.Vector3(),
) {
  const normalized = normalizeEnemyRigMuzzle(muzzle);
  out.set(
    normalized.x * height,
    normalized.y * height,
    normalized.z * height,
  );
  return out;
}

/** @param {THREE.Object3D} mesh @param {THREE.Vector3} [out] */
export function getEnemyMuzzleWorldPosition(mesh, out = new THREE.Vector3()) {
  const rifle = mesh.userData.enemyRifle ??
    mesh.getObjectByName?.("enemy-rifle-muzzle");
  if (rifle) {
    out.copy(rifle.position);
    return rifle.localToWorld(out);
  }
  out.set(0, (mesh.userData.height ?? 1.75) * 0.36, 0.3);
  return mesh.localToWorld(out);
}

/** @param {THREE.Object3D} mesh @param {THREE.Vector3} [out] */
export function getEnemyMuzzleWorldDirection(mesh, out = new THREE.Vector3()) {
  return out.set(0, 0, 1).applyQuaternion(mesh.quaternion).normalize();
}

function applyMuzzleTuning(muzzle, height, tuning = getEnemyRigTuning()) {
  if (!muzzle || !height) return;
  resolveEnemyMuzzleLocal(height, tuning.muzzle, muzzle.position);
}

export function applyEnemyRigMuzzleTuning(tuning = getEnemyRigTuning()) {
  for (const rig of _rigInstances) {
    const target = rig.holder?.parent;
    const rifle = target?.userData?.enemyRifle;
    const height = target?.userData?.height;
    if (rifle && height) applyMuzzleTuning(rifle, height, tuning);
  }
}

/** @param {THREE.Mesh[]} targets */
export function applyEnemyRigMuzzleTuningToTargets(
  targets,
  tuning = getEnemyRigTuning(),
) {
  if (!targets?.length) return;
  for (const mesh of targets) {
    if (!mesh?.userData?.hasRifle) continue;
    const rifle = mesh.userData.enemyRifle;
    const height = mesh.userData.height;
    if (rifle && height) applyMuzzleTuning(rifle, height, tuning);
  }
}

function applyTuningToRig(rig, pose) {
  if (rig.dying) return;
  rig.holder.position.set(
    pose.positionX,
    rig.baseY + pose.positionY,
    pose.positionZ,
  );
  rig.holder.rotation.set(
    THREE.MathUtils.degToRad(pose.rotationX),
    THREE.MathUtils.degToRad(pose.rotationY),
    THREE.MathUtils.degToRad(pose.rotationZ),
  );
}

function captureEnemyRigMaterialBase(mat) {
  if (!mat || mat.userData?.enemyRigBase) return;
  const albedoMap = mat.map ?? null;
  mat.userData.enemyRigBase = {
    color: mat.color?.clone?.() ?? new THREE.Color(0xffffff),
    metalness: mat.metalness ?? 0.5,
    roughness: mat.roughness ?? 0.5,
    accentEmissiveMap: getGreenAccentEmissiveMap(albedoMap),
  };
}

function resolveEnemyRigEmissiveIntensity(materialTuning, nightness = _enemyRigNightness) {
  const accentGlow = materialTuning?.accentGlow ?? 2.5;
  const emissiveFill = materialTuning?.emissiveFill ?? 0;
  const accent = accentGlow * THREE.MathUtils.clamp(nightness, 0, 1);
  return accent + (emissiveFill > 0 ? emissiveFill : 0);
}

function applyEnemyRigMaterialTuning(
  mat,
  materialTuning,
  nightness = _enemyRigNightness,
) {
  if (!mat || !materialTuning) return;
  captureEnemyRigMaterialBase(mat);
  const base = mat.userData.enemyRigBase;
  const { brightness, emissiveFill, metalness, roughness } = materialTuning;

  if (mat.color?.isColor && base.color) {
    mat.color.copy(base.color).multiplyScalar(brightness);
  }

  if (base.accentEmissiveMap) {
    mat.emissiveMap = base.accentEmissiveMap;
    if (mat.emissive?.isColor) {
      mat.emissive.setRGB(1, 1, 1);
    }
    if (mat.emissiveIntensity !== undefined) {
      mat.emissiveIntensity = resolveEnemyRigEmissiveIntensity(
        materialTuning,
        nightness,
      );
    }
  } else {
    mat.emissiveMap = null;
    if (mat.emissive?.isColor) {
      mat.emissive.copy(base.color).multiplyScalar(emissiveFill);
    }
    if (mat.emissiveIntensity !== undefined) {
      mat.emissiveIntensity = emissiveFill > 0 ? 1 : 0;
    }
  }

  if (mat.metalness !== undefined) {
    mat.metalness = metalness;
  }
  if (mat.roughness !== undefined) {
    mat.roughness = roughness;
  }
  mat.needsUpdate = true;
}

function applyMaterialTuningToRoot(root, tuning = getEnemyRigTuning()) {
  if (!root) return;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const mat of materials) {
      applyEnemyRigMaterialTuning(mat, tuning.material);
    }
  });
}

export function applyEnemyRigTuning(tuning = getEnemyRigTuning()) {
  const previewing =
    tuning.previewAnimation && isEnemyRigWizardPreviewActive();
  const pose = getEnemyRigPoseForState(previewing, tuning);
  for (const rig of _rigInstances) {
    if (rig.dying) continue;
    applyTuningToRig(rig, pose);
    applyMaterialTuningToRoot(rig.root, tuning);
  }
  applyEnemyRigMuzzleTuning(tuning);
}

/** Boost green accent emissive as nightness rises; body diffuse stays untouched. */
export function applyEnemyRigNightness(nightness) {
  _enemyRigNightness = THREE.MathUtils.clamp(nightness, 0, 1);
  const tuning = getEnemyRigTuning();
  for (const rig of _rigInstances) {
    if (rig.dying) continue;
    applyMaterialTuningToRoot(rig.root, tuning);
  }
}

function findSkinnedMesh(root) {
  let skinned = null;
  root.traverse((object) => {
    if (object.isSkinnedMesh && !skinned) skinned = object;
  });
  return skinned;
}

function trackBoneName(trackName) {
  const propertySeparator = trackName.lastIndexOf(".");
  return propertySeparator >= 0
    ? trackName.slice(0, propertySeparator).split(/[\/[\]:]/).filter(Boolean).at(-1)
    : trackName;
}

function pickLocomotionClip(animations, pattern) {
  if (!animations?.length) return null;
  const named = animations.find((clip) => pattern.test(clip.name));
  return named ?? animations[0];
}

function pickDeathClip(animations) {
  if (!animations?.length) return null;
  return (
    animations.find((clip) => /^dead$/i.test(clip.name)) ??
    animations.find((clip) => /death|dead/i.test(clip.name)) ??
    null
  );
}

function pickAbdominalDeathClip(animations) {
  if (!animations?.length) return null;
  return (
    animations.find((clip) => /abdominal|fall.*dead/i.test(clip.name)) ??
    animations[0]
  );
}

function meshVariationSalt(mesh, channel = 0) {
  if (!mesh?.position) return Math.random();
  const p = mesh.position;
  const h = Math.sin(
    p.x * (12.9898 + channel * 3.1) +
    p.z * (78.233 + channel * 5.7) +
    p.y * (37.719 + channel * 2.3),
  ) * 43758.5453;
  return h - Math.floor(h);
}

function allowsAbdominalDeath(opts) {
  if (opts.hitZone === "grenade") return true;
  return hitZoneBodyCategory(opts.hitZone ?? "body") === "lower";
}

function pickEnemyRigDeathVariant(opts, clipCount, mesh = null) {
  const isGrenade = opts.hitZone === "grenade";
  const falloff = THREE.MathUtils.clamp(opts.blastFalloff ?? 1, 0, 1);
  const victimIdx = Number.isFinite(opts.blastVictimIndex)
    ? opts.blastVictimIndex
    : -1;
  const clipDeck = Array.isArray(opts.blastDeathClips) ? opts.blastDeathClips : null;
  const salt = meshVariationSalt(mesh, 0);
  const salt2 = meshVariationSalt(mesh, 1);
  const canUseAbdominal = allowsAbdominalDeath(opts) && clipCount > 1;

  let clipIndex = DEATH_CLIP_STANDARD;
  if (canUseAbdominal) {
    if (isGrenade && clipDeck?.length && victimIdx >= 0) {
      clipIndex = clipDeck[victimIdx % clipDeck.length] % clipCount;
    } else if (isGrenade) {
      clipIndex = salt < 0.5 ? DEATH_CLIP_STANDARD : DEATH_CLIP_ABDOMINAL;
    } else {
      clipIndex = DEATH_CLIP_ABDOMINAL;
    }
  }

  const victimStagger = victimIdx >= 0 ? victimIdx * 0.12 : 0;
  const baseScale = isGrenade
    ? 0.72 + salt2 * 0.55
    : 0.9 + salt * 0.18;
  const timeScale = baseScale * (isGrenade ? 0.85 + falloff * 0.38 : 1);

  return {
    clipIndex,
    timeScale,
    startDelay: isGrenade
      ? victimStagger + 0.05 + salt * 0.32
      : salt * 0.09,
    knockbackJitter: isGrenade ? 0.58 + salt2 * 0.78 : 1,
    tiltJitter: isGrenade ? 0.62 + salt * 0.62 : 1,
  };
}

function createEnemyRigDeathActions(mixer) {
  const actions = [];
  for (const { clip } of _deathClips) {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.setEffectiveWeight(0);
    action.setEffectiveTimeScale(0);
    action.time = 0;
    actions.push(action);
  }
  return actions;
}

function stopEnemyRigDeathActions(rig) {
  if (!rig.deathActions?.length) return;
  for (const action of rig.deathActions) {
    action.stop();
    action.setEffectiveWeight(0);
    action.setEffectiveTimeScale(0);
    action.paused = false;
    action.time = 0;
  }
  rig.activeDeathAction = null;
  rig.deathStartDelay = 0;
  rig.deathTimeScale = 1;
}

/** Strip horizontal hips drift — keep vertical fall motion. */
function makeDeathClip(source, id = "death") {
  const clip = makeInPlaceWalkClip(source.clone());
  clip.name = `enemy-death-${id}`;
  return clip;
}

function restoreEnemyRigRenderState(rig) {
  rig.holder.visible = true;
  rig.holder.scale.setScalar(rig.visualScale);
  rig.holder.position.y = rig.baseY;
  rig.holder.rotation.x = 0;
  rig.holder.traverse((object) => {
    if (!object.isMesh) return;
    object.visible = true;
    object.castShadow = object.userData.shadowCast !== false;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const mat of materials) {
      if (!mat) continue;
      mat.opacity = 1;
      mat.transparent = false;
      mat.colorWrite = true;
      mat.depthWrite = true;
      mat.depthTest = true;
    }
  });
}

function createEnemyRigFadeMaterial(source) {
  const src = Array.isArray(source) ? source[0] : source;
  if (!src) return null;
  const fadeMat = new THREE.MeshLambertMaterial({
    map: src.map ?? null,
    color: src.color?.clone?.() ?? new THREE.Color(0xffffff),
    transparent: true,
    opacity: 1,
    depthWrite: true,
  });
  const emissiveIntensity = src.emissiveIntensity ?? 0;
  if (src.emissiveMap && emissiveIntensity > 0) {
    fadeMat.emissiveMap = src.emissiveMap;
    fadeMat.emissive.setRGB(1, 1, 1);
    fadeMat.emissiveIntensity = emissiveIntensity;
    fadeMat.userData.deathFadeEmissive = emissiveIntensity;
  }
  return fadeMat;
}

/** Per-mesh Lambert (with albedo map) for opacity fade — only the dying rig. */
function beginEnemyRigFadeMaterials(rig) {
  if (rig.deathFadeMaterials) return;
  rig.deathFadeMaterials = [];
  rig.root.traverse((object) => {
    if (!object.isMesh) return;
    const previous = object.material;
    const fadeMat = createEnemyRigFadeMaterial(previous);
    if (!fadeMat) return;
    rig.deathFadeMaterials.push({
      object,
      previous,
      fade: fadeMat,
    });
    object.material = fadeMat;
  });
}

function restoreEnemyRigDeathMaterials(rig) {
  if (!rig.deathFadeMaterials) return;
  for (const entry of rig.deathFadeMaterials) {
    entry.fade.dispose();
    entry.object.material = entry.previous;
  }
  rig.deathFadeMaterials = null;
}

function applyEnemyRigOpacityFade(rig, opacity) {
  const clamped = THREE.MathUtils.clamp(opacity, 0, 1);
  const fading = clamped < 0.999;
  rig.root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const mat of materials) {
      if (!mat) continue;
      mat.opacity = clamped;
      mat.transparent = true;
      mat.depthWrite = clamped > 0.15;
      if (mat.emissiveIntensity !== undefined) {
        const base = mat.userData.deathFadeEmissive ?? mat.emissiveIntensity;
        mat.emissiveIntensity = base * clamped;
      }
      if (fading) {
        object.castShadow = clamped > 0.35 && object.userData.shadowCast !== false;
      }
    }
  });
}

function poseTemplate(template) {
  const skinned = findSkinnedMesh(template);
  skinned?.skeleton?.pose();
  template.updateMatrixWorld(true);
}

/**
 * Meshy PX-27 exports mesh vertices in meters (~1.7 tall) with an Armature at
 * 0.01 scale for centimeter bones. setFromObject reports ~0.017 m but the
 * skinned draw is ~1.7 m — never scale from the world bbox or we 100x giants.
 */
function measureTemplateFooting(template) {
  poseTemplate(template);
  const skinned = findSkinnedMesh(template);
  if (!skinned?.geometry) {
    _templateHeight = 1.7;
    return;
  }
  if (!skinned.geometry.boundingBox) {
    skinned.geometry.computeBoundingBox();
  }
  const box = skinned.geometry.boundingBox;
  _templateHeight = Math.max(0.1, box.max.y - box.min.y);
}

function snapRigHolderToGround(holder, root, height) {
  const skinned = findSkinnedMesh(root);
  if (!skinned?.geometry) {
    holder.position.y = -height / 2;
    return holder.position.y;
  }
  if (!skinned.geometry.boundingBox) {
    skinned.geometry.computeBoundingBox();
  }
  const armature = root.getObjectByName("Armature");
  const armScale = armature?.scale?.x ?? 1;
  const footY = skinned.geometry.boundingBox.min.y * armScale * holder.scale.x;
  holder.position.y = -height / 2 - footY;
  return holder.position.y;
}

/** Strip horizontal hips motion so walk cycles in place. */
function makeInPlaceWalkClip(source) {
  const tracks = source.tracks.map((track) => {
    const cloned = track.clone();
    const bone = trackBoneName(cloned.name) ?? "";
    if (
      /hips/i.test(bone) &&
      cloned.name.endsWith(".position") &&
      cloned.values.length >= 3
    ) {
      const baseX = cloned.values[0];
      const baseZ = cloned.values[2];
      for (let i = 0; i < cloned.values.length; i += 3) {
        cloned.values[i] = baseX;
        cloned.values[i + 2] = baseZ;
      }
    }
    return cloned;
  });
  return new THREE.AnimationClip(
    source.name || "enemy-walk",
    source.duration,
    tracks,
  );
}

export async function preloadEnemyRig() {
  if (useSimpleEnemyMeshes()) return;
  if (_template && _walkClip && _runClip && _deathClips.length) return;
  if (_loadPromise) return _loadPromise;

  const loader = new GLTFLoader();
  _loadPromise = Promise.all([
    loader.loadAsync(ENEMY_CHARACTER_URL),
    loader.loadAsync(ENEMY_WALK_URL),
    loader.loadAsync(ENEMY_RUN_URL),
    loader.loadAsync(ENEMY_DEATH_URL),
    loader.loadAsync(ENEMY_DEATH_ABDOMINAL_URL),
  ]).then(([characterGltf, walkGltf, runGltf, deathGltf, abdominalGltf]) => {
    const walkSource = pickLocomotionClip(walkGltf.animations, /walk/i);
    const runSource = pickLocomotionClip(runGltf.animations, /run/i);
    const deathSource = pickDeathClip(deathGltf.animations);
    const abdominalSource = pickAbdominalDeathClip(abdominalGltf.animations);
    if (!walkSource) throw new Error("PX-27 walk GLB has no animation");
    if (!runSource) throw new Error("PX-27 run GLB has no animation");
    if (!deathSource) throw new Error("PX-27 death GLB has no animation");
    if (!abdominalSource) {
      throw new Error("PX-27 abdominal death GLB has no animation");
    }

    const skinned = findSkinnedMesh(characterGltf.scene);
    if (!skinned?.skeleton) {
      throw new Error("PX-27 character GLB has no skinned mesh");
    }

    _walkClip = makeInPlaceWalkClip(walkSource.clone());
    _walkClipDuration = _walkClip.duration;
    _runClip = makeInPlaceWalkClip(runSource.clone());
    _runClipDuration = _runClip.duration;
    _deathClips = [
      {
        id: "dead",
        clip: makeDeathClip(deathSource, "dead"),
      },
      {
        id: "abdominal",
        clip: makeDeathClip(abdominalSource, "abdominal"),
      },
    ];
    _template = characterGltf.scene;
    _template.traverse((object) => {
      if (!object.isMesh) return;
      configureEnemyRigMesh(object);
    });
    measureTemplateFooting(_template);
  }).finally(() => {
    _loadPromise = null;
  });
  return _loadPromise;
}

function configureEnemyRigMaterial(mat) {
  if (!mat) return;
  mat.opacity = 1;
  mat.transparent = false;
  mat.colorWrite = true;
  mat.side = THREE.FrontSide;
  mat.depthTest = true;
  mat.depthWrite = true;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 0.75;
  mat.polygonOffsetUnits = 0.75;

  // Meshy exports the albedo as emissive too — never use that directly.
  if (mat.emissive?.isColor) {
    mat.emissive.setRGB(0, 0, 0);
  }
  if (mat.emissiveIntensity !== undefined) {
    mat.emissiveIntensity = 0;
  }
  if (mat.transparent && mat.opacity >= 1) {
    mat.transparent = false;
  }
  captureEnemyRigMaterialBase(mat);
  applyEnemyRigMaterialTuning(mat, getEnemyRigTuning().material);
}

function configureEnemyRigMesh(mesh) {
  setWorldLayer(mesh);
  mesh.renderOrder = 0;
  mesh.userData.shadowCast = true;
  mesh.userData.shadowReceive = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    configureEnemyRigMaterial(mat);
  }
}

function configureEnemyRigHitbox(target) {
  const mat = target.material;
  if (!mat) return;
  mat.transparent = true;
  mat.opacity = 0;
  mat.colorWrite = false;
  mat.depthWrite = false;
  mat.depthTest = false;
  target.castShadow = false;
}

function setProceduralBodyVisible(target, visible) {
  const mat = target.material;
  if (!mat) return;
  if (visible) {
    mat.opacity = 1;
    mat.transparent = false;
    mat.colorWrite = true;
    mat.depthWrite = true;
    mat.depthTest = true;
    target.castShadow = true;
    return;
  }
  configureEnemyRigHitbox(target);
}

/** @param {THREE.Mesh} target @param {"glb" | "procedural"} mode */
export function setEnemyRigVisualMode(target, mode) {
  const rig = target?.userData?.enemyRig;
  if (!rig) {
    if (target?.userData?.hasRifle) {
      setProceduralBodyVisible(target, useSimpleEnemyMeshes());
    }
    return;
  }
  const showRig = mode === "glb";
  rig.holder.visible = showRig;
  setProceduralBodyVisible(target, !showRig);
  target.userData.enemyRigVisualMode = mode;
  if (showRig) {
    rig.mixer.update(0);
  }
}

/**
 * @param {THREE.Mesh} target
 * @param {THREE.Vector3 | { x: number, y?: number, z: number }} playerPosition
 */
export function updateEnemyRigLod(target, _playerPosition) {
  if (target?.userData?.enemyRig?.dying) return;
  if (!target?.userData?.hasRifle) return;
  if (useSimpleEnemyMeshes()) {
    setEnemyRigVisualMode(target, "procedural");
    return;
  }
  if (target.userData.enemyRig) {
    setEnemyRigVisualMode(target, "glb");
  } else {
    setProceduralBodyVisible(target, false);
  }
}

/** @param {THREE.Mesh[]} targets */
export function refreshAllEnemyRigVisuals(targets) {
  if (!targets?.length) return;
  for (const mesh of targets) {
    if (!mesh?.userData?.hasRifle) continue;
    if (useSimpleEnemyMeshes()) {
      setEnemyRigVisualMode(mesh, "procedural");
    } else if (mesh.userData.enemyRig) {
      setEnemyRigVisualMode(mesh, "glb");
    } else {
      setProceduralBodyVisible(mesh, false);
    }
  }
}

/** @param {THREE.Mesh[]} targets @param {THREE.Vector3} playerPosition */
export function refreshEnemyRigPerfForTargets(targets, playerPosition) {
  if (!targets?.length || !playerPosition) return;
  for (const mesh of targets) {
    updateEnemyRigLod(mesh, playerPosition);
  }
}

function createMuzzleAnchor(target, height, tuning = getEnemyRigTuning()) {
  const muzzle = new THREE.Object3D();
  muzzle.name = "enemy-rifle-muzzle";
  applyMuzzleTuning(muzzle, height, tuning);
  muzzle.userData.muzzleLocal = new THREE.Vector3();
  target.add(muzzle);
  target.userData.enemyRifle = muzzle;
  return muzzle;
}

function resetEnemyRigDeathVisual(rig) {
  restoreEnemyRigRenderState(rig);
}

function resolveGrenadeBlastDir(mesh, bulletDir, blastOrigin, out) {
  if (blastOrigin) {
    out.subVectors(mesh.position, blastOrigin);
    out.y = 0;
    if (out.lengthSq() > 1e-6) return out.normalize();
  }
  out.set(bulletDir?.x ?? 0, 0, bulletDir?.z ?? 0);
  if (out.lengthSq() > 1e-6) return out.normalize();
  return out.set(0, 0, 1);
}

function seedEnemyRigGrenadeKnockback(
  mesh,
  blastDir,
  knockbackMul,
  blastFalloff,
  knockbackJitter = 1,
  tiltJitter = 1,
) {
  const height = mesh.userData.height ?? 1.75;
  const floorY = mesh.position.y - height / 2;
  const knockback = (knockbackMul ?? 1) * knockbackJitter;
  const falloff = THREE.MathUtils.clamp(blastFalloff ?? 1, 0, 1);
  const power = knockback * (0.72 + 0.55 * falloff);
  const awayYaw = Math.atan2(blastDir.x, blastDir.z);

  return {
    floorY,
    height,
    launchY: 0,
    launchVelY:
      (LAUNCH_UP_VEL + Math.random() * 1.5) * GRENADE_LAUNCH_MUL * power,
    launchVelX:
      blastDir.x * LAUNCH_BACK_VEL * GRENADE_LAUNCH_MUL * GRENADE_LAUNCH_BACK_BOOST * power,
    launchVelZ:
      blastDir.z * LAUNCH_BACK_VEL * GRENADE_LAUNCH_MUL * GRENADE_LAUNCH_BACK_BOOST * power,
    originX: mesh.position.x,
    originZ: mesh.position.z,
    airborne: true,
    baseYaw: awayYaw,
    tiltX: 0.22 * tiltJitter,
    settled: false,
  };
}

function tickEnemyRigLaunch(blast, dt) {
  if (!blast.airborne) return;
  blast.launchVelY -= LAUNCH_GRAVITY * dt;
  blast.launchY += blast.launchVelY * dt;
  blast.originX += blast.launchVelX * dt;
  blast.originZ += blast.launchVelZ * dt;
  if (blast.launchY <= 0) {
    blast.launchY = 0;
    blast.launchVelY = 0;
    blast.airborne = false;
    blast.launchVelX *= 0.3;
    blast.launchVelZ *= 0.3;
  }
}

function updateEnemyRigGrenadeKnockback(mesh, rig, blast, dt) {
  if (!blast || blast.settled) return;

  const movingBefore =
    blast.airborne ||
    Math.abs(blast.launchVelX) > 0.01 ||
    Math.abs(blast.launchVelZ) > 0.01 ||
    Math.abs(blast.tiltX) > 0.01;

  if (blast.airborne) {
    tickEnemyRigLaunch(blast, dt);
  } else if (
    Math.abs(blast.launchVelX) > 0.01 ||
    Math.abs(blast.launchVelZ) > 0.01
  ) {
    blast.originX += blast.launchVelX * dt;
    blast.originZ += blast.launchVelZ * dt;
    blast.launchVelX *= Math.max(0, 1 - LAUNCH_GROUND_FRICTION * dt);
    blast.launchVelZ *= Math.max(0, 1 - LAUNCH_GROUND_FRICTION * dt);
  }

  mesh.rotation.y = blast.baseYaw;

  const horizSpeed = Math.hypot(blast.launchVelX, blast.launchVelZ);
  const tiltTarget = blast.airborne
    ? THREE.MathUtils.clamp(0.18 + horizSpeed * 0.09, 0.18, 0.62)
    : 0;
  blast.tiltX = THREE.MathUtils.lerp(blast.tiltX, tiltTarget, Math.min(1, 12 * dt));
  rig.holder.rotation.x = blast.tiltX;

  const movingAfter =
    blast.airborne ||
    Math.abs(blast.launchVelX) > 0.01 ||
    Math.abs(blast.launchVelZ) > 0.01 ||
    Math.abs(blast.tiltX) > 0.01;

  if (movingBefore) {
    mesh.position.set(
      blast.originX,
      blast.floorY + blast.launchY + blast.height / 2,
      blast.originZ,
    );
  }

  if (!movingAfter) blast.settled = true;
}

/** Rigged PX-27 targets use the Meshy death clip instead of procedural ragdoll. */
export function shouldUseEnemyRigDeath(mesh) {
  return Boolean(mesh?.userData?.enemyRig);
}

/** @param {THREE.Mesh} mesh @param {THREE.Vector3} [bulletDir] @param {{ hitZone?: string, knockbackMul?: number, blastFalloff?: number, blastOrigin?: THREE.Vector3 }} [opts] */
export function startEnemyRigDeath(mesh, bulletDir = null, opts = {}) {
  const rig = mesh?.userData?.enemyRig;
  if (!rig || rig.dying || !_deathClips.length || !rig.deathActions?.length) {
    return false;
  }

  mesh.visible = true;
  setEnemyRigVisualMode(mesh, "glb");
  restoreEnemyRigDeathMaterials(rig);
  rig.dying = true;
  rig.deathSettleTime = 0;
  rig.deathFadeT = -1;
  rig.deathBlast = null;
  restoreEnemyRigRenderState(rig);

  rig.walkAction.setEffectiveWeight(0);
  rig.runAction.setEffectiveWeight(0);
  rig.walkAction.setEffectiveTimeScale(0);
  rig.runAction.setEffectiveTimeScale(0);

  stopEnemyRigDeathActions(rig);
  const variant = pickEnemyRigDeathVariant(
    opts,
    rig.deathActions.length,
    mesh,
  );
  const deathAction = rig.deathActions[variant.clipIndex] ?? rig.deathActions[0];
  rig.activeDeathAction = deathAction;
  rig.deathStartDelay = variant.startDelay;
  rig.deathTimeScale = variant.timeScale;
  deathAction.reset();
  deathAction.setLoop(THREE.LoopOnce, 1);
  deathAction.clampWhenFinished = true;
  deathAction.setEffectiveWeight(variant.startDelay > 0 ? 0 : 1);
  deathAction.setEffectiveTimeScale(variant.timeScale);
  deathAction.paused = variant.startDelay > 0;
  deathAction.play();

  if (variant.startDelay > 0) {
    rig.walkAction.setEffectiveWeight(1);
    rig.walkAction.setEffectiveTimeScale(0);
  }

  const isGrenade = opts.hitZone === "grenade";
  const falloff = THREE.MathUtils.clamp(opts.blastFalloff ?? 1, 0, 1);

  if (bulletDir?.lengthSq?.() > 1e-6 || opts.blastOrigin) {
    if (isGrenade) {
      const blastDir = resolveGrenadeBlastDir(
        mesh,
        bulletDir,
        opts.blastOrigin ?? null,
        _grenadeBlastDir,
      );
      mesh.rotation.y = Math.atan2(blastDir.x, blastDir.z);
      rig.deathBlast = seedEnemyRigGrenadeKnockback(
        mesh,
        blastDir,
        opts.knockbackMul,
        falloff,
        variant.knockbackJitter,
        variant.tiltJitter,
      );
      tickEnemyRigLaunch(rig.deathBlast, 1 / 60);
      mesh.position.set(
        rig.deathBlast.originX,
        rig.deathBlast.floorY + rig.deathBlast.launchY + rig.deathBlast.height / 2,
        rig.deathBlast.originZ,
      );
      rig.holder.rotation.x = rig.deathBlast.tiltX;
    } else if (bulletDir?.lengthSq?.() > 1e-6) {
      mesh.rotation.y = Math.atan2(-bulletDir.x, -bulletDir.z);
    }
  }

  rig.mixer.update(0);
  return true;
}

/** @returns {boolean} true when the death sequence is finished */
export function updateEnemyRigDeath(mesh, dt) {
  const rig = mesh?.userData?.enemyRig;
  if (!rig?.dying) return true;

  if (rig.deathBlast && !rig.deathBlast.settled) {
    updateEnemyRigGrenadeKnockback(mesh, rig, rig.deathBlast, dt);
  }

  if (rig.deathStartDelay > 0) {
    rig.deathStartDelay -= dt;
    rig.mixer.update(0);
    if (rig.deathStartDelay > 0) return false;
    rig.walkAction.setEffectiveWeight(0);
    rig.walkAction.setEffectiveTimeScale(0);
    if (rig.activeDeathAction) {
      rig.activeDeathAction.setEffectiveWeight(1);
      rig.activeDeathAction.setEffectiveTimeScale(rig.deathTimeScale ?? 1);
      rig.activeDeathAction.paused = false;
    }
  }

  rig.mixer.update(dt);

  const deathAction = rig.activeDeathAction ?? rig.deathActions[0];
  if (!deathAction) return false;
  const clipDuration = deathAction.getClip().duration;
  if (deathAction.time < clipDuration - 1e-3) return false;

  rig.deathSettleTime += dt;
  if (rig.deathSettleTime < ENEMY_RIG_DEATH_SETTLE_SEC) return false;

  if (!rig.deathFadeMaterials) beginEnemyRigFadeMaterials(rig);

  if (rig.deathFadeT < 0) rig.deathFadeT = 0;
  rig.deathFadeT += dt / ENEMY_RIG_DEATH_FADE_SEC;
  applyEnemyRigOpacityFade(rig, 1 - rig.deathFadeT);

  if (rig.deathFadeT < 1) return false;

  rig.holder.visible = false;
  return true;
}

export function resetEnemyRigDeath(mesh) {
  const rig = mesh?.userData?.enemyRig;
  if (!rig) return;

  rig.dying = false;
  rig.deathSettleTime = 0;
  rig.deathFadeT = -1;
  rig.deathBlast = null;
  restoreEnemyRigDeathMaterials(rig);
  stopEnemyRigDeathActions(rig);
  resetEnemyRigDeathVisual(rig);

  for (const action of [rig.walkAction, rig.runAction]) {
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    action.setEffectiveWeight(0);
    action.setEffectiveTimeScale(0);
    action.time = 0;
  }
  rig.walkAction.setEffectiveWeight(1);
  rig.locomotionMode = "walk";
  rig.mixer.update(0);
}

export function attachEnemyRig(target, height) {
  if (useSimpleEnemyMeshes()) return null;
  if (!_template || !_walkClip || !_runClip || !_deathClips.length || !target || target.userData.enemyRig) {
    return null;
  }

  const root = cloneSkeleton(_template);
  const holder = new THREE.Group();
  holder.name = "enemy-rig-visual";
  const scale = height / _templateHeight;
  holder.scale.setScalar(scale);
  holder.add(root);
  root.traverse((object) => {
    if (!object.isMesh) return;
    configureEnemyRigMesh(object);
  });

  const mixer = new THREE.AnimationMixer(root);
  const walkAction = mixer.clipAction(_walkClip);
  const runAction = mixer.clipAction(_runClip);
  const deathActions = createEnemyRigDeathActions(mixer);
  for (const action of [walkAction, runAction]) {
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    action.setEffectiveWeight(0);
    action.setEffectiveTimeScale(0);
    action.time = 0;
  }
  walkAction.setEffectiveWeight(1);
  mixer.update(0);

  const baseY = snapRigHolderToGround(holder, root, height);

  target.add(holder);
  const rig = {
    holder,
    root,
    mixer,
    walkAction,
    runAction,
    deathActions,
    activeDeathAction: null,
    deathStartDelay: 0,
    deathTimeScale: 1,
    locomotionMode: "walk",
    walkDirection: 1,
    dying: false,
    visualScale: scale,
    deathSettleTime: 0,
    deathFadeT: -1,
    deathFadeMaterials: null,
    deathBlast: null,
    baseY,
    walkClipDuration: _walkClipDuration,
    runClipDuration: _runClipDuration,
  };
  target.userData.enemyRig = rig;
  target.userData.enemyRigVisualMode = "glb";
  _rigInstances.add(rig);
  setWorldLayer(holder);
  enableShadowsOn(holder);
  applyTuningToRig(rig, getEnemyRigPoseForState(false));
  createMuzzleAnchor(target, height);
  setEnemyRigVisualMode(target, "glb");
  return rig;
}

export async function ensureEnemyRigAttached(target, height) {
  if (!target?.userData?.hasRifle || target.userData.enemyRig) {
    return target?.userData?.enemyRig ?? null;
  }
  if (useSimpleEnemyMeshes()) return null;
  await preloadEnemyRig();
  return attachEnemyRig(target, height);
}

/** Attach rigs to every rifle target that missed spawn-time preload. */
export async function attachAllEnemyRigs(targets) {
  if (useSimpleEnemyMeshes() || !targets?.length) return;
  await preloadEnemyRig();
  for (const mesh of targets) {
    if (mesh?.userData?.hasRifle && !mesh.userData.enemyRig) {
      attachEnemyRig(mesh, mesh.userData.height);
    }
  }
  refreshAllEnemyRigVisuals(targets);
}

export function updateEnemyRigAnimation(
  target,
  dt,
  moving,
  moveSpeed = 1,
  walkDirection = 1,
  playerPosition = null,
) {
  const rig = target?.userData?.enemyRig;
  if (!rig || rig.dying) return;

  if (playerPosition) updateEnemyRigLod(target, playerPosition);

  const tuning = getEnemyRigTuning();
  const previewing =
    tuning.previewAnimation && isEnemyRigWizardPreviewActive();
  const animating = moving || previewing;
  applyTuningToRig(rig, getEnemyRigPoseForState(moving, tuning));

  const useRun = !previewing && moving && moveSpeed >= ENEMY_RUN_SPEED_THRESHOLD;
  const activeAction = useRun ? rig.runAction : rig.walkAction;
  const inactiveAction = useRun ? rig.walkAction : rig.runAction;
  const clipDuration = useRun ? rig.runClipDuration : rig.walkClipDuration;
  if (rig.locomotionMode !== (useRun ? "run" : "walk")) {
    rig.locomotionMode = useRun ? "run" : "walk";
    activeAction.time = 0;
  }

  if (!animating) {
    activeAction.setEffectiveWeight(1);
    inactiveAction.setEffectiveWeight(0);
    activeAction.setEffectiveTimeScale(0);
    inactiveAction.setEffectiveTimeScale(0);
    activeAction.time = 0;
  } else {
    inactiveAction.setEffectiveWeight(0);
    inactiveAction.setEffectiveTimeScale(0);
    activeAction.setEffectiveWeight(1);
    const direction = previewing
      ? (tuning.previewReverse ? -1 : 1)
      : (walkDirection < 0 ? -1 : 1);
    if (
      direction < 0 &&
      rig.walkDirection > 0 &&
      activeAction.time <= 1e-4
    ) {
      activeAction.time = clipDuration - 1e-4;
    }
    rig.walkDirection = direction;
    const speedScale = useRun
      ? Math.max(0.7, moveSpeed / RUN_ANIM_LOCOMOTION_REF)
      : Math.max(0.65, moveSpeed / WALK_ANIM_LOCOMOTION_REF);
    activeAction.setEffectiveTimeScale(direction * speedScale);
  }

  if (rig.holder.visible) {
    rig.mixer.update(dt);
  }
}

export function resetEnemyRigAsset() {
  _template = null;
  _walkClip = null;
  _runClip = null;
  _deathClips = [];
  _walkClipDuration = 1;
  _runClipDuration = 1;
  _loadPromise = null;
  _rigInstances.clear();
}
