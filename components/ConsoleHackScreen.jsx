"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getHackGridDimensions,
  isHackSpriteElement,
  loadConsoleHackLayout,
  saveConsoleHackLayout,
} from "@/lib/console-hack/ConsoleHackLayoutTuning.js";
import {
  buildRandomHackGridNodes,
  hackLightningTimingStyle,
  hackNodeScreenFlashEnabled,
} from "@/lib/console-hack/ConsoleHackGrid.js";
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
import ConsoleHackTuneLine from "@/components/console-hack/ConsoleHackTuneLine.jsx";
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

  const screenFlashNodes = useMemo(
    () =>
      gridNodes.filter(
        (node) =>
          node.variant === "live" && hackNodeScreenFlashEnabled(node.index, gridSeed)
      ),
    [gridNodes, gridSeed]
  );

  const tuneLineProps = useCallback(
    (id) => ({
      id,
      tune: layout[id],
      tuneEnabled,
      selected: selectedId === id,
      onSelect: setSelectedId,
      onStartDrag: startDrag,
    }),
    [layout, tuneEnabled, selectedId, startDrag]
  );

  const pulseAnimate = !tuneEnabled;

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
            <ConsoleHackTuneLine
              {...tuneLineProps("headerTitle")}
              className="consoleHackTitle consoleHackLine--center"
              as="h1"
            >
              {HACK_UI.headerTitle}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("headerSubtitle")}
              className="consoleHackSubtitle consoleHackLine--center"
              as="p"
            >
              {HACK_UI.headerSubtitle}
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("statusLabel")} className="consoleHackLabel">
              STATUS
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("statusValue")} className="consoleHackValue">
              {HACK_UI.status}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("statusPulse")} className="consoleHackPulseLine">
              <HackStatusPulse animate={pulseAnimate} />
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("objectiveLabel")} className="consoleHackLabel">
              OBJECTIVE
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("objectiveLine1")}
              className="consoleHackValue consoleHackValue--sub"
            >
              {HACK_UI.objectiveLines[0]}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("objectiveLine2")}
              className="consoleHackValue consoleHackValue--sub"
            >
              {HACK_UI.objectiveLines[1]}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("objectiveCount")} className="consoleHackValue">
              {HACK_UI.objectiveCount}
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("rewardLabel")} className="consoleHackLabel">
              REWARD
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("rewardTitle")} className="consoleHackValue">
              {HACK_UI.rewardTitle}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("rewardSub")}
              className="consoleHackValue consoleHackValue--sub"
            >
              {HACK_UI.rewardSub}
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("timerLabel")} className="consoleHackLabel">
              TIMER
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("timerIcon")}
              className="consoleHackIconLine"
              aria-label="Timer"
            >
              <HackClockIcon className="consoleHackIcon" />
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("timerValue")}
              className="consoleHackValue consoleHackValue--lg"
            >
              {hackTimerText}
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("progressLabel")} className="consoleHackLabel">
              PROGRESS
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("progressBar")} className="consoleHackProgressRow">
              <div className="consoleHackProgressTrack">
                <div
                  className="consoleHackProgressFill"
                  style={{ width: `${hackProgressPct}%` }}
                />
              </div>
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("progressPct")} className="consoleHackProgressPct">
              {hackProgressPct}%
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("gridStart")} className="consoleHackGridLabel">
              {HACK_UI.gridStart}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("gridReward")}
              className="consoleHackGridLabel consoleHackGridLabel--reward"
            >
              {HACK_UI.gridReward}
            </ConsoleHackTuneLine>

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

            <ConsoleHackTuneLine {...tuneLineProps("nodeIdLabel")} className="consoleHackLabel">
              NODE ID
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("nodeIdValue")}
              className="consoleHackValue consoleHackValue--lg"
            >
              {HACK_UI.nodeId}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("secureChannelLabel")} className="consoleHackLabel">
              {HACK_UI.secureChannel}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("secureChannelLock")}
              className="consoleHackIconLine"
              aria-label="Secure"
            >
              <HackLockIcon className="consoleHackIcon" />
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("secureChannelBars")}
              className="consoleHackPulseLine consoleHackSecureBarsWrap"
            >
              <HackSecureChannelBars animate={pulseAnimate} />
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("rewardPreviewLabel")} className="consoleHackLabel">
              {HACK_UI.rewardPreview}
            </ConsoleHackTuneLine>

            <div className="consoleHackRewardsGrid consoleHackRewardsGrid--tune">
              <ConsoleHackTuneLine
                {...tuneLineProps("rewardsLabel")}
                className="consoleHackLabel consoleHackRewardsGrid__label"
              >
                POTENTIAL REWARDS
              </ConsoleHackTuneLine>
              {HACK_UI.rewards.map(({ iconId, lineId, text, Icon }) => (
                <span key={lineId} className="consoleHackRewardRow">
                  <ConsoleHackTuneLine
                    {...tuneLineProps(iconId)}
                    className="consoleHackIconLine consoleHackRewardIconLine"
                    aria-label={text}
                  >
                    <Icon className="consoleHackIcon consoleHackRewardIcon" />
                  </ConsoleHackTuneLine>
                  <ConsoleHackTuneLine
                    {...tuneLineProps(lineId)}
                    className="consoleHackValue consoleHackValue--list"
                  >
                    {text}
                  </ConsoleHackTuneLine>
                </span>
              ))}
            </div>

            {HACK_UI.footer.map((group) => (
              <ConsoleHackTuneLine
                key={group.id}
                {...tuneLineProps(group.id)}
                className="consoleHackFooterGroup"
                as="span"
              >
                {group.keys.map((key) => (
                  <kbd key={key} className="consoleHackKey">
                    {key}
                  </kbd>
                ))}
                <span>{group.label}</span>
              </ConsoleHackTuneLine>
            ))}
          </div>
        </div>
      </div>

      {!tuneEnabled && screenFlashNodes.length > 0 ? (
        <div className="consoleHackScreenFlashes" aria-hidden="true">
          {screenFlashNodes.map((node) => (
            <div
              key={`screen-flash-${node.index}`}
              className="consoleHackScreenFlash"
              style={hackLightningTimingStyle(node.index)}
            />
          ))}
        </div>
      ) : null}

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
