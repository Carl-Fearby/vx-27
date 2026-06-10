import { formatBindingValue } from "../player/KeyBindings.js";
import {
  CENTER_PROMPT_SHOW_MS,
  CENTER_PROMPT_FADE_MS,
  clearCenterPromptPulse,
  pulseCenterPrompt,
} from "./CenterInteractPrompt.js";

export const GAMEPLAY_HINTS_STORAGE_KEY = "fps-gameplay-hints-enabled";

export const GAMEPLAY_HINT_SHOW_MS = CENTER_PROMPT_SHOW_MS;
export const GAMEPLAY_HINT_FLASHLIGHT_SHOW_MS = CENTER_PROMPT_SHOW_MS;
export const GAMEPLAY_HINT_FADE_MS = CENTER_PROMPT_FADE_MS;
export const GAMEPLAY_HINT_RESHOW_MS = 22000;

/** @typedef {{ id: string, keyLabel: string, text: string }} GameplayHint */

/** @returns {boolean} */
export function loadGameplayHintsEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(GAMEPLAY_HINTS_STORAGE_KEY) !== "false";
}

/** @param {boolean} enabled */
export function saveGameplayHintsEnabled(enabled) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GAMEPLAY_HINTS_STORAGE_KEY, String(enabled));
}

/** @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings @param {string} id */
export function buildGameplayHint(bindings, id) {
  const nKey = formatBindingValue(bindings.dayNightToggle);
  const fKey = formatBindingValue(bindings.flashlight);
  switch (id) {
    case "flashlight":
      return { id: "flashlight", keyLabel: fKey, text: "to toggle flashlight" };
    case "dayNight-night":
      return { id: "dayNight-night", keyLabel: nKey, text: "for switch to night" };
    case "dayNight-day":
      return { id: "dayNight-day", keyLabel: nKey, text: "for switch to day" };
    default:
      return null;
  }
}

/** @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings @param {string} id */
export function hintMessageForId(bindings, id) {
  const hint = buildGameplayHint(bindings, id);
  if (!hint) return null;
  return formatGameplayHintMessage(hint);
}

/** @param {GameplayHint} hint */
export function formatGameplayHintMessage(hint) {
  return `Press ${hint.keyLabel} ${hint.text}`;
}

/** @param {string} hintId */
export function dismissGameplayHint(dismissed, hintId) {
  dismissed.add(hintId);
  if (hintId === "dayNight-night" || hintId === "dayNight-day") {
    dismissed.delete(hintId === "dayNight-night" ? "dayNight-day" : "dayNight-night");
  }
}

/**
 * @typedef {{
 *   showUntil: number,
 *   fadeEnd: number,
 *   reshowAfter: number,
 *   lastIsDay: boolean,
 *   booted: boolean,
 *   message: string | null,
 * }} GameplayHintRuntime
 */

/** @returns {GameplayHintRuntime} */
export function createGameplayHintRuntime(isDay = true) {
  return {
    showUntil: 0,
    fadeEnd: 0,
    reshowAfter: 0,
    lastIsDay: isDay,
    booted: false,
    message: null,
  };
}

/**
 * @param {import("./CenterInteractPrompt.js").CenterPromptState} centerPromptState
 * @param {import("./CenterInteractPrompt.js").CenterPromptContent | string | null} content
 * @param {number} now
 * @param {{ showMs?: number, fadeMs?: number }} [opts]
 */
export function pulseGameplayHint(centerPromptState, message, now, opts = {}) {
  if (!message) return;
  pulseCenterPrompt(centerPromptState, message, now, opts);
}

/** @param {import("./CenterInteractPrompt.js").CenterPromptState} centerPromptState @param {import("../player/KeyBindings.js").KeyBindingsMap} bindings @param {number} now */
export function pulseFlashlightGameplayHint(centerPromptState, bindings, now) {
  const message = hintMessageForId(bindings, "flashlight");
  if (!message) return;
  pulseGameplayHint(centerPromptState, message, now, {
    showMs: GAMEPLAY_HINT_FLASHLIGHT_SHOW_MS,
  });
}

/** @param {import("./CenterInteractPrompt.js").CenterPromptState} centerPromptState */
export function clearGameplayHintPulse(centerPromptState) {
  clearCenterPromptPulse(centerPromptState);
}

/**
 * Brief contextual toast — only visible during an active pulse window.
 * Pulses on: enter night (F), start level at night (F). No idle "press N" in day.
 * @param {import("./CenterInteractPrompt.js").CenterPromptState} centerPromptState
 * @param {GameplayHintRuntime} state
 * @param {{
 *   now: number,
 *   loadDone: boolean,
 *   showHud: boolean,
 *   settingsOpen: boolean,
 *   controlsOpen: boolean,
 *   isDay: boolean,
 *   flashlightOn: boolean,
 *   bindings: import("../player/KeyBindings.js").KeyBindingsMap,
 *   dismissed: Set<string>,
 *   dayNightEnabled?: boolean,
 * }} ctx
 */
export function tickGameplayHintDisplay(centerPromptState, state, ctx) {
  const {
    loadDone,
    showHud,
    settingsOpen,
    controlsOpen,
    isDay,
    flashlightOn,
    bindings,
    dismissed,
    dayNightEnabled = true,
    now,
  } = ctx;

  const chromeVisible =
    loadDone &&
    showHud &&
    !settingsOpen &&
    !controlsOpen &&
    dayNightEnabled &&
    loadGameplayHintsEnabled();

  if (chromeVisible) {
    if (!state.booted) {
      state.booted = true;
      state.lastIsDay = isDay;
      if (!isDay && !flashlightOn && !dismissed.has("flashlight")) {
        pulseFlashlightGameplayHint(centerPromptState, bindings, now);
        state.reshowAfter = now + GAMEPLAY_HINT_RESHOW_MS;
      }
    } else if (state.lastIsDay !== isDay) {
      state.lastIsDay = isDay;
      if (!isDay && !flashlightOn && !dismissed.has("flashlight")) {
        pulseFlashlightGameplayHint(centerPromptState, bindings, now);
        state.reshowAfter = now + GAMEPLAY_HINT_RESHOW_MS;
      }
    } else if (
      !isDay &&
      !flashlightOn &&
      !dismissed.has("flashlight") &&
      now >= state.reshowAfter &&
      (!centerPromptState.pulse || now >= centerPromptState.pulse.fadeEnd)
    ) {
      pulseFlashlightGameplayHint(centerPromptState, bindings, now);
      state.reshowAfter = now + GAMEPLAY_HINT_RESHOW_MS;
    }
  }
}
