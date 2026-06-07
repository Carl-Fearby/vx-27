"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HACK_ELEMENT_META,
  getHackGridDimensions,
  hackRectStyle,
  isHackSpriteElement,
  loadConsoleHackLayout,
  saveConsoleHackLayout,
} from "@/lib/console-hack/ConsoleHackLayoutTuning.js";
import { buildRandomHackGridNodes } from "@/lib/console-hack/ConsoleHackGrid.js";
import {
  formatHackTimer,
  hackTimerProgressPct,
  HACK_TIMER_DEFAULT,
  parseHackTimer,
} from "@/lib/console-hack/ConsoleHackTimer.js";
import ConsoleHackTunePanel from "@/components/tuning-panels/ConsoleHackTunePanel.jsx";
import { useConsoleHackTuneDrag } from "@/components/console-hack/useConsoleHackTuneDrag.js";
import {
  HackAmmoIcon,
  HackClockIcon,
  HackCreditIcon,
  HackLockIcon,
  HackMedkitIcon,
} from "@/components/console-hack/ConsoleHackIcons.jsx";
import { HackSecureChannelBars, HackStatusPulse } from "@/components/console-hack/ConsoleHackPulse.jsx";
import ConsoleHackGridArea from "@/components/console-hack/ConsoleHackGridArea.jsx";
import "./console-hack/ConsoleHackScreen.css";

const HACK_UI = {
  headerTitle: "NODE BREACH",
  headerSubtitle: "VX-27 CONTROL SYSTEM",
  status: "ACCESSING REWARD NODE",
  objectiveLines: ["> ROUTE POWER", "> BYPASS 3 SECURITY NODES"],
  objectiveCount: "0/3",
  rewardTitle: "SUPPLY CACHE",
  rewardSub: "+ CREDITS / AMMO / MEDKIT",
  timer: HACK_TIMER_DEFAULT,
  progressPct: 44,
  gridStart: "START",
  gridReward: "REWARD CACHE",
  nodeId: "VX-27-NODE-9A",
  secureChannel: "SECURE CHANNEL",
  rewardPreview: "REWARD PREVIEW",
  rewards: [
    { iconId: "rewardIcon1", lineId: "rewardLine1", text: "+ 250 CREDITS", Icon: HackCreditIcon },
    { iconId: "rewardIcon2", lineId: "rewardLine2", text: "+ 50 PISTOL AMMO", Icon: HackAmmoIcon },
    { iconId: "rewardIcon3", lineId: "rewardLine3", text: "+ 1 MEDKIT", Icon: HackMedkitIcon },
  ],
  footer: [
    { id: "footerMove", keys: ["WASD"], label: "MOVE" },
    { id: "footerRotate", keys: ["E"], label: "ROTATE NODE" },
    { id: "footerConfirm", keys: ["F"], label: "CONFIRM" },
    { id: "footerReset", keys: ["R"], label: "RESET" },
    { id: "footerExit", keys: ["ESC"], label: "EXIT" },
  ],
};

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
 * @param {{
 *   open: boolean,
 *   tuneEnabled?: boolean,
 *   layout?: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutTuning,
 *   onLayoutChange?: (layout: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutTuning) => void,
 *   onTuneClose?: () => void,
 *   panelId?: string | null,
 *   panelLabel?: string | null,
 *   onClose?: () => void,
 * }} props
 */
