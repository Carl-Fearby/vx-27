import * as THREE from "three";
import { WORLD_LAYER } from "../lighting/LightingLayers.js";
import { OIL_BARREL_PLAYER_STAND_EYE } from "../oil-barrel/OilBarrelDimensions.js";
import { SCORE_PACK_PICKUP_SRC } from "../pickups/ScorePack.js";
import {
  canWallWeaponResupply,
  getWallShopPurchaseCost,
  SERVICE_ROOM_PISTOL_SHOP_OFFER,
  SERVICE_ROOM_RIFLE_SHOP_OFFER,
  tryWallWeaponShopPurchase,
  getWallWeaponShopPrompt,
} from "./WallWeaponShop.js";

export {
  SERVICE_ROOM_PISTOL_SHOP_OFFER,
  SERVICE_ROOM_RIFLE_SHOP_OFFER,
} from "./WallWeaponShop.js";

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {RifleShopState | null | undefined} shop */
export function getWallWeaponShopStatePrompt(ctx, shop) {
  const offer = shop?.offer ?? SERVICE_ROOM_RIFLE_SHOP_OFFER;
  return getWallWeaponShopPrompt(
    ctx.playerScoreRef?.current ?? 0,
    ctx.bindingsRef?.current,
    offer,
    canWallWeaponResupply(ctx, offer),
  );
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx */
export function getRifleShopPrompt(ctx) {
  return getWallWeaponShopStatePrompt(ctx, ctx.rifleShopRef?.current);
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {number} now */
export function tryPurchaseRifle(ctx, now) {
  return tryPurchaseRifleFromShop(ctx, now);
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {RifleShopState | null | undefined} shop @param {number} now */
export function tryPurchaseWallWeaponShop(ctx, shop, now) {
  const offer = shop?.offer;
  if (!offer) return false;
  return tryWallWeaponShopPurchase(ctx, offer, now);
}

/** @deprecated Use SERVICE_ROOM_RIFLE_SHOP_OFFER.unlockCost */
export const RIFLE_UNLOCK_COST = SERVICE_ROOM_RIFLE_SHOP_OFFER.unlockCost;

export const RIFLE_SHOP_IMAGE_URL = "/ui/vx-27.png?v=2";
export const PISTOL_SHOP_IMAGE_URL = "/ui/vx-27-pistol.png?v=1";

export const RIFLE_SHOP_PRODUCT_MODEL = "VX-27";
export const RIFLE_SHOP_PRODUCT_SUBTITLE = "Tactical Pulse Rifle";
export const PISTOL_SHOP_PRODUCT_MODEL = "VX-27";
export const PISTOL_SHOP_PRODUCT_SUBTITLE = "Tactical Pulse Pistol";

/** @deprecated Shop is on the arena north wall; kept for room-interior tooling only. */
export const RIFLE_SHOP_ROOM_ID = "service_room";

/** North arena wall — player spot x:5.881 z:-13.15 facing north (yaw ~352°). */
export const RIFLE_SHOP_LOOK_X = 5.881;
/** North arena wall — player spot x:8.899 z:-13.092 facing north (yaw 357.7°). */
export const PISTOL_SHOP_LOOK_X = 8.899;
/** Poster center — standing player eye height. */
export const RIFLE_SHOP_CENTER_Y = OIL_BARREL_PLAYER_STAND_EYE;

export const RIFLE_SHOP_INTERACT_MAX_DIST = 2.6;

/** Purchase hit zone on the wall plane — 600 mm from the shop centre. */
export const RIFLE_SHOP_WALL_RING_RADIUS = 0.6;

const RIFLE_SHOP_GROUP_NAME = "rifle_shop";
const PISTOL_SHOP_GROUP_NAME = "pistol_shop";
const IMAGE_WIDTH = 0.65;
const PISTOL_SHOP_IMAGE_WIDTH = 0.26;
const IMAGE_ASPECT_DEFAULT = 560 / 1627;
const TITLE_GAP = 0.028;
const PRICE_GAP = 0.03;
const WALL_INSET = 0.08;
const TITLE_CANVAS_W = 1024;
const TITLE_CANVAS_H = 168;
const TITLE_WIDTH = IMAGE_WIDTH;
const TITLE_HEIGHT = TITLE_WIDTH * (TITLE_CANVAS_H / TITLE_CANVAS_W);
const PRICE_CANVAS_W = 1024;
const PRICE_CANVAS_H = 120;
const PRICE_WIDTH = IMAGE_WIDTH;
const PRICE_HEIGHT = PRICE_WIDTH * (PRICE_CANVAS_H / PRICE_CANVAS_W);

/**
 * @typedef {{
 *   group: THREE.Group,
 *   interactMeshes: THREE.Mesh[],
 *   visible: boolean,
 *   offer: import("./WallWeaponShop.js").WallWeaponShopOffer,
 *   syncWallPrice: (ctx: import("../gameLoop/gameLoopContext.js").GameLoopContext) => void,
 * }} RifleShopState
 */

/**
 * North perimeter wall — decal sits on inner face, facing south into the arena.
 *
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 */
export function resolveRifleShopPosition(arena) {
  const half = (arena.size ?? 28) / 2;
  return {
    x: RIFLE_SHOP_LOOK_X,
    y: RIFLE_SHOP_CENTER_Y,
    z: -half + WALL_INSET,
    rotationY: 0,
  };
}

/**
 * North perimeter wall — pistol decal sits on inner face, facing south into the arena.
 *
 * @param {import("../level/loadArena.js").ArenaConfig} arena
 */
export function resolvePistolShopPosition(arena) {
  const half = (arena.size ?? 28) / 2;
  return {
    x: PISTOL_SHOP_LOOK_X,
    y: RIFLE_SHOP_CENTER_Y,
    z: -half + WALL_INSET,
    rotationY: 0,
  };
}

function pinShopLayers(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.layers.disableAll();
    obj.layers.enable(WORLD_LAYER);
  });
}

/** @param {THREE.Texture} tex @param {number} [maxAnisotropy] */
function configureShopTexture(tex, maxAnisotropy = 16) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * @param {THREE.Texture | null} map
 * @param {{ emissiveIntensity?: number, colorGain?: number }} [opts]
 * @returns {THREE.MeshStandardMaterial}
 */
function createDecalMaterial(map, opts = {}) {
  const emissiveIntensity = opts.emissiveIntensity ?? 0.2;
  const colorGain = opts.colorGain ?? 1.12;
  return new THREE.MeshStandardMaterial({
    map,
    color: new THREE.Color(colorGain, colorGain, colorGain),
    emissive: 0xffffff,
    emissiveMap: map ?? null,
    emissiveIntensity,
    roughness: 0.78,
    metalness: 0,
    side: THREE.FrontSide,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** @param {THREE.Mesh} mesh @param {number} [renderOrder] */
function configureShopDecalMesh(mesh, renderOrder = 6) {
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
}

/** @returns {THREE.CanvasTexture} */
function createPlaceholderRifleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  return configureShopTexture(new THREE.CanvasTexture(canvas));
}

const TITLE_MODEL_FONT =
  '700 88px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TITLE_SUBTITLE_FONT =
  '600 44px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const PRICE_VALUE_FONT =
  '800 96px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} font
 */
function paintOutlinedLabelText(ctx, text, x, y, font) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255, 255, 255, 0.45)";
  ctx.shadowBlur = 6;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} model
 * @param {string} subtitle
 */
function paintProductTitle(ctx, model, subtitle) {
  ctx.clearRect(0, 0, TITLE_CANVAS_W, TITLE_CANVAS_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const cx = TITLE_CANVAS_W / 2;
  paintOutlinedLabelText(
    ctx,
    model,
    cx,
    TITLE_CANVAS_H * 0.36,
    TITLE_MODEL_FONT,
  );
  paintOutlinedLabelText(
    ctx,
    subtitle,
    cx,
    TITLE_CANVAS_H * 0.74,
    TITLE_SUBTITLE_FONT,
  );
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cost
 * @param {CanvasImageSource | null} creditIcon
 * @param {boolean} [affordable]
 */
function paintPriceLabel(ctx, cost, creditIcon, affordable = true) {
  const value = cost.toLocaleString("en-US");
  const cy = PRICE_CANVAS_H / 2;
  ctx.clearRect(0, 0, PRICE_CANVAS_W, PRICE_CANVAS_H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.textBaseline = "middle";
  ctx.font = PRICE_VALUE_FONT;

  const iconSize = 84;
  const gap = 20;
  const valueW = ctx.measureText(value).width;
  const iconW = creditIcon ? iconSize + gap : 0;
  const startX = (PRICE_CANVAS_W - iconW - valueW) / 2;

  if (creditIcon) {
    ctx.drawImage(creditIcon, startX, cy - iconSize / 2, iconSize, iconSize);
  }

  const textX = startX + iconW;
  ctx.textAlign = "left";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
  ctx.strokeText(value, textX, cy);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255, 255, 255, 0.45)";
  ctx.shadowBlur = 6;
  ctx.fillText(value, textX, cy);
  ctx.shadowBlur = 0;
}

const _shopWorldPosScratch = new THREE.Vector3();
const _shopWallNormalScratch = new THREE.Vector3();
const _shopWallHitScratch = new THREE.Vector3();
const _shopWallLocalScratch = new THREE.Vector3();
const _shopWallPlaneScratch = new THREE.Plane();

/**
 * Horizontal distance from the player to the shop anchor (meters).
 *
 * @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx
 * @param {RifleShopState | null | undefined} shop
 */
export function getPlayerWallWeaponShopDistance(ctx, shop) {
  if (!shop?.visible || !shop.group) return Infinity;
  shop.group.getWorldPosition(_shopWorldPosScratch);
  const px = ctx.camera?.position.x ?? 0;
  const pz = ctx.camera?.position.z ?? 0;
  return Math.hypot(px - _shopWorldPosScratch.x, pz - _shopWorldPosScratch.z);
}

/**
 * Horizontal distance from the player to the rifle shop anchor (meters).
 *
 * @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx
 */
export function getPlayerRifleShopDistance(ctx) {
  return getPlayerWallWeaponShopDistance(ctx, ctx.rifleShopRef?.current);
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {RifleShopState | null | undefined} shop @param {number} [maxDist] */
export function isPlayerWithinWallWeaponShopRange(
  ctx,
  shop,
  maxDist = RIFLE_SHOP_INTERACT_MAX_DIST,
) {
  return getPlayerWallWeaponShopDistance(ctx, shop) <= maxDist;
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {number} [maxDist] */
export function isPlayerWithinRifleShopRange(
  ctx,
  maxDist = RIFLE_SHOP_INTERACT_MAX_DIST,
) {
  return getPlayerRifleShopDistance(ctx) <= maxDist;
}

/** @returns {THREE.MeshStandardMaterial} */
function createTitleMaterial(maxAnisotropy, model, subtitle) {
  const canvas = document.createElement("canvas");
  canvas.width = TITLE_CANVAS_W;
  canvas.height = TITLE_CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (ctx) paintProductTitle(ctx, model, subtitle);
  const tex = configureShopTexture(new THREE.CanvasTexture(canvas), maxAnisotropy);
  return createDecalMaterial(tex, { emissiveIntensity: 0.24, colorGain: 1.14 });
}

/** @param {THREE.MeshStandardMaterial} priceMat @param {number} cost @param {number} maxAnisotropy @param {boolean} [affordable] */
function setWallPriceMaterial(priceMat, cost, maxAnisotropy, affordable = true) {
  const canvas = document.createElement("canvas");
  canvas.width = PRICE_CANVAS_W;
  canvas.height = PRICE_CANVAS_H;
  const ctx = canvas.getContext("2d");
  const tex = configureShopTexture(new THREE.CanvasTexture(canvas), maxAnisotropy);

  const refresh = (icon) => {
    if (!ctx) return;
    paintPriceLabel(ctx, cost, icon, affordable);
    tex.needsUpdate = true;
  };

  refresh(null);

  const oldMap = priceMat.map;
  priceMat.map = tex;
  priceMat.emissiveMap = tex;
  priceMat.needsUpdate = true;
  oldMap?.dispose?.();

  new THREE.TextureLoader().load(
    SCORE_PACK_PICKUP_SRC,
    (iconTex) => {
      refresh(iconTex.image ?? null);
      iconTex.dispose();
    },
    undefined,
    () => refresh(null),
  );
}

function layoutRifleShopPlanes(
  imageMesh,
  titleMesh,
  priceMesh,
  pickMesh,
  aspect,
  opts = {},
) {
  const imageWidth = opts.imageWidth ?? IMAGE_WIDTH;
  const labelAspect = opts.labelAspect ?? aspect;
  const imageHeight = imageWidth * aspect;
  const labelImageHeight = IMAGE_WIDTH * labelAspect;
  if (
    imageMesh.geometry.parameters.width !== imageWidth ||
    imageMesh.geometry.parameters.height !== imageHeight
  ) {
    imageMesh.geometry.dispose();
    imageMesh.geometry = new THREE.PlaneGeometry(imageWidth, imageHeight);
  }
  imageMesh.scale.set(1, 1, 1);
  imageMesh.position.y = 0;
  titleMesh.position.y =
    labelImageHeight / 2 + TITLE_GAP + TITLE_HEIGHT / 2;
  priceMesh.position.y =
    -(labelImageHeight / 2 + PRICE_GAP + PRICE_HEIGHT / 2);

  const totalHeight =
    TITLE_HEIGHT + TITLE_GAP + labelImageHeight + PRICE_GAP + PRICE_HEIGHT;
  const stackCenterY = (titleMesh.position.y + priceMesh.position.y) / 2;
  pickMesh.scale.set(IMAGE_WIDTH * 1.06, totalHeight * 1.06, 1);
  pickMesh.position.y = stackCenterY;
}

/**
 * @param {THREE.Object3D} levelRoot
 * @param {{
 *   maxAnisotropy?: number,
 *   imageUrl?: string,
 *   arena?: import("../level/loadArena.js").ArenaConfig,
 *   offer?: import("./WallWeaponShop.js").WallWeaponShopOffer,
 *   groupName?: string,
 *   productModel?: string,
 *   productSubtitle?: string,
 *   imageWidth?: number,
 *   labelAspect?: number,
 *   resolvePosition?: (arena: import("../level/loadArena.js").ArenaConfig) => { x: number, y: number, z: number, rotationY?: number },
 * }} [opts]
 * @returns {RifleShopState}
 */
function createWallWeaponShop(levelRoot, opts = {}) {
  const maxAnisotropy = opts.maxAnisotropy ?? 16;
  const imageUrl = opts.imageUrl ?? RIFLE_SHOP_IMAGE_URL;
  const offer = opts.offer ?? SERVICE_ROOM_RIFLE_SHOP_OFFER;
  const groupName = opts.groupName ?? RIFLE_SHOP_GROUP_NAME;
  const productModel = opts.productModel ?? RIFLE_SHOP_PRODUCT_MODEL;
  const productSubtitle = opts.productSubtitle ?? RIFLE_SHOP_PRODUCT_SUBTITLE;
  const imageWidth = opts.imageWidth ?? IMAGE_WIDTH;
  const labelAspect = opts.labelAspect;
  const resolvePosition = opts.resolvePosition ?? resolveRifleShopPosition;
  const pos = resolvePosition(opts.arena ?? { size: 28 });

  const group = new THREE.Group();
  group.name = groupName;
  group.userData.wallWeaponShop = true;
  group.userData.weaponId = offer.weaponId;
  group.userData.rifleShop = offer.weaponId === "rifle";
  group.position.set(pos.x, pos.y, pos.z);
  group.rotation.y = pos.rotationY ?? 0;

  const imageMat = createDecalMaterial(
    configureShopTexture(createPlaceholderRifleTexture(), maxAnisotropy),
    { emissiveIntensity: 0.28, colorGain: 1.18 },
  );
  const imageMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(imageWidth, imageWidth * IMAGE_ASPECT_DEFAULT),
    imageMat,
  );
  imageMesh.name = `${groupName}_image`;
  imageMesh.userData.rifleShopPick = true;
  imageMesh.userData.wallWeaponShopPick = true;
  configureShopDecalMesh(imageMesh, 6);

  const titleMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(TITLE_WIDTH, TITLE_HEIGHT),
    createTitleMaterial(maxAnisotropy, productModel, productSubtitle),
  );
  titleMesh.name = `${groupName}_title`;
  titleMesh.userData.rifleShopPick = true;
  titleMesh.userData.wallWeaponShopPick = true;
  configureShopDecalMesh(titleMesh, 5);

  const priceMat = createDecalMaterial(
    configureShopTexture(new THREE.CanvasTexture(document.createElement("canvas")), maxAnisotropy),
    { emissiveIntensity: 0.24, colorGain: 1.14 },
  );
  setWallPriceMaterial(priceMat, offer.unlockCost, maxAnisotropy);

  const priceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PRICE_WIDTH, PRICE_HEIGHT),
    priceMat,
  );
  priceMesh.name = `${groupName}_price`;
  priceMesh.userData.rifleShopPick = true;
  priceMesh.userData.wallWeaponShopPick = true;
  configureShopDecalMesh(priceMesh, 7);

  const pickMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      fog: false,
    }),
  );
  pickMesh.name = `${groupName}_pick`;
  pickMesh.userData.rifleShopPick = true;
  pickMesh.userData.wallWeaponShopPick = true;
  pickMesh.frustumCulled = false;

  layoutRifleShopPlanes(
    imageMesh,
    titleMesh,
    priceMesh,
    pickMesh,
    IMAGE_ASPECT_DEFAULT,
    { imageWidth, labelAspect },
  );

  group.add(titleMesh);
  group.add(imageMesh);
  group.add(priceMesh);
  group.add(pickMesh);
  levelRoot.add(group);
  pinShopLayers(group);

  let lastWallPrice = offer.unlockCost;
  let lastWallAffordable = true;

  new THREE.TextureLoader().load(
    imageUrl,
    (tex) => {
      if (!imageMesh.parent) {
        tex.dispose();
        return;
      }
      configureShopTexture(tex, maxAnisotropy);
      const oldMap = imageMat.map;
      imageMat.map = tex;
      imageMat.emissiveMap = tex;
      imageMat.needsUpdate = true;
      oldMap?.dispose?.();

      const img = tex.image;
      const aspect =
        img?.width > 0 && img?.height > 0
          ? img.height / img.width
          : IMAGE_ASPECT_DEFAULT;
      layoutRifleShopPlanes(imageMesh, titleMesh, priceMesh, pickMesh, aspect, {
        imageWidth,
        labelAspect,
      });
    },
    undefined,
    (err) => {
      console.warn("[WallWeaponShop] poster load failed:", imageUrl, err);
    },
  );

  return {
    group,
    interactMeshes: [pickMesh, titleMesh, imageMesh, priceMesh],
    visible: true,
    offer,
    syncWallPrice(ctx) {
      const canResupply = canWallWeaponResupply(ctx, offer);
      const cost = getWallShopPurchaseCost(offer, canResupply);
      const score = ctx.playerScoreRef?.current ?? 0;
      const affordable = score >= cost;
      if (cost === lastWallPrice && affordable === lastWallAffordable) return;
      lastWallPrice = cost;
      lastWallAffordable = affordable;
      setWallPriceMaterial(priceMat, cost, maxAnisotropy, affordable);
    },
  };
}

