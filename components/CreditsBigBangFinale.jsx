"use client";

import { useCallback, useEffect, useRef } from "react";
import { mountCreditsFinalePreview } from "@/lib/credits/CreditsFinalePreview";
import { preloadCreditsAssetData } from "@/lib/credits/preloadCreditsAssets";
import {
  creditsPreviewPriorityFromHost,
  useCreditsLazy3d,
} from "@/lib/credits/useCreditsLazy3d";

const BURST_COUNT = 16;

export default function CreditsBigBangFinale({ titleRef }) {
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
        return mountCreditsFinalePreview(canvas, { getPriority });
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
  }, [everVisible, getPriority]);

  useEffect(() => {
    controllerRef.current?.setActive(shouldRun);
  }, [shouldRun]);

  return (
    <div ref={hostRef} className="creditsBigBang" aria-hidden>
      <div className="creditsBigBangGlow" />
      <div className="creditsBigBangRing creditsBigBangRing--1" />
      <div className="creditsBigBangRing creditsBigBangRing--2" />
      <div className="creditsBigBangRing creditsBigBangRing--3" />

      <div className="creditsBigBangBursts">
        {Array.from({ length: BURST_COUNT }, (_, i) => (
          <span
            key={i}
            className="creditsBigBangBurst"
            style={{ "--burst-i": i, "--burst-n": BURST_COUNT }}
          />
        ))}
      </div>

      <div className="creditsBigBangStage">
        <canvas ref={canvasRef} className="creditsFinaleCanvas" />
        <div className="creditsBigBangText">
          <p className="creditsBigBangPre">VX-27</p>
          <h2 ref={titleRef} className="creditsBigBangTitle">
            THE END
          </h2>
          <p className="creditsBigBangName">Carl Fearby</p>
          <p className="creditsBigBangTag">Thanks for playing · Now go touch grass</p>
        </div>
      </div>
    </div>
  );
}
