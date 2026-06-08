"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import pickupPreviewEngine from "@/lib/pickups/PickupPreviewEngine";

const PICKUP_DISPLAY_MS = 4000;
const PICKUP_FADE_MS = 550;

function getPickupLabel(type) {
  if (type === "ammo") return "10 Ammo Rounds";
  if (type === "grenade") return "+1 Grenade";
  if (type === "score") return "Score Bonus";
  return "10 Hit Points";
}

function PickupOverlay({ type, label, flashId, onRemove }) {
  const containerRef = useRef(null);
  const onRemoveRef = useRef(onRemove);
  const [phase, setPhase] = useState("enter");
  const [gone, setGone] = useState(false);
  const textOnly = type === "text";
  const webglPreview = !textOnly;
  const displayLabel = label ?? getPickupLabel(type);

  onRemoveRef.current = onRemove;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setPhase("visible"));
    const hideTimer = setTimeout(() => setPhase("exit"), PICKUP_DISPLAY_MS);
    const removeTimer = setTimeout(() => {
      setGone(true);
      onRemoveRef.current(flashId);
    }, PICKUP_DISPLAY_MS + PICKUP_FADE_MS);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [flashId]);

  useEffect(() => {
    if (!webglPreview) return undefined;
    const el = containerRef.current;
    if (!el) return undefined;

    const canvas = document.createElement("canvas");
    el.appendChild(canvas);
    pickupPreviewEngine.add(flashId, type, canvas);

    return () => {
      pickupPreviewEngine.remove(flashId);
      canvas.remove();
    };
  }, [flashId, type, webglPreview]);

  if (gone) return null;

  return (
    <div
      className={[
        "pickupOverlayCard",
        `pickupOverlayCard--${phase}`,
        textOnly ? "pickupOverlayCard--textOnly" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <div className="pickupOverlay3DLabel">{displayLabel}</div>
      {webglPreview ? <div ref={containerRef} className="pickupOverlay3DCanvas" /> : null}
    </div>
  );
}

const PickupFlashLayer = forwardRef(function PickupFlashLayer(_props, ref) {
  const [flashes, setFlashes] = useState([]);
  const idRef = useRef(0);

  const removeFlash = useCallback((flashId) => {
    setFlashes((prev) => prev.filter((p) => p.id !== flashId));
  }, []);

  useImperativeHandle(ref, () => ({
    /** @param {string | { type: string, label?: string }} spec */
    show(spec) {
      const entry = typeof spec === "string" ? { type: spec } : spec;
      requestAnimationFrame(() => {
        const id = ++idRef.current;
        setFlashes((prev) => [
          ...prev,
          { id, type: entry.type, label: entry.label },
        ]);
      });
    },
  }));

  if (flashes.length === 0) return null;

  const row = (
    <div
      className={`pickupOverlayRow${
        flashes.length === 1 ? " pickupOverlayRow--single" : " pickupOverlayRow--multi"
      }`}
      aria-hidden="true"
    >
      {flashes.map((flash) => (
        <PickupOverlay
          key={flash.id}
          flashId={flash.id}
          type={flash.type}
          label={flash.label}
          onRemove={removeFlash}
        />
      ))}
    </div>
  );

  if (typeof document === "undefined") return row;
  return createPortal(row, document.body);
});

export default PickupFlashLayer;
