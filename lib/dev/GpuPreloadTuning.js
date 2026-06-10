/** @typedef {'off' | 'three' | 'full'} GpuPreloadMode */

/** @deprecated Use {@link GPU_PRELOAD_MODE_KEY} — kept for older saves. */
export const GPU_PRELOAD_ENABLED_KEY = "fps-gpu-preload-enabled";

export const GPU_PRELOAD_MODE_KEY = "fps-gpu-preload-mode";

/** @type {readonly GpuPreloadMode[]} */
export const GPU_PRELOAD_MODES = Object.freeze(["off", "three", "full"]);

export const GPU_PRELOAD_MODE_LABELS = Object.freeze({
  off: "Off — skip GPU warm-up (fastest reload)",
  three: "Three.js compile — renderer.compileAsync only",
  full: "Full preload — gameplay render path (recommended)",
});

/** @returns {GpuPreloadMode} */
export function loadGpuPreloadMode() {
  if (typeof localStorage === "undefined") return "full";
  const raw = localStorage.getItem(GPU_PRELOAD_MODE_KEY);
  if (raw === "off" || raw === "three" || raw === "full") return raw;
  if (localStorage.getItem(GPU_PRELOAD_ENABLED_KEY) === "false") return "off";
  return "full";
}

/** @param {GpuPreloadMode} mode */
export function saveGpuPreloadMode(mode) {
  if (typeof localStorage === "undefined") return;
  if (!GPU_PRELOAD_MODES.includes(mode)) return;
  localStorage.setItem(GPU_PRELOAD_MODE_KEY, mode);
  localStorage.setItem(GPU_PRELOAD_ENABLED_KEY, String(mode !== "off"));
}

/** @returns {boolean} */
export function loadGpuPreloadEnabled() {
  return loadGpuPreloadMode() !== "off";
}

/** @param {boolean} enabled */
export function saveGpuPreloadEnabled(enabled) {
  saveGpuPreloadMode(enabled ? loadGpuPreloadMode() === "off" ? "full" : loadGpuPreloadMode() : "off");
}
