import { getShootCodes } from "./KeyBindings.js";

/** @typedef {import("./KeyBindings.js").BindingAction} BindingAction */

export function createInput(canvas, getBindings) {
  const keys = new Set();
  const justPressed = new Set();
  let pointerLocked = false;
  let mouseDeltaX = 0;
  let mouseDeltaY = 0;
  let touchDeltaX = 0;
  let touchDeltaY = 0;
  let shootPressed = false;
  let shootJustPressed = false;
  let touchMode = false;
  let touchLookActive = false;
  /** @type {Set<string>} */
  const virtualDown = new Set();
  /** @type {Set<string>} */
  const virtualJustPressed = new Set();

  function shootCodes() {
    return getBindings ? getShootCodes(getBindings()) : ["Enter"];
  }

  const onKeyDown = (e) => {
    if (e.repeat) return;
    if (!keys.has(e.code)) justPressed.add(e.code);
    keys.add(e.code);
    if (shootCodes().includes(e.code)) {
      shootJustPressed = true;
      shootPressed = true;
    }
  };

  const onKeyUp = (e) => {
    keys.delete(e.code);
    if (shootCodes().includes(e.code)) shootPressed = false;
  };

  const onMouseMove = (e) => {
    if (!pointerLocked) return;
    mouseDeltaX += e.movementX;
    mouseDeltaY += e.movementY;
  };

  const onMouseDown = (e) => {
    if (e.button === 0 && pointerLocked) {
      shootJustPressed = true;
      shootPressed = true;
    }
  };

  const onMouseUp = (e) => {
    if (e.button === 0) shootPressed = false;
  };

  function resetAllInput() {
    keys.clear();
    justPressed.clear();
    shootPressed = false;
    shootJustPressed = false;
    mouseDeltaX = 0;
    mouseDeltaY = 0;
    touchDeltaX = 0;
    touchDeltaY = 0;
    virtualDown.clear();
    virtualJustPressed.clear();
    touchLookActive = false;
  }

  const onPointerLockChange = () => {
    const wasLocked = pointerLocked;
    pointerLocked = document.pointerLockElement === canvas;
    if (!wasLocked && pointerLocked) {
      shootJustPressed = false;
      shootPressed = false;
    }
    if (wasLocked && !pointerLocked && !touchMode) {
      resetAllInput();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  document.addEventListener("pointerlockchange", onPointerLockChange);

  return {
    requestPointerLock() {
      if (touchMode) return;
      canvas.requestPointerLock();
    },
    isLocked() {
      return pointerLocked;
    },
    isTouchMode() {
      return touchMode;
    },
    setTouchMode(enabled) {
      touchMode = enabled === true;
      if (touchMode && pointerLocked) {
        try {
          document.exitPointerLock();
        } catch {
          // ignore
        }
      }
    },
    /** Gameplay active: pointer lock or touch controls session. */
    isPointerActive() {
      return pointerLocked || touchMode;
    },
    isTouchLookActive() {
      return touchMode && touchLookActive;
    },
    setTouchLookActive(active) {
      touchLookActive = active === true;
    },
    addLookDelta(dx, dy) {
      touchDeltaX += dx;
      touchDeltaY += dy;
    },
    /** @param {string} action */
    setVirtualDown(action, down) {
      const on = down === true;
      if (on && !virtualDown.has(action)) virtualJustPressed.add(action);
      if (on) virtualDown.add(action);
      else virtualDown.delete(action);
    },
    /** @param {string} action */
    isVirtualDown(action) {
      return virtualDown.has(action);
    },
    /** @param {string} action */
    wasVirtualPressed(action) {
      return virtualJustPressed.has(action);
    },
    /** One-frame virtual press (e.g. interact, reload). @param {string} action */
    injectVirtualPress(action) {
      virtualJustPressed.add(action);
    },
    setShootHeld(down) {
      const on = down === true;
      if (on && !shootPressed) shootJustPressed = true;
      shootPressed = on;
    },
    isDown(code) {
      return keys.has(code);
    },
    wasPressed(code) {
      return justPressed.has(code);
    },
    consumeShoot() {
      const v = shootJustPressed;
      shootJustPressed = false;
      return v;
    },
    isShootHeld() {
      return shootPressed;
    },
    getMouseDelta() {
      const dx = mouseDeltaX + touchDeltaX;
      const dy = mouseDeltaY + touchDeltaY;
      mouseDeltaX = 0;
      mouseDeltaY = 0;
      touchDeltaX = 0;
      touchDeltaY = 0;
      return { dx, dy };
    },
    /** Drop accumulated look deltas without applying them (e.g. modal overlays). */
    discardLookDelta() {
      mouseDeltaX = 0;
      mouseDeltaY = 0;
      touchDeltaX = 0;
      touchDeltaY = 0;
    },
    /** Clear held keys / virtual buttons without exiting pointer lock. */
    clearHeldState() {
      keys.clear();
      justPressed.clear();
      shootPressed = false;
      shootJustPressed = false;
      virtualDown.clear();
      virtualJustPressed.clear();
      touchLookActive = false;
    },
    endFrame() {
      justPressed.clear();
      virtualJustPressed.clear();
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    },
  };
}
