import { preloadAmmoCrateAssets } from "@/lib/AmmoCrate";
import { getCreditsRiflePrototype } from "@/lib/CreditsRiflePreview";
import { preloadGrenadeAssets } from "@/lib/Grenade";
import { preloadHpOrbAssets } from "@/lib/Targets";
import { preloadVx27ContainerCreditsAssets } from "@/lib/Vx27Container";

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

/** Gate scroll start — asset decode only (no blocking GPU warmup). */
export function preloadCreditsAssets() {
  return preloadCreditsAssetData();
}
