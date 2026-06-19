import { memo } from "react";
import { hackRectStyle } from "@/lib/console-hack/ConsoleHackLayoutTuning.js";

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
 * } & Record<string, unknown>} props
 */
function ConsoleHackTuneLine({ id, className = "", as: Tag = "span", children, tune, ...rest }) {
  if (!tune) return null;

  return (
    <Tag
      {...rest}
      className={["consoleHackLine", "consoleHackTuneTextBlock", className].filter(Boolean).join(" ")}
      style={elementStyle(tune)}
      data-hack-id={id}
    >
      {children}
    </Tag>
  );
}

export default memo(ConsoleHackTuneLine);
