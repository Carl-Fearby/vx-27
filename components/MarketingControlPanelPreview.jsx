"use client";

import { useCallback, useEffect, useRef } from "react";
import { mountCreditsControlPanelPreview } from "@/lib/credits/CreditsControlPanelPreview";
import {
  creditsPreviewPriorityFromHost,
  useCreditsLazy3d,
} from "@/lib/credits/useCreditsLazy3d";

export default function MarketingControlPanelPreview({ className = "" }) {
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const { hostRef, shouldRun, everVisible } = useCreditsLazy3d();

  const getPriority = useCallback(
    () => creditsPreviewPriorityFromHost(hostRef.current),
    [],
  );

  useEffect(() => {
    if (!everVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    mountCreditsControlPanelPreview(canvas, { variant: "marketing", getPriority })
      .then((controller) => {
        if (!controller || cancelled) {
          controller?.dispose();
          return;
        }
        controllerRef.current = controller;
        controller.setActive(shouldRun);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [everVisible, getPriority]);

  useEffect(() => {
    controllerRef.current?.setActive(shouldRun);
  }, [shouldRun]);

  return (
    <div
      ref={hostRef}
      className={`mktControlPanelPreview${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <canvas ref={canvasRef} className="mktControlPanelPreviewCanvas" />
    </div>
  );
}
