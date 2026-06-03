import { useEffect, useRef, useState } from "react";
import {
  creditsPreviewPriorityFromHost,
  registerCreditsPreview,
} from "./creditsPreviewScheduler.js";

/**
 * Defer 3D mount until near viewport; only the closest preview renders each frame.
 */
export function useCreditsLazy3d() {
  const hostRef = useRef(null);
  const [shouldRun, setShouldRun] = useState(false);
  const [everVisible, setEverVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const root = host.closest(".creditsViewport");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEverVisible(true);
          setShouldRun(true);
        } else {
          setShouldRun(false);
        }
      },
      { root, rootMargin: "160px 0px", threshold: 0 },
    );

    io.observe(host);
    return () => io.disconnect();
  }, []);

  return { hostRef, shouldRun, everVisible };
}

/**
 * Schedules preview renders through the shared credits RAF (one WebGL draw per frame).
 */
export function createCreditsPreviewLoop(onFrame, getPriority) {
  const id = Symbol();
  const priorityFn =
    getPriority ??
    (() => {
      return 0;
    });

  const reg = registerCreditsPreview(id, {
    render: onFrame,
    getPriority: priorityFn,
  });

  return {
    setActive(run) {
      reg.setWantsRender(run);
    },
    stop: () => reg.dispose(),
  };
}

export { creditsPreviewPriorityFromHost };
