import { formatBindingValue } from "../player/KeyBindings.js";

export const GAMEPLAY_HINTS_STORAGE_KEY = "fps-gameplay-hints-enabled";

export const GAMEPLAY_HINT_SHOW_MS = 6000;
export const GAMEPLAY_HINT_RESHOW_MS = 22000;

/** @typedef {{ id: string, keyLabel: string, action: string }} GameplayHint */

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
      return { id: "flashlight", keyLabel: fKey, action: "flashlight" };
    case "dayNight-night":
      return { id: "dayNight-night", keyLabel: nKey, action: "night" };
    case "dayNight-day":
      return { id: "dayNight-day", keyLabel: nKey, action: "day" };
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
  return `Press ${hint.keyLabel} for ${gameplayHintActionLabel(hint.action)}`;
}

/** @param {GameplayHint["action"]} action */
export function gameplayHintActionLabel(action) {
  switch (action) {
    case "flashlight":
      return "toggle flashlight";
    case "night":
      return "switch to night";
    case "day":
      return "switch to day";
    default:
      return action;
  }
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
    reshowAfter: 0,
    lastIsDay: isDay,
    booted: false,
    message: null,
  };
}

/** @param {GameplayHintRuntime} state @param {string | null} message @param {number} now */
export function pulseGameplayHint(state, message, now) {
  if (!message) return;
  state.message = message;
  state.showUntil = now + GAMEPLAY_HINT_SHOW_MS;
  state.reshowAfter = now + GAMEPLAY_HINT_RESHOW_MS;
}

/** @param {GameplayHintRuntime} state */
export function clearGameplayHintPulse(state) {
  state.message = null;
  state.showUntil = 0;
}

/**
 * Brief contextual toast — only visible during an active pulse window.
 * Pulses on: enter night (F), start level at night (F). No idle "press N" in day.
 * @param {HTMLElement | null} el
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
export function tickGameplayHintDisplay(el, state, ctx) {
  const {
    now,
    loadDone,
    showHud,
    settingsOpen,
    controlsOpen,
    isDay,
    flashlightOn,
    bindings,
    dismissed,
    dayNightEnabled = true,
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
        pulseGameplayHint(
          state,
          hintMessageForId(bindings, "flashlight"),
          now,
        );
      }
    } else if (state.lastIsDay !== isDay) {
      state.lastIsDay = isDay;
      if (!isDay && !flashlightOn && !dismissed.has("flashlight")) {
        pulseGameplayHint(
          state,
          hintMessageForId(bindings, "flashlight"),
          now,
        );
      }
    } else if (
      !isDay &&
      !flashlightOn &&
      !dismissed.has("flashlight") &&
      now >= state.reshowAfter &&
      now >= state.showUntil
    ) {
      pulseGameplayHint(
        state,
        hintMessageForId(bindings, "flashlight"),
        now,
      );
    }
  }

  if (!el || !chromeVisible || !state.message || now >= state.showUntil) {
    if (state.message && now >= state.showUntil) {
      state.message = null;
    }
    updateGameplayHintElement(el, null);
    return;
  }

  updateGameplayHintElement(el, state.message);
}

/**
 * @param {HTMLElement | null} el
 * @param {string | null} message
 */
export function updateGameplayHintElement(el, message) {
  if (!el) return;
  if (!message) {
    el.classList.remove("gameplayHintVisible");
    el.textContent = "";
    el.setAttribute("aria-hidden", "true");
    el.style.opacity = "0";
    el.style.visibility = "hidden";
    return;
  }

  if (el.textContent !== message) el.textContent = message;
  el.classList.add("gameplayHintVisible");
  el.setAttribute("aria-hidden", "false");
  el.style.opacity = "1";
  el.style.visibility = "visible";
  el.style.zIndex = "200";
  el.style.display = "flex";
}