/**
 * @param {THREE.Object3D} levelRoot
 * @param {{ maxAnisotropy?: number, imageUrl?: string, arena?: import("../level/loadArena.js").ArenaConfig }} [opts]
 * @returns {RifleShopState}
 */
export function createRifleShop(levelRoot, opts = {}) {
  return createWallWeaponShop(levelRoot, {
    ...opts,
    imageUrl: opts.imageUrl ?? RIFLE_SHOP_IMAGE_URL,
    offer: SERVICE_ROOM_RIFLE_SHOP_OFFER,
    groupName: RIFLE_SHOP_GROUP_NAME,
    productModel: RIFLE_SHOP_PRODUCT_MODEL,
    productSubtitle: RIFLE_SHOP_PRODUCT_SUBTITLE,
    resolvePosition: resolveRifleShopPosition,
  });
}

/**
 * @param {THREE.Object3D} levelRoot
 * @param {{ maxAnisotropy?: number, imageUrl?: string, arena?: import("../level/loadArena.js").ArenaConfig }} [opts]
 * @returns {RifleShopState}
 */
export function createPistolShop(levelRoot, opts = {}) {
  return createWallWeaponShop(levelRoot, {
    ...opts,
    imageUrl: opts.imageUrl ?? PISTOL_SHOP_IMAGE_URL,
    offer: SERVICE_ROOM_PISTOL_SHOP_OFFER,
    groupName: PISTOL_SHOP_GROUP_NAME,
    productModel: PISTOL_SHOP_PRODUCT_MODEL,
    productSubtitle: PISTOL_SHOP_PRODUCT_SUBTITLE,
    imageWidth: PISTOL_SHOP_IMAGE_WIDTH,
    labelAspect: IMAGE_ASPECT_DEFAULT,
    resolvePosition: resolvePistolShopPosition,
  });
}

