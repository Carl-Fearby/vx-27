export const VX27_CONTAINER_CEILING_LIGHT_KEY = "fps-vx27-container-ceiling-light";

/** @returns {boolean} */
export function loadVx27ContainerCeilingLightEnabled() {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(VX27_CONTAINER_CEILING_LIGHT_KEY);
  if (raw === null) return true;
  return raw === "true";
}

/** @param {boolean} enabled */
export function saveVx27ContainerCeilingLightEnabled(enabled) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VX27_CONTAINER_CEILING_LIGHT_KEY, String(enabled));
}
