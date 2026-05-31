import * as THREE from "three";

/** Southward catwalk cap beyond the room mouth (north attach). */
export const ROOM_CATWALK_MOUTH_PAD_DEFAULT = 0.12;
export const ROOM_CATWALK_MOUTH_PAD_MIN = 0;
export const ROOM_CATWALK_MOUTH_PAD_MAX = 3;
export const ROOM_CATWALK_MOUTH_PAD_STEP = 0.01;
export const ROOM_CATWALK_MOUTH_PAD_KEY = "fps-room-catwalk-mouth-pad";
export const CATWALK_TUNE_ENABLED_KEY = "fps-catwalk-tune-enabled";

function readStored(key, fallback, min, max) {
  if (typeof window === "undefined") return fallback;
  const v = parseFloat(localStorage.getItem(key));
  if (Number.isNaN(v)) return fallback;
  return THREE.MathUtils.clamp(v, min, max);
}

export function loadRoomCatwalkMouthPad() {
  return readStored(
    ROOM_CATWALK_MOUTH_PAD_KEY,
    ROOM_CATWALK_MOUTH_PAD_DEFAULT,
    ROOM_CATWALK_MOUTH_PAD_MIN,
    ROOM_CATWALK_MOUTH_PAD_MAX
  );
}

export function saveRoomCatwalkMouthPad(value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    ROOM_CATWALK_MOUTH_PAD_KEY,
    String(
      THREE.MathUtils.clamp(
        value,
        ROOM_CATWALK_MOUTH_PAD_MIN,
        ROOM_CATWALK_MOUTH_PAD_MAX
      )
    )
  );
}
