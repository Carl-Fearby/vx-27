"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  joystickToMoveActions,
  joystickVectorFromDelta,
} from "@/lib/player/VirtualJoystick.js";

const STICK_RADIUS = 58;
const TOUCH_LOOK_SCALE = 1.35;

/**
 * On-screen twin-stick + action buttons for iPad / touch browsers.
 * @param {{ active?: boolean, inputRef: import("react").RefObject<import("@/lib/player/Input.js").ReturnType<typeof import("@/lib/player/Input.js").createInput> | null>, showInteract?: boolean }} props
 */
export default function TouchControls({ active = false, inputRef, showInteract = false }) {
  const moveRef = useRef(null);
  const lookRef = useRef(null);
  const movePointerId = useRef(null);
  const lookPointerId = useRef(null);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const lookLast = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0, visible: false });

  const input = () => inputRef.current;

  const applyMoveVector = useCallback((vec) => {
    const inp = input();
    if (!inp) return;
    const m = joystickToMoveActions(vec);
    inp.setVirtualDown("forward", m.forward);
    inp.setVirtualDown("backward", m.backward);
    inp.setVirtualDown("strafeLeft", m.strafeLeft);
    inp.setVirtualDown("strafeRight", m.strafeRight);
  }, [inputRef]);

  const resetMove = useCallback(() => {
    movePointerId.current = null;
    setKnob({ x: 0, y: 0, visible: false });
    applyMoveVector({ x: 0, y: 0 });
  }, [applyMoveVector]);

  const setHeld = useCallback(
    (action, down) => {
      input()?.setVirtualDown(action, down);
    },
    [inputRef],
  );

  useEffect(() => {
    if (!active) {
      resetMove();
      const inp = input();
      inp?.setTouchLookActive(false);
      [
        "forward",
        "backward",
        "strafeLeft",
        "strafeRight",
        "jump",
        "sprint",
        "crouch",
        "aim",
        "grenade",
      ].forEach((a) => inp?.setVirtualDown(a, false));
      inp?.setShootHeld(false);
    }
  }, [active, resetMove, inputRef]);

  useEffect(() => {
    const moveEl = moveRef.current;
    const lookEl = lookRef.current;
    if (!active || !moveEl || !lookEl) return undefined;

    const onMoveDown = (e) => {
      if (movePointerId.current !== null) return;
      e.preventDefault();
      movePointerId.current = e.pointerId;
      moveEl.setPointerCapture(e.pointerId);
      const rect = moveEl.getBoundingClientRect();
      moveOrigin.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      setKnob({ x: 0, y: 0, visible: true });
    };

    const onMoveMove = (e) => {
      if (e.pointerId !== movePointerId.current) return;
      e.preventDefault();
      const dx = e.clientX - moveOrigin.current.x;
      const dy = e.clientY - moveOrigin.current.y;
      const vec = joystickVectorFromDelta(dx, dy, STICK_RADIUS);
      setKnob({ x: vec.x * STICK_RADIUS, y: -vec.y * STICK_RADIUS, visible: true });
      applyMoveVector(vec);
    };

    const onMoveUp = (e) => {
      if (e.pointerId !== movePointerId.current) return;
      e.preventDefault();
      try {
        moveEl.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      resetMove();
    };

    const onLookDown = (e) => {
      if (lookPointerId.current !== null) return;
      e.preventDefault();
      lookPointerId.current = e.pointerId;
      lookEl.setPointerCapture(e.pointerId);
      lookLast.current = { x: e.clientX, y: e.clientY };
      input()?.setTouchLookActive(true);
    };

    const onLookMove = (e) => {
      if (e.pointerId !== lookPointerId.current) return;
      e.preventDefault();
      const dx = (e.clientX - lookLast.current.x) * TOUCH_LOOK_SCALE;
      const dy = (e.clientY - lookLast.current.y) * TOUCH_LOOK_SCALE;
      lookLast.current = { x: e.clientX, y: e.clientY };
      input()?.addLookDelta(dx, dy);
    };

    const onLookUp = (e) => {
      if (e.pointerId !== lookPointerId.current) return;
      e.preventDefault();
      try {
        lookEl.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      lookPointerId.current = null;
      input()?.setTouchLookActive(false);
    };

    moveEl.addEventListener("pointerdown", onMoveDown);
    moveEl.addEventListener("pointermove", onMoveMove);
    moveEl.addEventListener("pointerup", onMoveUp);
    moveEl.addEventListener("pointercancel", onMoveUp);
    lookEl.addEventListener("pointerdown", onLookDown);
    lookEl.addEventListener("pointermove", onLookMove);
    lookEl.addEventListener("pointerup", onLookUp);
    lookEl.addEventListener("pointercancel", onLookUp);

    return () => {
      moveEl.removeEventListener("pointerdown", onMoveDown);
      moveEl.removeEventListener("pointermove", onMoveMove);
      moveEl.removeEventListener("pointerup", onMoveUp);
      moveEl.removeEventListener("pointercancel", onMoveUp);
      lookEl.removeEventListener("pointerdown", onLookDown);
      lookEl.removeEventListener("pointermove", onLookMove);
      lookEl.removeEventListener("pointerup", onLookUp);
      lookEl.removeEventListener("pointercancel", onLookUp);
    };
  }, [active, applyMoveVector, resetMove, inputRef]);

  if (!active) return null;

  return (
    <div className="touchControls" aria-hidden="true">
      <div ref={lookRef} className="touchLookZone" />
      <div ref={moveRef} className="touchMoveZone">
        <div className="touchStickBase">
          <div
            className={`touchStickKnob${knob.visible ? " touchStickKnob--active" : ""}`}
            style={{
              transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
            }}
          />
        </div>
      </div>
      <div className="touchActionCluster">
        <button
          type="button"
          className="touchBtn touchBtn--jump"
          aria-label="Jump"
          onPointerDown={(e) => {
            e.preventDefault();
            setHeld("jump", true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            setHeld("jump", false);
          }}
          onPointerLeave={(e) => {
            if (e.buttons === 0) setHeld("jump", false);
          }}
        >
          JMP
        </button>
        <button
          type="button"
          className="touchBtn touchBtn--aim"
          aria-label="Aim"
          onPointerDown={(e) => {
            e.preventDefault();
            setHeld("aim", true);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            setHeld("aim", false);
          }}
          onPointerLeave={(e) => {
            if (e.buttons === 0) setHeld("aim", false);
          }}
        >
          AIM
        </button>
        {showInteract ? (
          <button
            type="button"
            className="touchBtn touchBtn--interact touchBtn--interactVisible"
            aria-label="Use"
            onPointerDown={(e) => {
              e.preventDefault();
              input()?.injectVirtualPress("interact");
            }}
          >
            USE
          </button>
        ) : (
          <button
            type="button"
            className="touchBtn touchBtn--reload"
            aria-label="Reload"
            onPointerDown={(e) => {
              e.preventDefault();
              input()?.injectVirtualPress("reload");
            }}
          >
            RLD
          </button>
        )}
      </div>
      <button
        type="button"
        className="touchBtn touchBtn--fire"
        aria-label="Fire"
        onPointerDown={(e) => {
          e.preventDefault();
          input()?.setShootHeld(true);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          input()?.setShootHeld(false);
        }}
        onPointerLeave={(e) => {
          if (e.buttons === 0) input()?.setShootHeld(false);
        }}
      >
        FIRE
      </button>
    </div>
  );
}
