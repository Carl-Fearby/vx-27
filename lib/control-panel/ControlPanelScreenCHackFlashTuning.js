/** Surface C hack flash — per-outcome brightness (green success / red failure). */

export const CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS_KEY =
  "fps-control-panel-screen-green-brightness";
export const CONTROL_PANEL_SCREEN_RED_BRIGHTNESS_KEY =
  "fps-control-panel-screen-red-brightness";
export const CONTROL_PANEL_SCREEN_HACK_FLASH_TUNE_ENABLED_KEY =
  "fps-control-panel-screen-hack-flash-tune-enabled";

export const CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS = 34;
export const CONTROL_PANEL_SCREEN_RED_BRIGHTNESS = 30.5;
export const CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MIN = 5;
export const CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MAX = 50;

function clampBrightness(value, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(
    CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MAX,
    Math.max(CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MIN, v)
  );
}

export function loadControlPanelScreenGreenBrightness() {
  if (typeof localStorage === "undefined") {
    return CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS;
  }
  return clampBrightness(
    localStorage.getItem(CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS_KEY),
    CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS
  );
}

export function loadControlPanelScreenRedBrightness() {
  if (typeof localStorage === "undefined") {
    return CONTROL_PANEL_SCREEN_RED_BRIGHTNESS;
  }
  return clampBrightness(
    localStorage.getItem(CONTROL_PANEL_SCREEN_RED_BRIGHTNESS_KEY),
    CONTROL_PANEL_SCREEN_RED_BRIGHTNESS
  );
}

/** @param {'green' | 'red'} outcome */
export function loadControlPanelScreenHackFlashBrightness(outcome) {
  return outcome === "green"
    ? loadControlPanelScreenGreenBrightness()
    : loadControlPanelScreenRedBrightness();
}

export function saveControlPanelScreenGreenBrightness(value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS_KEY,
    String(clampBrightness(value, CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS))
  );
}

export function saveControlPanelScreenRedBrightness(value) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    CONTROL_PANEL_SCREEN_RED_BRIGHTNESS_KEY,
    String(clampBrightness(value, CONTROL_PANEL_SCREEN_RED_BRIGHTNESS))
  );
}

export function loadControlPanelScreenHackFlashTuneEnabled() {
  if (typeof localStorage === "undefined") return false;
  return (
    localStorage.getItem(CONTROL_PANEL_SCREEN_HACK_FLASH_TUNE_ENABLED_KEY) ===
    "true"
  );
}

export function saveControlPanelScreenHackFlashTuneEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    CONTROL_PANEL_SCREEN_HACK_FLASH_TUNE_ENABLED_KEY,
    String(!!enabled)
  );
}
