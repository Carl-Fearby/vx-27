/** @param {import("./loadArena.js").ArenaConfig} arena */
export function isInteriorEnvironmentLevel(arena) {
  if (!arena) return false;
  const mode = arena.environment?.mode;
  return (
    arena.levelType === "corridor" ||
    arena.corridor != null ||
    mode === "interior" ||
    mode === "space"
  );
}

/** @param {import("./loadArena.js").ArenaConfig} arena */
export function shouldLoadSky(arena) {
  if (isInteriorEnvironmentLevel(arena)) {
    return arena.environment?.sky === true;
  }
  return true;
}

/** @param {import("./loadArena.js").ArenaConfig} arena */
export function shouldUseOutdoorSun(arena) {
  if (isInteriorEnvironmentLevel(arena)) {
    return arena.environment?.sun === true;
  }
  return true;
}

/** @param {import("./loadArena.js").ArenaConfig} arena */
export function shouldAutoDayNight(arena) {
  if (isInteriorEnvironmentLevel(arena)) {
    return arena.environment?.dayNight === true;
  }
  return true;
}

/** @param {import("./loadArena.js").ArenaConfig} arena */
export function getInteriorClearColor(arena) {
  const hex = arena.environment?.clearColor;
  if (typeof hex === "string" && hex.startsWith("#")) {
    return parseInt(hex.slice(1), 16);
  }
  return 0x080c14;
}

/** @param {import("./loadArena.js").ArenaConfig} arena */
export function getInteriorAmbientIntensity(arena) {
  return arena.environment?.ambientIntensity ?? 0.1;
}
