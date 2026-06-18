/** Seconds for falling rain/snow to ease in or wind down. */
export const WEATHER_FADE_SEC = 5;
/** Seconds for settled snow to melt away after snow stops. */
export const SNOW_MELT_SEC = 14;

/**
 * @param {{ rainOn?: boolean, snowOn?: boolean }} [initial]
 */
export function createWeatherTransitionState(initial = {}) {
  return {
    rainFade: initial.rainOn ? 1 : 0,
    snowFade: initial.snowOn ? 1 : 0,
    snowMelt: initial.snowOn ? 1 : 0,
  };
}

/**
 * @param {{
 *   rainFade: number,
 *   snowFade: number,
 *   snowMelt: number,
 * }} state
 * @param {number} dt
 * @param {{
 *   rainWanted: boolean,
 *   snowWanted: boolean,
 *   hasSettledSnow: boolean,
 * }} targets
 */
export function tickWeatherTransition(state, dt, targets) {
  const fadeStep = dt / WEATHER_FADE_SEC;
  const meltStep = dt / SNOW_MELT_SEC;

  if (targets.rainWanted) {
    state.rainFade = Math.min(1, state.rainFade + fadeStep);
  } else {
    state.rainFade = Math.max(0, state.rainFade - fadeStep);
  }

  if (targets.snowWanted) {
    state.snowFade = Math.min(1, state.snowFade + fadeStep);
    state.snowMelt = Math.min(1, state.snowMelt + fadeStep * 1.4);
  } else {
    state.snowFade = Math.max(0, state.snowFade - fadeStep);
    if (targets.hasSettledSnow || state.snowMelt > 0.008 || state.snowFade > 0.008) {
      state.snowMelt = Math.max(0, state.snowMelt - meltStep);
    }
  }
}
