/** @typedef {'full'} GpuPreloadMode */

/** @deprecated Use {@link GPU_PRELOAD_MODE_KEY} — kept for older saves. */
export const GPU_PRELOAD_ENABLED_KEY = "fps-gpu-preload-enabled";

export const GPU_PRELOAD_MODE_KEY = "fps-gpu-preload-mode";

/** @type {readonly GpuPreloadMode[]} */
export const GPU_PRELOAD_MODES = Object.freeze(["full"]);

export const GPU_PRELOAD_MODE_LABELS = Object.freeze({
  full: "Gameplay preload",
});

/** @returns {GpuPreloadMode} */
export function loadGpuPreloadMode() {
  if (typeof localStorage === "undefined") return "full";
  const raw = localStorage.getItem(GPU_PRELOAD_MODE_KEY);
  if (raw !== "full") {
    localStorage.setItem(GPU_PRELOAD_MODE_KEY, "full");
  }
  if (localStorage.getItem(GPU_PRELOAD_ENABLED_KEY) !== "true") {
    localStorage.setItem(GPU_PRELOAD_ENABLED_KEY, "true");
  }
  return "full";
}

/** @param {GpuPreloadMode} mode */
export function saveGpuPreloadMode(mode) {
  if (typeof localStorage === "undefined") return;
  if (!GPU_PRELOAD_MODES.includes(mode)) return;
  localStorage.setItem(GPU_PRELOAD_MODE_KEY, mode);
  localStorage.setItem(GPU_PRELOAD_ENABLED_KEY, "true");
}

/** @returns {boolean} */
export function loadGpuPreloadEnabled() {
  return loadGpuPreloadMode() === "full";
}

/** @param {boolean} enabled */
export function saveGpuPreloadEnabled(enabled) {
  saveGpuPreloadMode("full");
}
