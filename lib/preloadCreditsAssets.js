import { preloadAmmoCrateAssets } from "@/lib/AmmoCrate";
import { getCreditsRiflePrototype } from "@/lib/CreditsRiflePreview";
import { preloadGrenadeAssets } from "@/lib/Grenade";
import { preloadHpOrbAssets } from "@/lib/Targets";

let assetDataPromise = null;

/** Decode models and textures before scroll / 3D mount. */
export function preloadCreditsAssetData() {
  if (assetDataPromise) return assetDataPromise;

  assetDataPromise = Promise.all([
    getCreditsRiflePrototype(),
    preloadAmmoCrateAssets(),
    preloadGrenadeAssets(4),
    preloadHpOrbAssets(),
  ]).catch((err) => {
    assetDataPromise = null;
    throw err;
  });

  return assetDataPromise;
}

/** Gate scroll start — asset decode only (no blocking GPU warmup). */
export function preloadCreditsAssets() {
  return preloadCreditsAssetData();
}