export default function ConsoleHackScreen({
  open,
  tuneEnabled = false,
  layout: layoutProp,
  onLayoutChange,
  onTuneClose,
  panelId,
  panelLabel,
  onClose,
}) {
  const frameRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [layout, setLayout] = useState(() => layoutProp ?? loadConsoleHackLayout());
  const hackTimerTotalMs = useMemo(() => parseHackTimer(HACK_UI.timer), []);
  const [hackTimerMs, setHackTimerMs] = useState(hackTimerTotalMs);
  const hackTimerRafRef = useRef(0);

  useEffect(() => {
    if (layoutProp) setLayout(layoutProp);
  }, [layoutProp]);

  const commitLayout = useCallback(
    (next) => {
      setLayout(next);
      saveConsoleHackLayout(next);
      onLayoutChange?.(next);
    },
    [onLayoutChange]
  );

  const patchElement = useCallback(
    (id, patch) => {
      setLayout((prev) => {
        let next = { ...prev, [id]: { ...prev[id], ...patch } };
        if (isHackSpriteElement(id)) {
          next[id] = { ...next[id], spriteCentered: true };
          if (!("fontScale" in patch)) {
            const shared = {
              x: next[id].x,
              y: next[id].y,
              w: next[id].w,
              h: next[id].h,
              spriteCentered: true,
            };
            next = {
              ...next,
              nodeLive: { ...next.nodeLive, ...shared },
              nodeDead: { ...next.nodeDead, ...shared },
            };
          }
        }
        saveConsoleHackLayout(next);
        onLayoutChange?.(next);
        return next;
      });
    },
    [onLayoutChange]
  );

  const { startDrag } = useConsoleHackTuneDrag({
    tuneEnabled: open && tuneEnabled,
    frameRef,
    onPatch: patchElement,
  });

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHackTimerMs(hackTimerTotalMs);
      return undefined;
    }
    if (tuneEnabled) return undefined;

    const endAt = performance.now() + hackTimerTotalMs;
    const tick = () => {
      const remaining = Math.max(0, endAt - performance.now());
      setHackTimerMs(remaining);
      if (remaining > 0) {
        hackTimerRafRef.current = requestAnimationFrame(tick);
      }
    };

    setHackTimerMs(hackTimerTotalMs);
    hackTimerRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(hackTimerRafRef.current);
  }, [open, tuneEnabled, hackTimerTotalMs]);

  const hackTimerText = formatHackTimer(hackTimerMs);
  const hackProgressPct = hackTimerProgressPct(hackTimerMs, hackTimerTotalMs);

  const [gridSeed, setGridSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const randomizeGridNodes = useCallback(() => {
    setGridSeed(Math.floor(Math.random() * 0xffffffff));
  }, []);
  useEffect(() => {
    if (open) randomizeGridNodes();
  }, [open, randomizeGridNodes]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (tuneEnabled) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        randomizeGridNodes();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, tuneEnabled, randomizeGridNodes]);

  const gridArea = layout.gridArea;
  const { cols: gridCols, rows: gridRows } = getHackGridDimensions(gridArea);
  const spriteCellW = gridArea ? gridArea.w / gridCols : 1;
  const spriteCellH = gridArea ? gridArea.h / gridRows : 1;
  const spriteDragSpace = useMemo(
    () => ({
      space: "cell",
      anchor: "center",
      cellW: spriteCellW,
      cellH: spriteCellH,
    }),
    [spriteCellW, spriteCellH]
  );

  const gridNodes = useMemo(
    () =>
      buildRandomHackGridNodes({
        cols: gridCols,
        rows: gridRows,
        seed: gridSeed,
      }),
    [gridCols, gridRows, gridSeed]
  );

  const HackTuneLine = ({
    id,
    className = "",
    as: Tag = "span",
    children,
  }) => {
    const tune = layout[id];
    if (!tune) return null;
    const selected = selectedId === id;
    return (
      <Tag
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
                setSelectedId(id);
                startDrag(e, id, "move", tune);
              }
            : undefined
        }
      >
        {children}
        {tuneEnabled && selected ? (
          <span
            className="consoleHackResizeHandle"
            onMouseDown={(e) => startDrag(e, id, "resize", tune)}
          />
        ) : null}
      </Tag>
    );
  };

  if (!open) return null;

  const backdrop = (
    <div
      className="consoleHackBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={panelLabel ?? "Hack console"}
      data-panel-id={panelId ?? undefined}
    >
      <div className="consoleHackShell">
        <div className="consoleHackFrame" ref={frameRef}>
          <div
            className={`consoleHackOverlay ${tuneEnabled ? "consoleHackOverlay--tune" : ""}`}
            onMouseDown={
              tuneEnabled
                ? (e) => {
                    if (e.target === e.currentTarget) setSelectedId(null);
                  }
                : undefined
            }
          >
            <HackTuneLine id="headerTitle" className="consoleHackTitle consoleHackLine--center" as="h1">
              {HACK_UI.headerTitle}
            </HackTuneLine>
            <HackTuneLine id="headerSubtitle" className="consoleHackSubtitle consoleHackLine--center" as="p">
              {HACK_UI.headerSubtitle}
            </HackTuneLine>

            <HackTuneLine id="statusLabel" className="consoleHackLabel">
              STATUS
            </HackTuneLine>
            <HackTuneLine id="statusValue" className="consoleHackValue">
              {HACK_UI.status}
            </HackTuneLine>
            <HackTuneLine id="statusPulse" className="consoleHackPulseLine">
              <HackStatusPulse animate={open && !tuneEnabled} />
            </HackTuneLine>

            <HackTuneLine id="objectiveLabel" className="consoleHackLabel">
              OBJECTIVE
            </HackTuneLine>
            <HackTuneLine id="objectiveLine1" className="consoleHackValue consoleHackValue--sub">
              {HACK_UI.objectiveLines[0]}
            </HackTuneLine>
            <HackTuneLine id="objectiveLine2" className="consoleHackValue consoleHackValue--sub">
              {HACK_UI.objectiveLines[1]}
            </HackTuneLine>
            <HackTuneLine id="objectiveCount" className="consoleHackValue">
              {HACK_UI.objectiveCount}
            </HackTuneLine>

            <HackTuneLine id="rewardLabel" className="consoleHackLabel">
              REWARD
            </HackTuneLine>
            <HackTuneLine id="rewardTitle" className="consoleHackValue">
              {HACK_UI.rewardTitle}
            </HackTuneLine>
            <HackTuneLine id="rewardSub" className="consoleHackValue consoleHackValue--sub">
              {HACK_UI.rewardSub}
            </HackTuneLine>

            <HackTuneLine id="timerLabel" className="consoleHackLabel">
              TIMER
            </HackTuneLine>
            <HackTuneLine id="timerIcon" className="consoleHackIconLine" aria-label="Timer">
              <HackClockIcon className="consoleHackIcon" />
            </HackTuneLine>
            <HackTuneLine id="timerValue" className="consoleHackValue consoleHackValue--lg">
              {hackTimerText}
            </HackTuneLine>

            <HackTuneLine id="progressLabel" className="consoleHackLabel">
              PROGRESS
            </HackTuneLine>
            <HackTuneLine id="progressBar" className="consoleHackProgressRow">
              <div className="consoleHackProgressTrack">
                <div
                  className="consoleHackProgressFill"
                  style={{ width: `${hackProgressPct}%` }}
                />
              </div>
            </HackTuneLine>
            <HackTuneLine id="progressPct" className="consoleHackProgressPct">
              {hackProgressPct}%
            </HackTuneLine>

            <HackTuneLine id="gridStart" className="consoleHackGridLabel">
              {HACK_UI.gridStart}
            </HackTuneLine>
            <HackTuneLine
              id="gridReward"
              className="consoleHackGridLabel consoleHackGridLabel--reward"
            >
              {HACK_UI.gridReward}
            </HackTuneLine>

            <ConsoleHackGridArea
              layout={layout}
              tuneEnabled={tuneEnabled}
              selectedId={selectedId}
              onSelectId={setSelectedId}
              startDrag={startDrag}
              spriteDragSpace={spriteDragSpace}
              gridNodes={gridNodes}
              gridCols={gridCols}
              gridRows={gridRows}
            />

            <HackTuneLine id="nodeIdLabel" className="consoleHackLabel">
              NODE ID
            </HackTuneLine>
            <HackTuneLine id="nodeIdValue" className="consoleHackValue consoleHackValue--lg">
              {HACK_UI.nodeId}
            </HackTuneLine>
            <HackTuneLine id="secureChannelLabel" className="consoleHackLabel">
              {HACK_UI.secureChannel}
            </HackTuneLine>
            <HackTuneLine id="secureChannelLock" className="consoleHackIconLine" aria-label="Secure">
              <HackLockIcon className="consoleHackIcon" />
            </HackTuneLine>
            <HackTuneLine id="secureChannelBars" className="consoleHackPulseLine consoleHackSecureBarsWrap">
              <HackSecureChannelBars animate={open && !tuneEnabled} />
            </HackTuneLine>

            <HackTuneLine id="rewardPreviewLabel" className="consoleHackLabel">
              {HACK_UI.rewardPreview}
            </HackTuneLine>

            <div className="consoleHackRewardsGrid consoleHackRewardsGrid--tune">
              <HackTuneLine
                id="rewardsLabel"
                className="consoleHackLabel consoleHackRewardsGrid__label"
              >
                POTENTIAL REWARDS
              </HackTuneLine>
              {HACK_UI.rewards.map(({ iconId, lineId, text, Icon }) => (
                <span key={lineId} className="consoleHackRewardRow">
                  <HackTuneLine
                    id={iconId}
                    className="consoleHackIconLine consoleHackRewardIconLine"
                    aria-label={text}
                  >
                    <Icon className="consoleHackIcon consoleHackRewardIcon" />
                  </HackTuneLine>
                  <HackTuneLine
                    id={lineId}
                    className="consoleHackValue consoleHackValue--list"
                  >
                    {text}
                  </HackTuneLine>
                </span>
              ))}
            </div>

            {HACK_UI.footer.map((group) => (
              <HackTuneLine
                key={group.id}
                id={group.id}
                className="consoleHackFooterGroup"
                as="span"
              >
                {group.keys.map((key) => (
                  <kbd key={key} className="consoleHackKey">
                    {key}
                  </kbd>
                ))}
                <span>{group.label}</span>
              </HackTuneLine>
            ))}
          </div>
        </div>
      </div>

      {tuneEnabled ? (
        <ConsoleHackTunePanel
          selectedId={selectedId}
          layout={layout}
          onSelect={setSelectedId}
          onPatch={patchElement}
          onLayoutReplace={commitLayout}
          onClose={() => onTuneClose?.()}
        />
      ) : null}
    </div>
  );

  if (typeof document === "undefined") return backdrop;
  return createPortal(backdrop, document.body);
}
