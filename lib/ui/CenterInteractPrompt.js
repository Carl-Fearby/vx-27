/** Shared center-screen interact / hint prompt (door, hack, cooldowns, …). */

export const CENTER_PROMPT_SHOW_MS = 2000;
export const CENTER_PROMPT_FADE_MS = 2000;

/** @typedef {string} CenterPromptMessage */

/** @typedef {'default' | 'unaffordable'} CenterPromptTone */

/**
 * @typedef {{
 *   persistent: CenterPromptMessage | null,
 *   persistentTone: CenterPromptTone,
 *   pulse: {
 *     message: CenterPromptMessage,
 *     showUntil: number,
 *     fadeEnd: number,
 *   } | null,
 * }} CenterPromptState
 */

/** @returns {CenterPromptState} */
export function createCenterPromptState() {
  return { persistent: null, persistentTone: "default", pulse: null };
}

/**
 * @param {CenterPromptState} state
 * @param {CenterPromptMessage | null} message
 * @param {{ tone?: CenterPromptTone }} [opts]
 */
export function setCenterPromptPersistent(state, message, opts = {}) {
  state.persistent = message;
  state.persistentTone = message ? (opts.tone ?? "default") : "default";
}

/** @param {CenterPromptState} state */
export function clearCenterPromptPersistent(state) {
  state.persistent = null;
  state.persistentTone = "default";
}

/**
 * @param {CenterPromptState} state
 * @param {CenterPromptMessage} message
 * @param {number} now
 * @param {{ showMs?: number, fadeMs?: number }} [opts]
 */
export function pulseCenterPrompt(state, message, now, opts = {}) {
  const showMs = opts.showMs ?? CENTER_PROMPT_SHOW_MS;
  const fadeMs = opts.fadeMs ?? CENTER_PROMPT_FADE_MS;
  state.pulse = {
    message,
    showUntil: now + showMs,
    fadeEnd: now + showMs + fadeMs,
  };
}

/** @param {CenterPromptState} state */
export function clearCenterPromptPulse(state) {
  state.pulse = null;
}

/** @param {HTMLElement | null} el */
function hideCenterPrompt(el) {
  if (!el) return;
  el.classList.remove("centerInteractPromptVisible");
  el.classList.remove("centerInteractPromptUnaffordable");
  el.textContent = "";
  el.setAttribute("aria-hidden", "true");
  el.style.opacity = "0";
  el.style.visibility = "hidden";
}

/**
 * @param {HTMLElement | null} el
 * @param {CenterPromptMessage} message
 * @param {number} opacity
 */
/**
 * @param {HTMLElement | null} el
 * @param {CenterPromptMessage} message
 * @param {number} opacity
 * @param {CenterPromptTone} [tone]
 */
function showCenterPrompt(el, message, opacity, tone = "default") {
  if (!el) return;
  if (el.textContent !== message) el.textContent = message;
  el.classList.toggle("centerInteractPromptUnaffordable", tone === "unaffordable");
  el.classList.add("centerInteractPromptVisible");
  el.setAttribute("aria-hidden", "false");
  el.style.visibility = "visible";
  el.style.opacity = String(opacity);
}

/**
 * @param {HTMLElement | null} el
 * @param {CenterPromptState} state
 * @param {number} now
 * @param {{
 *   pulseVisible?: boolean,
 *   persistentVisible?: boolean,
 * } | boolean} [visibility]
 */
export function tickCenterInteractPrompt(el, state, now, visibility = true) {
  const opts =
    typeof visibility === "boolean"
      ? { pulseVisible: visibility, persistentVisible: visibility }
      : {
          pulseVisible: visibility.pulseVisible !== false,
          persistentVisible: visibility.persistentVisible !== false,
        };

  if (!el) return;

  if (state.persistent && opts.persistentVisible) {
    showCenterPrompt(el, state.persistent, 1, state.persistentTone);
    return;
  }

  if (!opts.pulseVisible) {
    hideCenterPrompt(el);
    return;
  }

  const pulse = state.pulse;
  if (!pulse || now >= pulse.fadeEnd) {
    if (pulse && now >= pulse.fadeEnd) state.pulse = null;
    hideCenterPrompt(el);
    return;
  }

  const fadeMs = Math.max(1, pulse.fadeEnd - pulse.showUntil);
  const opacity =
    now < pulse.showUntil
      ? 1
      : Math.max(0, 1 - (now - pulse.showUntil) / fadeMs);
  showCenterPrompt(el, pulse.message, opacity);
}
