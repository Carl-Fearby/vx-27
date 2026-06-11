import { formatBindingValue } from "../player/KeyBindings.js";
import { pulseCenterPrompt } from "../ui/CenterInteractPrompt.js";
import { getPrimaryWeaponConfig } from "./PrimaryWeapons.js";

/** @typedef {import("./PrimaryWeapons.js").PrimaryWeaponId} PrimaryWeaponId */

/**
 * Wall-mounted weapon vendor — costs and mag grants are per-offer, not hard-coded.
 * Magazine capacity always comes from {@link getPrimaryWeaponConfig}.
 *
 * @typedef {{
 *   weaponId: PrimaryWeaponId,
 *   productLabel?: string,
 *   unlockCost: number,
 *   resupplyCost: number,
 *   unlockMagCount: number,
 *   resupplyMagCount: number,
 * }} WallWeaponShopOffer
 */

/** Dark service room — VX-27 rifle wall offer. */
export const SERVICE_ROOM_RIFLE_SHOP_OFFER = {
  weaponId: "rifle",
  productLabel: "VX-27 Tactical Pulse Rifle",
  unlockCost: 2000,
  resupplyCost: 500,
  unlockMagCount: 2,
  resupplyMagCount: 1,
};

/** @param {WallWeaponShopOffer} offer */
function getWallShopProductLabel(offer) {
  return offer.productLabel ?? getPrimaryWeaponConfig(offer.weaponId).label;
}

/** @returns {Partial<Record<PrimaryWeaponId, number>>} */
export function createDefaultWallShopStages() {
  return { rifle: 0 };
}

/**
 * Stage 0 = weapon not bought yet (unlock only).
 * Stage 1+ = weapon owned; stage 2/3/4… are repeat mag purchases.
 *
 * @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx
 * @param {PrimaryWeaponId} weaponId
 */
