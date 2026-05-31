"use client";

import { useCallback, useEffect, useRef } from "react";
import { mountCreditsAmmoCratePreview } from "@/lib/CreditsAmmoCratePreview";
import { preloadCreditsAssetData } from "@/lib/preloadCreditsAssets";
import {
  creditsPreviewPriorityFromHost,
  useCreditsLazy3d,
} from "@/lib/useCreditsLazy3d";

export default function CreditsAmmoCratePreview({ variant = "default", className = "" }) {
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

    preloadCreditsAssetData()
      .catch(() => {})
      .then(() => {
        if (cancelled || !canvasRef.current) return;
        return mountCreditsAmmoCratePreview(canvas, { variant, getPriority });
      })
      .then((controller) => {
        if (!controller || cancelled) {
          controller?.dispose();
          return;
        }
        controllerRef.current = controller;
        controller.setActive(shouldRun);
      });

    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [everVisible, variant, getPriority]);

  useEffect(() => {
    controllerRef.current?.setActive(shouldRun);
  }, [shouldRun]);

  return (
    <div
      ref={hostRef}
      className={`creditsAmmoCrate creditsAmmoCrate--${variant}${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <canvas ref={canvasRef} className="creditsAmmoCrateCanvas" />
    </div>
  );
}