/** @param {RifleShopState | null | undefined} shop */
export function hideRifleShop(shop) {
  if (!shop?.group) return;
  shop.group.visible = false;
  shop.visible = false;
}

/**
 * Crosshair ray within the wall purchase disc (not just poster meshes).
 *
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Object3D | null | undefined} shopGroup
 * @param {number} [maxDist]
 * @param {{ point?: THREE.Vector3, distance?: number } | null} [target]
 */
export function pickRifleShopUnderCrosshair(
  raycaster,
  shopGroup,
  maxDist = RIFLE_SHOP_INTERACT_MAX_DIST,
  target = null,
) {
  if (!shopGroup) return null;

  shopGroup.getWorldPosition(_shopWorldPosScratch);
  _shopWallNormalScratch.set(0, 0, 1).applyQuaternion(shopGroup.quaternion);
  _shopWallPlaneScratch.setFromNormalAndCoplanarPoint(
    _shopWallNormalScratch,
    _shopWorldPosScratch,
  );

  if (!raycaster.ray.intersectPlane(_shopWallPlaneScratch, _shopWallHitScratch)) {
    return null;
  }

  const rayDist = raycaster.ray.origin.distanceTo(_shopWallHitScratch);
  if (rayDist > maxDist) return null;

  _shopWallLocalScratch.copy(_shopWallHitScratch);
  shopGroup.worldToLocal(_shopWallLocalScratch);
  if (
    Math.hypot(_shopWallLocalScratch.x, _shopWallLocalScratch.y) >
    RIFLE_SHOP_WALL_RING_RADIUS
  ) {
    return null;
  }

  const hit = target ?? {};
  hit.point = _shopWallHitScratch;
  hit.distance = rayDist;
  return hit;
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {number} now */
export function tryPurchaseRifleFromShop(ctx, now) {
  const offer =
    ctx.rifleShopRef?.current?.offer ?? SERVICE_ROOM_RIFLE_SHOP_OFFER;
  return tryWallWeaponShopPurchase(ctx, offer, now);
}
