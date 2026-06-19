/** Max duration for keyboard-triggered weather (seconds). */
export const WEATHER_MAX_DURATION_SEC = 180;

/** @param {{ current: boolean }} rainEnabledRef */
export function isWeatherActive(rainEnabledRef) {
  return rainEnabledRef.current;
}

/**
 * @param {{
 *   rainEnabledRef: { current: boolean },
 *   weatherSessionRef: { current: { active: boolean, elapsed: number } },
 *   setRainEnabled: (enabled: boolean) => void,
 * }} deps
 */
export function stopWeather(deps) {
  deps.rainEnabledRef.current = false;
  deps.weatherSessionRef.current.active = false;
  deps.weatherSessionRef.current.elapsed = 0;
  deps.setRainEnabled(false);
}

/**
 * @param {Parameters<typeof stopWeather>[0]} deps
 */
export function startRandomWeather(deps) {
  deps.rainEnabledRef.current = true;
  deps.weatherSessionRef.current.active = true;
  deps.weatherSessionRef.current.elapsed = 0;
  deps.setRainEnabled(true);
}

/**
 * @param {Parameters<typeof stopWeather>[0]} deps
 * @param {{ forceOff?: boolean }} [opts]
 */
export function toggleWeather(deps, opts = {}) {
  if (opts.forceOff) {
    if (isWeatherActive(deps.rainEnabledRef)) {
      stopWeather(deps);
    }
    return;
  }
  if (isWeatherActive(deps.rainEnabledRef)) {
    stopWeather(deps);
  } else {
    startRandomWeather(deps);
  }
}

/**
 * @param {{ current: { active: boolean, elapsed: number } }} weatherSessionRef
 * @param {number} dt
 * @param {() => void} onExpired
 */
export function tickWeatherSession(weatherSessionRef, dt, onExpired) {
  const session = weatherSessionRef.current;
  if (!session.active) return;
  session.elapsed += dt;
  if (session.elapsed >= WEATHER_MAX_DURATION_SEC) {
    onExpired();
  }
}
