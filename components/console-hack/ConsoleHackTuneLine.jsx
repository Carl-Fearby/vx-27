import { memo } from "react";
import {
  HACK_ELEMENT_META,
  hackRectStyle,
} from "@/lib/console-hack/ConsoleHackLayoutTuning.js";

function elementStyle(tune) {
  return {
    ...hackRectStyle(tune),
    "--hack-label-color": tune.labelColor,
    "--hack-value-color": tune.valueColor,
    "--hack-accent-color": tune.accentColor,
    "--hack-font-scale": String(tune.fontScale),
  };
}

/**
 * Stable layout line — must live outside ConsoleHackScreen so timer ticks
 * do not remount children and kill CSS animations.
 *
 * @param {{
 *   id: string,
 *   className?: string,
 *   as?: keyof JSX.IntrinsicElements,
 *   children?: import("react").ReactNode,
 *   tune: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutElement | undefined,
 *   tuneEnabled?: boolean,
 *   selected?: boolean,
 *   onSelect?: (id: string) => void,
 *   onStartDrag?: (
 *     e: import("react").MouseEvent,
 *     id: string,
 *     mode: "move" | "resize",
 *     tune: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutElement
 *   ) => void,
 * } & Record<string, unknown>} props
 */
function ConsoleHackTuneLine({
  id,
  className = "",
  as: Tag = "span",
  children,
  tune,
  tuneEnabled = false,
  selected = false,
  onSelect,
  onStartDrag,
  ...rest
}) {
  if (!tune) return null;

  return (
    <Tag
      {...rest}
      className={[
        "consoleHackLine",
        "consoleHackTuneTextBlock",
        className,
        tuneEnabled ? "consoleHackTuneBox consoleHackTuneBox--interactive" : "",
        selected ? "consoleHackTuneBox--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={elementStyle(tune)}
      data-hack-id={id}
      title={tuneEnabled ? HACK_ELEMENT_META[id]?.label : undefined}
      onMouseDown={
        tuneEnabled
          ? (e) => {
              e.stopPropagation();
              onSelect?.(id);
              onStartDrag?.(e, id, "move", tune);
            }
          : undefined
      }
    >
      {children}
      {tuneEnabled && selected ? (
        <span
          className="consoleHackResizeHandle"
          onMouseDown={(e) => onStartDrag?.(e, id, "resize", tune)}
        />
      ) : null}
    </Tag>
  );
}

export default memo(ConsoleHackTuneLine);
