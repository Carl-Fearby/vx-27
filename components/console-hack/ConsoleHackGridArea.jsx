import { memo } from "react";
import {
  HACK_ELEMENT_META,
  hackRectStyle,
  isHackSpriteElement,
} from "@/lib/console-hack/ConsoleHackLayoutTuning.js";
import {
  buildRandomHackGridNodes,
  hackGridCellStyleInGrid,
  HACK_NODE_DEAD_SRC,
  HACK_NODE_LIVE_SRC,
  hackNodeSpriteStyleInGrid,
} from "@/lib/console-hack/ConsoleHackGrid.js";
import { HackLightningBoltIcon } from "@/components/console-hack/ConsoleHackIcons.jsx";

function elementStyle(tune) {
  return {
    ...hackRectStyle(tune),
    "--hack-label-color": tune.labelColor,
    "--hack-value-color": tune.valueColor,
    "--hack-accent-color": tune.accentColor,
    "--hack-font-scale": String(tune.fontScale),
  };
}

/** @param {number} index */
function lightningTimingStyle(index) {
  return {
    "--lightning-dur": `${6.5 + (index % 11) * 1.25}s`,
    "--lightning-delay": `${(index % 19) * 0.47}s`,
    "--lightning-rot": `${-28 + (index % 7) * 14}deg`,
    "--pulse-dur": `${2.35 + (index % 9) * 0.42}s`,
    "--pulse-delay": `${(index % 13) * 0.21}s`,
  };
}

/**
 * @param {{
 *   layout: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutTuning,
 *   tuneEnabled: boolean,
 *   selectedId: string | null,
 *   onSelectId: (id: string) => void,
 *   startDrag: (
 *     event: React.MouseEvent,
 *     id: string,
 *     mode: "move" | "resize",
 *     startRect: object,
 *     dragSpace?: import("@/components/console-hack/useConsoleHackTuneDrag.js").HackTuneDragSpace
 *   ) => void,
 *   spriteDragSpace: import("@/components/console-hack/useConsoleHackTuneDrag.js").HackTuneDragSpace,
 *   gridNodes: ReturnType<typeof buildRandomHackGridNodes>,
 *   gridCols: number,
 *   gridRows: number,
 * }} props
 */
function ConsoleHackGridArea({
  layout,
  tuneEnabled,
  selectedId,
  onSelectId,
  startDrag,
  spriteDragSpace,
  gridNodes,
  gridCols,
  gridRows,
}) {
  const tune = layout.gridArea;
  const liveTemplate = layout.nodeLive;
  const deadTemplate = layout.nodeDead;
  if (!tune) return null;

  const selected = selectedId === "gridArea";
  const cellNodes = [];
  const tuningSprite = tuneEnabled && isHackSpriteElement(selectedId ?? "");
  const previewOnly = tuningSprite ? selectedId : null;

  if (tuneEnabled) {
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        cellNodes.push(
          <div
            key={`cell-${col}-${row}`}
            className="consoleHackGridCell"
            style={hackGridCellStyleInGrid(col, row, gridCols, gridRows)}
          />
        );
      }
    }
  }

  const visibleNodes = previewOnly
    ? [
        {
          col: 0,
          row: 0,
          index: 0,
          variant: previewOnly === "nodeLive" ? "live" : "dead",
        },
      ]
    : gridNodes.filter((node) => node.variant !== "empty");

  const spriteNodes =
    liveTemplate && deadTemplate
      ? visibleNodes.map((node) => {
          const templateId = node.variant === "live" ? "nodeLive" : "nodeDead";
          if (previewOnly && previewOnly !== templateId) return null;

          const spriteTemplate = node.variant === "live" ? liveTemplate : deadTemplate;
          const selectedSprite =
            tuneEnabled && selectedId === templateId && node.col === 0 && node.row === 0;

          return (
            <div
              key={`${node.variant}-${node.index}`}
              className={[
                "consoleHackNodeSprite",
                tuneEnabled ? "consoleHackTuneBox consoleHackTuneBox--interactive" : "",
                selectedSprite ? "consoleHackTuneBox--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={hackNodeSpriteStyleInGrid(
                node.col,
                node.row,
                spriteTemplate,
                gridCols,
                gridRows
              )}
              data-hack-id={templateId}
              title={tuneEnabled ? HACK_ELEMENT_META[templateId]?.label : undefined}
              onMouseDown={
                tuneEnabled
                  ? (e) => {
                      e.stopPropagation();
                      onSelectId(templateId);
                      startDrag(e, templateId, "move", spriteTemplate, spriteDragSpace);
                    }
                  : undefined
              }
            >
              {!tuneEnabled && node.variant === "live" ? (
                <span
                  className="consoleHackNodeSprite__zapWrap"
                  style={lightningTimingStyle(node.index)}
                >
                  <span className="consoleHackNodeSprite__glow" aria-hidden="true" />
                  <img
                    src={HACK_NODE_LIVE_SRC}
                    alt=""
                    className="consoleHackNodeSprite__img consoleHackNodeSprite__img--pulse"
                    draggable={false}
                  />
                  <HackLightningBoltIcon className="consoleHackNodeSprite__bolt" />
                </span>
              ) : (
                <img
                  src={node.variant === "live" ? HACK_NODE_LIVE_SRC : HACK_NODE_DEAD_SRC}
                  alt=""
                  className={[
                    "consoleHackNodeSprite__img",
                    !tuneEnabled && node.variant === "dead"
                      ? "consoleHackNodeSprite__img--fade"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    !tuneEnabled && node.variant === "dead"
                      ? {
                          animationDuration: `${4.5 + (node.index % 8) * 0.85}s`,
                          animationDelay: `${(node.index % 11) * 0.34}s`,
                        }
                      : undefined
                  }
                  draggable={false}
                />
              )}
              {tuneEnabled && selectedSprite ? (
                <span
                  className="consoleHackResizeHandle"
                  onMouseDown={(e) =>
                    startDrag(e, templateId, "resize", spriteTemplate, spriteDragSpace)
                  }
                />
              ) : null}
            </div>
          );
        })
      : null;

  return (
    <div
      className={[
        "consoleHackGridArea",
        tuneEnabled ? "consoleHackGridArea--tune" : "",
        selected ? "consoleHackGridArea--selected" : "",
        tuneEnabled ? "consoleHackTuneBox consoleHackTuneBox--interactive" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={elementStyle(tune)}
      data-hack-id="gridArea"
      title={tuneEnabled ? HACK_ELEMENT_META.gridArea?.label : undefined}
      onMouseDown={
        tuneEnabled
          ? (e) => {
              e.stopPropagation();
              onSelectId("gridArea");
              startDrag(e, "gridArea", "move", tune);
            }
          : undefined
      }
    >
      {cellNodes}
      {spriteNodes}
      {tuneEnabled && selected ? (
        <span
          className="consoleHackResizeHandle"
          onMouseDown={(e) => startDrag(e, "gridArea", "resize", tune)}
        />
      ) : null}
    </div>
  );
}

export default memo(ConsoleHackGridArea);
