import { useCallback, useEffect, useRef } from "react";

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/**
 * @typedef {{
 *   space?: "frame" | "cell",
 *   anchor?: "topleft" | "center",
 *   cellW?: number,
 *   cellH?: number,
 * }} HackTuneDragSpace
 */

/**
 * @param {{
 *   tuneEnabled: boolean,
 *   frameRef: React.RefObject<HTMLElement | null>,
 *   onPatch: (id: string, patch: Partial<import("@/lib/console-hack/ConsoleHackLayoutTuning.js").HackElementTune>) => void,
 * }} opts
 */
export function useConsoleHackTuneDrag({ tuneEnabled, frameRef, onPatch }) {
  const dragRef = useRef(null);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const startDrag = useCallback(
    (event, id, mode, startRect, dragSpace = null) => {
      if (!tuneEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        id,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startRect: { ...startRect },
        dragSpace: dragSpace ?? { space: "frame" },
      };
    },
    [tuneEnabled]
  );

  useEffect(() => {
    if (!tuneEnabled) return undefined;

    const onMove = (event) => {
      const drag = dragRef.current;
      const frame = frameRef.current;
      if (!drag || !frame) return;

      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      const dx = (event.clientX - drag.startX) / bounds.width;
      const dy = (event.clientY - drag.startY) / bounds.height;
      const { startRect: r, dragSpace } = drag;
      const cellSpace = dragSpace?.space === "cell";
      const cellW = cellSpace && dragSpace.cellW > 0 ? dragSpace.cellW : 1;
      const cellH = cellSpace && dragSpace.cellH > 0 ? dragSpace.cellH : 1;
      const localDx = dx / cellW;
      const localDy = dy / cellH;

      const centerAnchored = cellSpace && dragSpace.anchor === "center";

      if (drag.mode === "move") {
        if (centerAnchored) {
          onPatch(drag.id, {
            x: clamp(r.x + localDx, r.w / 2 - 0.5, 0.5 - r.w / 2),
            y: clamp(r.y + localDy, r.h / 2 - 0.5, 0.5 - r.h / 2),
          });
        } else {
          onPatch(drag.id, {
            x: clamp(r.x + localDx, 0, 1 - r.w),
            y: clamp(r.y + localDy, 0, 1 - r.h),
          });
        }
      } else if (drag.mode === "resize") {
        const w = centerAnchored
          ? clamp(r.w + localDx, 0.01, 1)
          : clamp(r.w + localDx, 0.01, 1 - r.x);
        const h = centerAnchored
          ? clamp(r.h + localDy, 0.01, 1)
          : clamp(r.h + localDy, 0.01, 1 - r.y);
        onPatch(drag.id, {
          w,
          h,
          ...(centerAnchored
            ? {
                x: clamp(r.x, w / 2 - 0.5, 0.5 - w / 2),
                y: clamp(r.y, h / 2 - 0.5, 0.5 - h / 2),
              }
            : null),
        });
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endDrag);
    };
  }, [tuneEnabled, frameRef, onPatch, endDrag]);

  return { startDrag, endDrag };
}
