import { memo } from "react";
import {
  HACK_ELEMENT_META,
  hackRectStyle,
  isHackSpriteElement,
} from "@/lib/console-hack/ConsoleHackLayoutTuning.js";
import {
  getActivePointerTarget,
  getHackNodeVisualState,
  getNode,
  HACK_REWARD_NODE_ID,
  HACK_START_NODE_ID,
} from "@/lib/console-hack/ConsoleHackGame.js";
import {
  hackConnectionNodeCenterInOverlay,
  hackConnectionStripStyle,
  hackGridCellStyleInGrid,
  HACK_ERROR_LINE_SRC,
  HACK_LINE_SRC,
  HACK_NODE_DEAD_SRC,
  HACK_NODE_LIVE_SRC,
  HACK_REWARD_CACHE_SRC,
  hackNodePulseTimingStyle,
  hackNodeSpriteStyleInGrid,
  hackOverlayPointToViewBox,
  hackPointerRingAngleBetweenOverlay,
} from "@/lib/console-hack/ConsoleHackGrid.js";
import { HackNodePointerRing, HackNodeSelectedRing } from "@/components/console-hack/ConsoleHackNodeDecor.jsx";

function elementStyle(tune) {
  return {
    ...hackRectStyle(tune),
    "--hack-grid-x": String(tune.x),
    "--hack-grid-y": String(tune.y),
    "--hack-grid-w": String(tune.w),
    "--hack-grid-h": String(tune.h),
    "--hack-label-color": tune.labelColor,
    "--hack-value-color": tune.valueColor,
    "--hack-accent-color": tune.accentColor,
    "--hack-font-scale": String(tune.fontScale),
  };
}

/**
 * @param {import("@/lib/console-hack/ConsoleHackGame.js").HackGameState} gameState
 * @param {import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutTuning} layout
 * @param {number} cols
 * @param {number} rows
 */
function connectionStripElement(fromId, toId, gameState, layout, cols, rows, lineSrc, key, extraClass = "") {
  const gridArea = layout.gridArea;
  const spriteTemplate = layout.nodeLive ?? { x: 0, y: 0 };
  const gridStartNode = layout.gridStartNode;
  const gridRewardCache = layout.gridRewardCache;
  if (!gridArea) return null;

  const from = getNode(gameState, fromId);
  const to = getNode(gameState, toId);
  if (!from || !to) return null;

  const a = hackOverlayPointToViewBox(
    hackConnectionNodeCenterInOverlay(
      from,
      gridArea,
      spriteTemplate,
      cols,
      rows,
      gridStartNode,
      HACK_START_NODE_ID,
      gridRewardCache,
      HACK_REWARD_NODE_ID
    )
  );
  const b = hackOverlayPointToViewBox(
    hackConnectionNodeCenterInOverlay(
      to,
      gridArea,
      spriteTemplate,
      cols,
      rows,
      gridStartNode,
      HACK_START_NODE_ID,
      gridRewardCache,
      HACK_REWARD_NODE_ID
    )
  );
  return (
    <div
      key={key}
      className={["consoleHackConnection", extraClass].filter(Boolean).join(" ")}
      style={hackConnectionStripStyle(a, b)}
      aria-hidden="true"
    >
      <img src={lineSrc} alt="" className="consoleHackConnection__img" draggable={false} />
    </div>
  );
}

function renderConnections(gameState, layout, cols, rows) {
  if (!layout.gridArea) return null;

  const strips = gameState.connections.map(({ fromId, toId }) =>
    connectionStripElement(
      fromId,
      toId,
      gameState,
      layout,
      cols,
      rows,
      HACK_LINE_SRC,
      `${fromId}-${toId}`
    )
  );

  if (gameState.failureConnection) {
    const { fromId, toId } = gameState.failureConnection;
    strips.push(
      connectionStripElement(
        fromId,
        toId,
        gameState,
        layout,
        cols,
        rows,
        HACK_ERROR_LINE_SRC,
        `fail-${fromId}-${toId}`,
        "consoleHackConnection--error"
      )
    );
  }

  return strips;
}