export function getWallShopStage(ctx, weaponId) {
  const stage = ctx.wallShopStageRef?.current?.[weaponId];
  return typeof stage === "number" && stage > 0 ? stage : 0;
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {WallWeaponShopOffer} offer */
export function canWallWeaponResupply(ctx, offer) {
  return getWallShopStage(ctx, offer.weaponId) >= 1;
}

/** @param {WallWeaponShopOffer} offer @param {boolean} canResupply */
export function getWallShopPurchaseCost(offer, canResupply) {
  return canResupply ? offer.resupplyCost : offer.unlockCost;
}

/** @param {WallWeaponShopOffer} offer */
export function getWallShopResupplyMagLabel(offer) {
  const weaponCfg = getPrimaryWeaponConfig(offer.weaponId);
  const rounds = weaponCfg.magazineSize;
  const mags = offer.resupplyMagCount;
  return mags === 1 ? `1 mag (${rounds})` : `${mags} mags (${rounds} each)`;
}

/**
 * @typedef {{
 *   message: string,
 *   affordable: boolean,
 * }} WallWeaponShopPrompt
 */

/** @param {number} score @param {WallWeaponShopOffer} offer @param {boolean} canResupply */
export function isWallShopAffordable(score, offer, canResupply) {
  const cost = getWallShopPurchaseCost(offer, canResupply);
  return score >= cost;
}

/**
 * @param {number} score
 * @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings
 * @param {WallWeaponShopOffer} offer
 * @param {boolean} canResupply
 * @returns {WallWeaponShopPrompt}
 */
export function getWallWeaponShopPrompt(score, bindings, offer, canResupply) {
  const key = formatBindingValue(bindings.interact);
  const productLabel = getWallShopProductLabel(offer);
  const cost = getWallShopPurchaseCost(offer, canResupply);
  const affordable = score >= cost;

  if (!canResupply) {
    return {
      affordable,
      message: affordable
        ? `Press ${key} to buy ${productLabel} (${cost} pts)`
        : `${productLabel} — ${cost} pts`,
    };
  }

  const magLabel = getWallShopResupplyMagLabel(offer);
  return {
    affordable,
    message: affordable
      ? `Press ${key} — ${productLabel} ${magLabel} (${cost} pts)`
      : `${productLabel} ${magLabel} — ${cost} pts`,
  };
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {PrimaryWeaponId} weaponId */
export function isWallWeaponOwned(ctx, weaponId) {
  return getWallShopStage(ctx, weaponId) >= 1;
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {PrimaryWeaponId} weaponId */
function unlockWallShopWeapon(ctx, weaponId) {
  if (!ctx.wallShopStageRef?.current) return;
  ctx.wallShopStageRef.current[weaponId] = 1;
  if (weaponId === "rifle") {
    ctx.rifleUnlockedRef.current = true;
    ctx.setRifleUnlocked?.(true);
  }
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {PrimaryWeaponId} weaponId */
function advanceWallShopStage(ctx, weaponId) {
  if (!ctx.wallShopStageRef?.current) return;
  const stage = getWallShopStage(ctx, weaponId);
  ctx.wallShopStageRef.current[weaponId] = Math.max(1, stage) + 1;
}

/**
 * @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx
 * @param {WallWeaponShopOffer} offer
 * @param {{ repurchase: boolean }} opts
 */
export function grantWallWeaponShopAmmo(ctx, offer, { repurchase }) {
  const weaponId = offer.weaponId;
  const weaponCfg = getPrimaryWeaponConfig(weaponId);
  const store = ctx.ammoPool[weaponId];

  if (repurchase) {
    store.spare = (store.spare ?? 0) + offer.resupplyMagCount;
  } else {
    store.rounds = weaponCfg.magazineSize;
    store.spare = Math.max(0, offer.unlockMagCount - 1);
  }

  if (ctx.ammoPoolSnapshotRef?.current) {
    ctx.ammoPoolSnapshotRef.current[weaponId] = {
      rounds: store.rounds,
      spare: store.spare,
    };
  }
  ctx.scheduleGameplayHudSyncRef?.current?.();
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx @param {PrimaryWeaponId} weaponId */
function equipWallWeaponAfterPurchase(ctx, weaponId) {
  if (ctx.activePrimaryId === weaponId) {
    ctx.loadActiveAmmo?.(weaponId);
    return;
  }
  ctx.persistActiveAmmo?.();
  if (ctx.weaponSwap?.isBusy?.()) return;
  if (!ctx.primaryWeapons?.[weaponId]) return;
  const swapped = ctx.weaponSwap.requestSwap(
    weaponId,
    ctx.activePrimaryId,
    ctx.primaryWeapons,
  );
  if (!swapped) {
    ctx.setActivePrimaryWeaponView?.(weaponId);
    ctx.loadActiveAmmo?.(weaponId);
  }
}

/**
 * Equip after wall purchase — never blocks on the 35MB rifle GLB; waits until preloaded.
 *
 * @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx
 * @param {PrimaryWeaponId} weaponId
 * @param {number} now
 */
function scheduleEquipWallWeaponAfterPurchase(ctx, weaponId, now) {
  if (ctx.primaryWeapons?.[weaponId]) {
    equipWallWeaponAfterPurchase(ctx, weaponId);
    return;
  }

  ctx.pendingWallWeaponEquipRef.current = weaponId;
  pulseCenterPrompt(
    ctx.centerPromptStateRef.current,
    "Weapon loading",
    now,
  );
  ctx.refreshGameplayHintHudRef?.current?.();

  const loadPromise = ctx.ensurePrimaryWeaponLoaded?.(weaponId);
  if (!loadPromise?.then) return;

  void loadPromise.then((loaded) => {
    if (!loaded) return;
    if (ctx.pendingWallWeaponEquipRef?.current !== weaponId) return;
    ctx.pendingWallWeaponEquipRef.current = null;
    equipWallWeaponAfterPurchase(ctx, weaponId);
  });
}

/** @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx */
export function tickPendingWallWeaponEquip(ctx) {
  const weaponId = ctx.pendingWallWeaponEquipRef?.current;
  if (!weaponId) return;
  if (ctx.weaponSwap?.isBusy?.()) return;
  if (!ctx.primaryWeapons?.[weaponId]) {
    ctx.ensurePrimaryWeaponLoaded?.(weaponId);
    return;
  }
  ctx.pendingWallWeaponEquipRef.current = null;
  equipWallWeaponAfterPurchase(ctx, weaponId);
}

/**
 * @param {import("../gameLoop/gameLoopContext.js").GameLoopContext} ctx
 * @param {WallWeaponShopOffer} offer
 * @param {number} now
 */
export function tryWallWeaponShopPurchase(ctx, offer, now) {
  const canResupply = canWallWeaponResupply(ctx, offer);
  const cost = getWallShopPurchaseCost(offer, canResupply);
  const score = ctx.playerScoreRef?.current ?? 0;

  if (score < cost) {
    ctx.sounds?.playShopDenied?.();
    return false;
  }

  ctx.playerScoreRef.current = score - cost;
  ctx.updateScoreHud(ctx.scoreHudRef.current, ctx.playerScoreRef.current);

  const firstUnlock = !canResupply;
  if (firstUnlock) {
    unlockWallShopWeapon(ctx, offer.weaponId);
  } else {
    advanceWallShopStage(ctx, offer.weaponId);
  }

  grantWallWeaponShopAmmo(ctx, offer, { repurchase: canResupply });

  if (firstUnlock) {
    scheduleEquipWallWeaponAfterPurchase(ctx, offer.weaponId, now);
  } else if (ctx.activePrimaryId === offer.weaponId) {
    ctx.loadActiveAmmo?.(offer.weaponId);
  }

  ctx.rifleShopRef?.current?.syncWallPrice?.(ctx);

  ctx.sounds?.playShopPurchase?.();
  const productLabel = getWallShopProductLabel(offer);
  pulseCenterPrompt(
    ctx.centerPromptStateRef.current,
    firstUnlock
      ? `${productLabel} unlocked`
      : `+${offer.resupplyMagCount} ${productLabel} mag`,
    now,
  );
  ctx.refreshGameplayHintHudRef?.current?.();
  return true;
}
