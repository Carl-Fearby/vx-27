import { useCallback, useEffect, useRef, useState } from "react";

const PANEL_POS_KEY = "fps-console-hack-tune-panel-pos";

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** @returns {{ left: number, top: number } | null} */
function loadPanelPos() {
  try {
    const raw = localStorage.getItem(PANEL_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === "number" && typeof parsed?.top === "number") {
      return { left: parsed.left, top: parsed.top };
    }
  } catch {
    // ignore
  }
  return null;
}

/** @param {{ left: number, top: number }} pos */
function savePanelPos(pos) {
  localStorage.setItem(PANEL_POS_KEY, JSON.stringify(pos));
}

/** @returns {{ panelRef: React.RefObject<HTMLElement | null>, panelStyle: React.CSSProperties | undefined, startPanelDrag: (e: React.MouseEvent) => void, dragging: boolean }} */
export function useConsoleHackTunePanelDrag() {
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [pos, setPos] = useState(() => loadPanelPos());
  const [dragging, setDragging] = useState(false);

  const startPanelDrag = useCallback(
    (event) => {
      if (event.button !== 0) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originLeft: pos?.left ?? rect.left,
        originTop: pos?.top ?? rect.top,
      };
      setDragging(true);
      event.preventDefault();
    },
    [pos]
  );

  useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      const panel = panelRef.current;
      if (!drag || !panel) return;

      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const left = clamp(
        drag.originLeft + event.clientX - drag.startX,
        8,
        Math.max(8, window.innerWidth - width - 8)
      );
      const top = clamp(
        drag.originTop + event.clientY - drag.startY,
        8,
        Math.max(8, window.innerHeight - height - 8)
      );
      const next = { left, top };
      setPos(next);
      savePanelPos(next);
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const panelStyle = pos
    ? { left: `${pos.left}px`, top: `${pos.top}px`, right: "auto" }
    : undefined;

  return { panelRef, panelStyle, startPanelDrag, dragging };
}
