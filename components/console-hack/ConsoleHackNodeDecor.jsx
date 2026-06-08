import { memo } from "react";
import { HACK_POINTER_SRC, HACK_SELECTED_POINTER_SRC } from "@/lib/console-hack/ConsoleHackGrid.js";

/**
 * Orange ring + triangle from pointer.png — rotate so triangle aims at target.
 *
 * @param {{ angleDeg: number, className?: string }} props
 */
export function HackNodePointerRing({ angleDeg, className = "" }) {
  return (
    <img
      src={HACK_POINTER_SRC}
      alt=""
      className={["consoleHackNodePointerRing", className].filter(Boolean).join(" ")}
      style={{ transform: `rotate(${angleDeg}deg)` }}
      draggable={false}
      aria-hidden="true"
    />
  );
}

/** Blue ring on the node that will be confirmed next. */
export function HackNodeSelectedRing({ className = "" }) {
  return (
    <img
      src={HACK_SELECTED_POINTER_SRC}
      alt=""
      className={["consoleHackNodeSelectedRing", className].filter(Boolean).join(" ")}
      draggable={false}
      aria-hidden="true"
    />
  );
}

export default memo(HackNodePointerRing);
