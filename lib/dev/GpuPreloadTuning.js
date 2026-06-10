/** Skip load-screen GPU preload for faster dev reloads (Settings or loading screen). */
export const GPU_PRELOAD_ENABLED_KEY = "fps-gpu-preload-enabled";

/** @returns {boolean} */
export function loadGpuPreloadEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(GPU_PRELOAD_ENABLED_KEY) !== "false";
}

/** @param {boolean} enabled */
export function saveGpuPreloadEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GPU_PRELOAD_ENABLED_KEY, String(enabled));
}
