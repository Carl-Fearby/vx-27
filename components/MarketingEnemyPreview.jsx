"use client";

import { useCallback, useEffect, useRef } from "react";
import { mountMarketingEnemyPreview } from "@/lib/marketing/MarketingEnemyPreview";
import {
  creditsPreviewPriorityFromHost,
  useCreditsLazy3d,
} from "@/lib/credits/useCreditsLazy3d";

export default function MarketingEnemyPreview({ className = "" }) {
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

    mountMarketingEnemyPreview(canvas, { getPriority })
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
      className={`mktEnemyPreview${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <canvas ref={canvasRef} className="mktEnemyPreviewCanvas" />
    </div>
  );
}
