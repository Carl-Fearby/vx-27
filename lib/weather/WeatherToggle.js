/** Max duration for keyboard-triggered weather (seconds). */
export const WEATHER_MAX_DURATION_SEC = 180;

const WEATHER_TYPES = ["rain", "snow"];

export function pickRandomWeatherType() {
  return WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
}

/** @param {{ current: boolean }} rainEnabledRef @param {{ current: boolean }} snowEnabledRef */
export function isWeatherActive(rainEnabledRef, snowEnabledRef) {
  return rainEnabledRef.current || snowEnabledRef.current;
}

/**
 * @param {{
 *   rainEnabledRef: { current: boolean },
 *   snowEnabledRef: { current: boolean },
 *   weatherSessionRef: { current: { active: boolean, elapsed: number } },
 *   setRainEnabled: (enabled: boolean) => void,
 *   setSnowEnabled: (enabled: boolean) => void,
 * }} deps
 */
export function stopWeather(deps) {
  deps.rainEnabledRef.current = false;
  deps.snowEnabledRef.current = false;
  deps.weatherSessionRef.current.active = false;
  deps.weatherSessionRef.current.elapsed = 0;
  deps.setRainEnabled(false);
  deps.setSnowEnabled(false);
}

/**
 * @param {Parameters<typeof stopWeather>[0]} deps
 */
export function startRandomWeather(deps) {
  deps.rainEnabledRef.current = false;
  deps.snowEnabledRef.current = false;
  deps.setRainEnabled(false);
  deps.setSnowEnabled(false);

  const type = pickRandomWeatherType();
  deps.weatherSessionRef.current.active = true;
  deps.weatherSessionRef.current.elapsed = 0;
  if (type === "rain") {
    deps.rainEnabledRef.current = true;
    deps.setRainEnabled(true);
  } else {
    deps.snowEnabledRef.current = true;
    deps.setSnowEnabled(true);
  }
}

/**
 * @param {Parameters<typeof stopWeather>[0]} deps
 * @param {{ forceOff?: boolean }} [opts]
 */
export function toggleWeather(deps, opts = {}) {
  if (opts.forceOff) {
    if (isWeatherActive(deps.rainEnabledRef, deps.snowEnabledRef)) {
      stopWeather(deps);
    }
    return;
  }
  if (isWeatherActive(deps.rainEnabledRef, deps.snowEnabledRef)) {
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