/** @param {{ visual: ReturnType<typeof getHackNodeVisualState>, nodeIndex?: number }} props */
function HackNodeContent({ visual, nodeIndex = 0 }) {
  if (visual === "empty") {
    return null;
  }

  if (visual === "reward") {
    return (
      <img
        src={HACK_REWARD_CACHE_SRC}
        alt=""
        className="consoleHackNodeSprite__img consoleHackNodeSprite__img--reward"
        draggable={false}
      />
    );
  }

  if (visual === "connectedPower") {
    return (
      <span className="consoleHackNodeSprite__zapWrap" style={hackNodePulseTimingStyle(nodeIndex)}>
        <span className="consoleHackNodeSprite__glow" aria-hidden="true" />
        <img
          src={HACK_NODE_LIVE_SRC}
          alt=""
          className="consoleHackNodeSprite__img consoleHackNodeSprite__img--pulse"
          draggable={false}
        />
      </span>
    );
  }

  if (visual === "revealedSecurity") {
    return (
      <img
        src={HACK_NODE_DEAD_SRC}
        alt=""
        className="consoleHackNodeSprite__img consoleHackNodeSprite__img--fade"
        style={{ animationDuration: `${30 + (nodeIndex % 7) * 4}s` }}
        draggable={false}
      />
    );
  }

  if (visual === "debugSecurity") {
    return (
      <img
        src={HACK_NODE_DEAD_SRC}
        alt=""
        className="consoleHackNodeSprite__img consoleHackNodeSprite__img--debugSecurity"
        draggable={false}
      />
    );
  }

  return null;
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
 *   gridCols: number,
 *   gridRows: number,
 *   gameState?: import("@/lib/console-hack/ConsoleHackGame.js").HackGameState | null,
 *   onSelectGameNode?: (nodeId: string) => void,
 * }} props
 */
function ConsoleHackGridArea({
  layout,
  tuneEnabled,
  selectedId,
  onSelectId,
  startDrag,
  spriteDragSpace,
  gridCols,
  gridRows,
  gameState = null,
  onSelectGameNode,
}) {
  const tune = layout.gridArea;
  const liveTemplate = layout.nodeLive;
  const deadTemplate = layout.nodeDead;
  if (!tune) return null;

  const selected = selectedId === "gridArea";
  const playMode = !tuneEnabled && gameState != null;

  if (playMode) {
    const gridNodes = gameState.nodes.filter(
      (n) => n.id !== HACK_START_NODE_ID && n.id !== HACK_REWARD_NODE_ID
    );
    const pointerTarget = getActivePointerTarget(gameState);
    const gridStartNode = layout.gridStartNode;

    return (
      <div
        className="consoleHackGridArea consoleHackGridArea--play"
        style={elementStyle(tune)}
        data-hack-id="gridArea"
      >
        <div className="consoleHackConnections consoleHackConnections--frame" aria-hidden="true">
          {renderConnections(gameState, layout, gridCols, gridRows)}
        </div>

        {gridNodes.map((node) => {
          const visual = getHackNodeVisualState(gameState, node.id);
          const isActive = node.id === gameState.activeNodeId;
          const isSelected = node.id === gameState.selectedNodeId;
          const playActive = gameState.status === "active";
          const showPointerRing =
            playActive && isActive && pointerTarget != null && pointerTarget.id !== node.id;
          const showSelectedRing = playActive && isSelected;
          const spriteTemplate = liveTemplate ?? { x: 0, y: 0, w: 0.84, h: 0.78, fontScale: 1 };
          const pointerAngle =
            showPointerRing && pointerTarget
              ? hackPointerRingAngleBetweenOverlay(
                  hackConnectionNodeCenterInOverlay(
                    node,
                    tune,
                    spriteTemplate,
                    gridCols,
                    gridRows,
                    gridStartNode,
                    HACK_START_NODE_ID,
                    layout.gridRewardCache,
                    HACK_REWARD_NODE_ID
                  ),
                  hackConnectionNodeCenterInOverlay(
                    pointerTarget,
                    tune,
                    spriteTemplate,
                    gridCols,
                    gridRows,
                    gridStartNode,
                    HACK_START_NODE_ID,
                    layout.gridRewardCache,
                    HACK_REWARD_NODE_ID
                  )
                )
              : 0;

          return (
            <button
              key={node.id}
              type="button"
              className={[
                "consoleHackNodeSprite",
                "consoleHackNodeSprite--play",
                `consoleHackNodeSprite--${visual}`,
                playActive && isSelected ? "consoleHackNodeSprite--selected" : "",
                playActive && isActive ? "consoleHackNodeSprite--active" : "",
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
              onClick={() => onSelectGameNode?.(node.id)}
              aria-label={`Grid node ${node.row + 1},${node.col + 1}`}
            >
              <HackNodeContent visual={visual} nodeIndex={node.col * gridRows + node.row} />
              {showSelectedRing ? <HackNodeSelectedRing /> : null}
              {showPointerRing ? <HackNodePointerRing angleDeg={pointerAngle} /> : null}
            </button>
          );
        })}
      </div>
    );
  }

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
    : [];

  const spriteNodes =
    liveTemplate && deadTemplate && previewOnly
      ? visibleNodes.map((node) => {
          const templateId = node.variant === "live" ? "nodeLive" : "nodeDead";
          if (previewOnly !== templateId) return null;
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
              <img
                src={node.variant === "live" ? HACK_NODE_LIVE_SRC : HACK_NODE_DEAD_SRC}
                alt=""
                className="consoleHackNodeSprite__img"
                draggable={false}
              />
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
