"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mountCreditsEnemyPreview } from "@/lib/credits/CreditsEnemyPreview";
import {
  creditsPreviewPriorityFromHost,
  useCreditsLazy3d,
} from "@/lib/credits/useCreditsLazy3d";

function useEnemyPreviewMount(canvasRef, { variant, getPriority, enabled }) {
  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let mountedController = null;

    mountCreditsEnemyPreview(canvas, { variant, getPriority })
      .then((controller) => {
        if (!controller || cancelled) {
          controller?.dispose();
          return;
        }
        mountedController = controller;
        controller.setActive(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      mountedController?.dispose();
    };
  }, [canvasRef, variant, getPriority, enabled]);
}

export default function MarketingEnemyPreview({ className = "", expandable = true }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inlineCanvasRef = useRef(null);
  const lightboxCanvasRef = useRef(null);
  const closeBtnRef = useRef(null);
  const { hostRef, shouldRun, everVisible } = useCreditsLazy3d();

  const getInlinePriority = useCallback(
    () => creditsPreviewPriorityFromHost(hostRef.current),
    [],
  );
  const getLightboxPriority = useCallback(() => -1, []);

  const inlineEnabled = everVisible && shouldRun && !lightboxOpen;
  useEnemyPreviewMount(inlineCanvasRef, {
    variant: "marketing",
    getPriority: getInlinePriority,
    enabled: inlineEnabled,
  });
  useEnemyPreviewMount(lightboxCanvasRef, {
    variant: "lightbox",
    getPriority: getLightboxPriority,
    enabled: lightboxOpen,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen]);

  const openLightbox = () => {
    if (!expandable) return;
    setLightboxOpen(true);
  };

  const preview = (
    <div className={`mktEnemyPreviewWrap${className ? ` ${className}` : ""}`}>
      {expandable ? (
        <button
          type="button"
          className="mktEnemyPreviewOpen"
          onClick={openLightbox}
          aria-label="Open PX-27 combat android preview"
        >
          <span className="mktEnemyPreviewHint">Click to inspect</span>
        </button>
      ) : null}
      <div
        ref={hostRef}
        className={`mktEnemyPreview${expandable ? " mktEnemyPreview--expandable" : ""}`}
      >
        <canvas ref={inlineCanvasRef} className="mktEnemyPreviewCanvas" />
      </div>
    </div>
  );

  const lightbox =
    lightboxOpen && mounted
      ? createPortal(
          <div
            className="mktEnemyLightbox"
            role="dialog"
            aria-modal="true"
            aria-label="PX-27 Combat Android"
          >
            <button
              type="button"
              className="mktEnemyLightboxBackdrop"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close preview"
            />
            <div className="mktEnemyLightboxPanel">
              <button
                ref={closeBtnRef}
                type="button"
                className="mktEnemyLightboxClose"
                onClick={() => setLightboxOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
              <p className="mktEnemyLightboxKicker">PX-27 Combat Android</p>
              <div className="mktEnemyLightboxStage">
                <canvas ref={lightboxCanvasRef} className="mktEnemyLightboxCanvas" />
              </div>
              <p className="mktEnemyLightboxCaption">
                Meshy-skinned rig · walk cycle · rifle muzzle anchors · dual death clips
              </p>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {preview}
      {lightbox}
    </>
  );
}
