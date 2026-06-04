import { preloadAmmoCrateAssets } from "../pickups/AmmoCrate.js";
import { getCreditsRiflePrototype } from "./CreditsRiflePreview.js";
import { preloadGrenadeAssets } from "../combat/Grenade.js";
import { preloadHpOrbAssets } from "../combat/Targets.js";
import { preloadVx27ContainerCreditsAssets } from "../vx27-container/Vx27Container.js";

let assetDataPromise = null;

/** Decode models and textures before scroll / 3D mount. */
export function preloadCreditsAssetData() {
  if (assetDataPromise) return assetDataPromise;

  assetDataPromise = Promise.all([
    getCreditsRiflePrototype(),
    preloadAmmoCrateAssets(),
    preloadVx27ContainerCreditsAssets(),
    preloadGrenadeAssets(4),
    preloadHpOrbAssets(),
  ]).catch((err) => {
    assetDataPromise = null;
    throw err;
  });

  return assetDataPromise;
}

/** Gate scroll start — asset decode only (no blocking GPU preload). */
export function preloadCreditsAssets() {
  return preloadCreditsAssetData();
}
