import { DEFAULT_LEVEL } from "./level/loadArena.js";

export const SELECTED_LEVEL_STORAGE_KEY = "fps-selected-level";

/** Playable level numbers with a JSON file under public/levels/. */
export const AVAILABLE_LEVELS = [1, 2];

/** Labels for loading-screen level picker (match level JSON meta.name). */
export const LEVEL_SELECT_OPTIONS = [
  { number: 1, label: "Square Arena" },
  { number: 2, label: "VX-27 Passage" },
];

/** @param {number} levelNumber */
export function isPlayableLevel(levelNumber) {
  return AVAILABLE_LEVELS.includes(levelNumber);
}

/** @returns {number} */
export function loadSelectedLevel() {
  if (typeof window === "undefined") return DEFAULT_LEVEL;
  const raw = localStorage.getItem(SELECTED_LEVEL_STORAGE_KEY);
  const parsed = parseInt(raw ?? "", 10);
  return isPlayableLevel(parsed) ? parsed : DEFAULT_LEVEL;
}

/** @param {number} levelNumber */
export function saveSelectedLevel(levelNumber) {
  if (!isPlayableLevel(levelNumber)) return;
  localStorage.setItem(SELECTED_LEVEL_STORAGE_KEY, String(levelNumber));
}

/** URL `?level=2` overrides stored selection for this session load. */
export function resolvePlayLevelNumber() {
  if (typeof window === "undefined") return DEFAULT_LEVEL;
  const fromUrl = parseInt(
    new URLSearchParams(window.location.search).get("level") ?? "",
    10
  );
  if (isPlayableLevel(fromUrl)) return fromUrl;
  return loadSelectedLevel();
}
