/** Holster / draw speed for primary weapon swap (0→1 per second). */
const SWAP_HOLSTER_SPEED = 3.2;

/**
 * @typedef {'idle' | 'holstering' | 'drawing'} WeaponSwapPhase
 */

export function createWeaponSwapController() {
  /** @type {WeaponSwapPhase} */
  let phase = "idle";
  let holsterT = 0;
  /** @type {import("./PrimaryWeapons.js").PrimaryWeaponId | null} */
  let pendingId = null;

  function isBusy() {
    return phase !== "idle";
  }

  /**
   * @param {import("./PrimaryWeapons.js").PrimaryWeaponId} next
   * @param {import("./PrimaryWeapons.js").PrimaryWeaponId} current
   * @param {Record<string, { holder: import("three").Group, setHolsterAmount?: (t: number) => void } | null>} weapons
   */
  function requestSwap(next, current, weapons) {
    if (phase !== "idle" || next === current) return false;
    if (!weapons[current] || !weapons[next]) return false;
    pendingId = next;
    phase = "holstering";
    holsterT = 0;
    return true;
  }

  /**
   * @param {number} dt
   * @param {Record<string, { holder: import("three").Group, setHolsterAmount?: (t: number) => void } | null>} weapons
   * @param {() => import("./PrimaryWeapons.js").PrimaryWeaponId} getActiveId
   * @param {(id: import("./PrimaryWeapons.js").PrimaryWeaponId) => void} onSwapped
   */
  function update(dt, weapons, getActiveId, onSwapped) {
    if (phase === "idle" || !pendingId) return;

    if (phase === "holstering") {
      holsterT = Math.min(1, holsterT + dt * SWAP_HOLSTER_SPEED);
      const outgoing = weapons[getActiveId()];
      outgoing?.setHolsterAmount?.(holsterT);
      if (holsterT < 1) return;

      outgoing?.setHolsterAmount?.(0);
      outgoing.holder.visible = false;

      const incoming = weapons[pendingId];
      incoming.holder.visible = true;
      incoming.setHolsterAmount?.(1);
      onSwapped(pendingId);
      phase = "drawing";
      holsterT = 1;
      return;
    }

    if (phase === "drawing") {
      holsterT = Math.max(0, holsterT - dt * SWAP_HOLSTER_SPEED);
      weapons[pendingId]?.setHolsterAmount?.(holsterT);
      if (holsterT > 0) return;
      weapons[pendingId]?.setHolsterAmount?.(0);
      phase = "idle";
      pendingId = null;
    }
  }

  return { isBusy, requestSwap, update };
}
