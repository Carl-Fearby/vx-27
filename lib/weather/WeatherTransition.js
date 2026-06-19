/** Seconds for falling rain to ease in or wind down. */
export const WEATHER_FADE_SEC = 5;

/**
 * @param {{ rainOn?: boolean }} [initial]
 */
export function createWeatherTransitionState(initial = {}) {
  const rainOn = !!initial.rainOn;
  return {
    rainFade: rainOn ? 1 : 0,
    /** Floor wetness — follows rain enabled, not player zone. */
    rainWetFade: rainOn ? 1 : 0,
  };
}

/**
 * @param {{
 *   rainFade: number,
 *   rainWetFade?: number,
 * }} state
 * @param {number} dt
 * @param {{
 *   rainWanted: boolean,
 *   rainWetnessWanted?: boolean,
 * }} targets
 */
export function tickWeatherTransition(state, dt, targets) {
  const fadeStep = dt / WEATHER_FADE_SEC;
  const rainWetnessWanted =
    targets.rainWetnessWanted ?? targets.rainWanted;

  if (targets.rainWanted) {
    state.rainFade = Math.min(1, state.rainFade + fadeStep);
  } else {
    state.rainFade = Math.max(0, state.rainFade - fadeStep);
  }

  if (rainWetnessWanted) {
    state.rainWetFade = Math.min(1, (state.rainWetFade ?? 0) + fadeStep);
  } else {
    state.rainWetFade = Math.max(0, (state.rainWetFade ?? 0) - fadeStep);
  }
}
