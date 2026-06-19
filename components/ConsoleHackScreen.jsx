"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getHackGridDimensions,
  loadConsoleHackLayout,
} from "@/lib/console-hack/ConsoleHackLayoutTuning.js";
import {
  HACK_NODE_LIVE_SRC,
  HACK_REWARD_CACHE_SRC,
  hackConnectionNodeCenterInOverlay,
  hackNodePulseTimingStyle,
  hackPointerRingAngleBetweenOverlay,
} from "@/lib/console-hack/ConsoleHackGrid.js";
import { HackNodePointerRing } from "@/components/console-hack/ConsoleHackNodeDecor.jsx";
import {
  confirmSelectedNode,
  createHackGameState,
  formatHackGrantedRewards,
  initConsoleHackBridge,
  getHackObjectiveCount,
  getHackPotentialRewardPreview,
  getHackRetriesLabel,
  getHackRouteProgressPct,
  getHackStatusText,
  getNode,
  HACK_MAX_RETRIES,
  HACK_SECURITY_ENABLED,
  HACK_REWARD_NODE_ID,
  HACK_START_NODE_ID,
  getStartPointerTarget,
  HACK_SECURITY_AUTO_RESET_MS,
  HACK_SUCCESS_DISMISS_MS,
  isHackRetriesExhausted,
  isHackSecurityFailure,
  isHackTimerExpired,
  isHackTimerTicking,
  isSelectableNeighbor,
  resetHack,
  resetHackAfterSecurityDeath,
  resetHackAfterTimerExpiry,
  navigateHackSelection,
  selectNodeByMouse,
  startHack,
  tickHackTimer,
} from "@/lib/console-hack/ConsoleHackGame.js";
import {
  formatHackTimer,
  HACK_TIMER_DEFAULT,
  parseHackTimer,
} from "@/lib/console-hack/ConsoleHackTimer.js";
import {
  HackAmmoIcon,
  HackClockIcon,
  HackCreditIcon,
  HackFlashbangIcon,
  HackGrenadeIcon,
  HackLockIcon,
  HackMedkitIcon,
  HackRifleIcon,
} from "@/components/console-hack/ConsoleHackIcons.jsx";
import { HackSecureChannelBars, HackStatusPulse } from "@/components/console-hack/ConsoleHackPulse.jsx";
import ConsoleHackGridArea from "@/components/console-hack/ConsoleHackGridArea.jsx";
import { HackNodeSelectedRing } from "@/components/console-hack/ConsoleHackNodeDecor.jsx";
import ConsoleHackTuneLine from "@/components/console-hack/ConsoleHackTuneLine.jsx";
import "./console-hack/ConsoleHackScreen.css";

const REWARD_ICONS = {
  credits: HackCreditIcon,
  ammo: HackAmmoIcon,
  rifleAmmo: HackRifleIcon,
  medkit: HackMedkitIcon,
  grenade: HackGrenadeIcon,
  flashbang: HackFlashbangIcon,
  rifle: HackRifleIcon,
};

const POTENTIAL_REWARD_ROWS = getHackPotentialRewardPreview().map((entry, index) => ({
  ...entry,
  iconId: `rewardIcon${index + 1}`,
  lineId: `rewardLine${index + 1}`,
  Icon: REWARD_ICONS[entry.key],
  text: `${entry.text} · ${Math.round(entry.chance * 100)}%`,
}));

const HACK_UI = {
  headerTitle: "NODE BREACH",
  headerSubtitle: "VX-27 CONTROL SYSTEM",
  status: "ACCESSING REWARD NODE",
  objectiveLines: ["> ROUTE POWER", "> BYPASS 3 SECURITY NODES"],
  objectiveCount: "0/3",
  rewardTitle: "SUPPLY CACHE",
  rewardSub: "RANDOM LOOT TABLE",
  timer: HACK_TIMER_DEFAULT,
  progressPct: 44,
  gridStart: "START",
  gridReward: "REWARD CACHE",
  nodeId: "VX-27-NODE-9A",
  secureChannel: "SECURE CHANNEL",
  rewardPreview: "REWARD PREVIEW",
  footer: [
    { id: "footerMove", keys: ["W", "A", "S", "D"], label: "SELECT" },
    { id: "footerConfirm", keys: ["SPACE"], label: "CONFIRM" },
    { id: "footerReset", keys: ["R"], label: "RESET" },
    { id: "footerEndHack", keys: ["H"], label: "End Hack" },
  ],
};

/**
 * @param {{
 *   open: boolean,
 *   layout?: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutTuning,
 *   panelId?: string | null,
 *   panelLabel?: string | null,
 *   onClose?: () => void,
 *   hackKeyCode?: string | string[],
 *   onHackDismiss?: (timerRemainingMs: number) => void,
 *   onHackComplete?: (rewards: import("@/lib/console-hack/ConsoleHackGame.js").HackRewards) => void,
 *   onHackFailed?: () => void,
 *   sounds?: {
 *     playHackDeath?: () => void,
 *     playHackConnect?: () => void,
 *     playSupplyPickup?: () => void,
 *   } | null,
 * }} props
 */
export default function ConsoleHackScreen({
  open,
  layout: layoutProp,
  panelId,
  panelLabel,
  onClose,
  hackKeyCode = "KeyH",
  onHackDismiss,
  onHackComplete,
  onHackFailed,
  sounds = null,
}) {
  const frameRef = useRef(null);
  const [layout, setLayout] = useState(() => layoutProp ?? loadConsoleHackLayout());
  const hackTimerTotalMs = useMemo(() => parseHackTimer(HACK_UI.timer), []);
  const [hackReady, setHackReady] = useState(false);
  const [gameState, setGameState] = useState(null);
  const completeHandledRef = useRef(false);
  const timerExpiredHandledRef = useRef(false);
  const securityFailureHandledRef = useRef(null);
  const hackTimerRafRef = useRef(0);
  const hackTimerLastRef = useRef(0);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const hackKeyMatches = useCallback(
    (code) => {
      if (Array.isArray(hackKeyCode)) return hackKeyCode.includes(code);
      return hackKeyCode === code;
    },
    [hackKeyCode]
  );

  useEffect(() => {
    if (layoutProp) setLayout(layoutProp);
  }, [layoutProp]);

  const gridArea = layout.gridArea;
  const { cols: gridCols, rows: gridRows } = getHackGridDimensions(gridArea);

  const beginHackSession = useCallback(() => {
    const seed = Math.floor(Math.random() * 0xffffffff);
    setGameState(
      startHack(
        createHackGameState({
          rows: gridRows,
          cols: gridCols,
          seed,
          timerMs: hackTimerTotalMs,
        })
      )
    );
    completeHandledRef.current = false;
    timerExpiredHandledRef.current = false;
    securityFailureHandledRef.current = null;
    hackTimerLastRef.current = performance.now();
  }, [gridCols, gridRows, hackTimerTotalMs]);

  const beginHackSessionRef = useRef(beginHackSession);
  beginHackSessionRef.current = beginHackSession;

  useEffect(() => {
    if (!open) {
      setHackReady(false);
      return undefined;
    }
    let cancelled = false;
    initConsoleHackBridge()
      .then(() => {
        if (cancelled) return;
        beginHackSessionRef.current();
        setHackReady(true);
      })
      .catch((err) => {
        console.error("Failed to load hack_core WASM", err);
      });
    return () => {
      cancelled = true;
      setHackReady(false);
    };
  }, [open]);

  const securityFailureKey =
    gameState &&
    isHackSecurityFailure(gameState) &&
    gameState.failureConnection
      ? `${gameState.failureConnection.fromId}:${gameState.failureConnection.toId}:${gameState.retriesUsed}`
      : null;

  const hackTimerTicking = gameState ? isHackTimerTicking(gameState) : false;

  useEffect(() => {
    if (!open || !hackTimerTicking) return undefined;

    const tick = (now) => {
      const delta = now - hackTimerLastRef.current;
      hackTimerLastRef.current = now;
      setGameState((prev) => (prev ? tickHackTimer(prev, delta) : prev));
      hackTimerRafRef.current = requestAnimationFrame(tick);
    };

    hackTimerLastRef.current = performance.now();
    hackTimerRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(hackTimerRafRef.current);
  }, [open, hackTimerTicking]);

  useEffect(() => {
    if (!gameState || gameState.status !== "complete" || completeHandledRef.current) return;
    completeHandledRef.current = true;
    onHackComplete?.(gameState.rewards);
  }, [gameState?.rewards, gameState?.status, onHackComplete]);

  useEffect(() => {
    if (!open || !gameState || gameState.status !== "complete") return undefined;
    const id = window.setTimeout(() => onClose?.(), HACK_SUCCESS_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [open, gameState?.status, onClose]);

  useEffect(() => {
    if (!securityFailureKey) return;
    if (securityFailureHandledRef.current === securityFailureKey) return;
    securityFailureHandledRef.current = securityFailureKey;
    sounds?.playHackDeath?.();
    const state = gameStateRef.current;
    if (state && isHackRetriesExhausted(state)) onHackFailed?.();
  }, [securityFailureKey, sounds, onHackFailed]);

  useEffect(() => {
    if (!gameState || !isHackTimerExpired(gameState) || timerExpiredHandledRef.current) return;
    timerExpiredHandledRef.current = true;
    sounds?.playHackDeath?.();
    if (isHackRetriesExhausted(gameState)) onHackFailed?.();
  }, [
    gameState?.failureKind,
    gameState?.retriesUsed,
    gameState?.status,
    sounds,
    onHackFailed,
  ]);

  useEffect(() => {
    if (!open || !securityFailureKey) return undefined;
    const state = gameStateRef.current;
    if (!state || isHackRetriesExhausted(state)) return undefined;

    const id = window.setTimeout(() => {
      securityFailureHandledRef.current = null;
      setGameState((prev) => (prev ? resetHackAfterSecurityDeath(prev) : prev));
      hackTimerLastRef.current = performance.now();
    }, HACK_SECURITY_AUTO_RESET_MS);

    return () => window.clearTimeout(id);
  }, [open, securityFailureKey]);

  useEffect(() => {
    if (!open || !gameState || !isHackTimerExpired(gameState)) return undefined;
    if (isHackRetriesExhausted(gameState)) return undefined;

    const id = window.setTimeout(() => {
      setGameState((prev) => (prev ? resetHackAfterTimerExpiry(prev) : prev));
      hackTimerLastRef.current = performance.now();
      timerExpiredHandledRef.current = false;
    }, HACK_SECURITY_AUTO_RESET_MS);

    return () => window.clearTimeout(id);
  }, [
    open,
    gameState?.failureKind,
    gameState?.retriesUsed,
    gameState?.status,
  ]);

  const hackTimerText = formatHackTimer(gameState?.timerRemainingMs ?? hackTimerTotalMs);
  const hackProgressPct = gameState ? getHackRouteProgressPct(gameState) : 0;
  const hackStatusText = gameState ? getHackStatusText(gameState) : HACK_UI.status;
  const hackObjectiveCount = gameState ? getHackObjectiveCount(gameState) : HACK_UI.objectiveCount;
  const showTimerExpiredOverlay =
    gameState != null &&
    isHackTimerExpired(gameState) &&
    isHackRetriesExhausted(gameState);
  const showRetriesExhaustedOverlay =
    gameState != null &&
    isHackRetriesExhausted(gameState) &&
    isHackSecurityFailure(gameState);
  const showSecurityFailure = gameState != null && isHackSecurityFailure(gameState);
  const showSuccessOverlay = gameState?.status === "complete";
  const showTerminalFailureOverlay =
    showTimerExpiredOverlay || showRetriesExhaustedOverlay;

  const handleFailureExit = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const grantedRewards =
    showSuccessOverlay && gameState
      ? formatHackGrantedRewards(gameState.rewards)
      : [];

  const handleReset = useCallback(() => {
    setGameState((prev) => {
      if (!prev) return prev;
      const seed = Math.floor(Math.random() * 0xffffffff);
      return resetHack({ ...prev, seed });
    });
    completeHandledRef.current = false;
    securityFailureHandledRef.current = null;
    hackTimerLastRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const state = gameStateRef.current;
      if (!state) return;

      if (hackKeyMatches(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        if (
          (!isHackTimerExpired(state) || isHackRetriesExhausted(state)) &&
          state.status !== "complete"
        ) {
          onHackDismiss?.(state.timerRemainingMs);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!isHackTimerExpired(state) || isHackRetriesExhausted(state)) {
          onClose?.();
        }
        return;
      }

      if (isHackTimerExpired(state) || isHackRetriesExhausted(state)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "r") {
        e.preventDefault();
        handleReset();
        return;
      }

      if (isHackSecurityFailure(state)) {
        return;
      }

      if (state.status === "complete") {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        setGameState((prev) => {
          if (!prev) return prev;
          const { state: next, event } = confirmSelectedNode(prev);
          if (event === "power_connected" || event === "walked_back") {
            sounds?.playHackConnect?.();
          }
          return next;
        });
        return;
      }
      if (e.code === "KeyW" || key === "w") {
        e.preventDefault();
        e.stopPropagation();
        setGameState((prev) => (prev ? navigateHackSelection(prev, "w") : prev));
      } else if (e.code === "KeyS" || key === "s") {
        e.preventDefault();
        e.stopPropagation();
        setGameState((prev) => (prev ? navigateHackSelection(prev, "s") : prev));
      } else if (e.code === "KeyA" || key === "a") {
        e.preventDefault();
        e.stopPropagation();
        setGameState((prev) => (prev ? navigateHackSelection(prev, "a") : prev));
      } else if (e.code === "KeyD" || key === "d") {
        e.preventDefault();
        e.stopPropagation();
        setGameState((prev) => (prev ? navigateHackSelection(prev, "d") : prev));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    open,
    onClose,
    onHackDismiss,
    hackKeyMatches,
    handleReset,
    sounds,
    onHackComplete,
  ]);

  const startNode = gameState ? getNode(gameState, HACK_START_NODE_ID) : null;
  const startIsActive = gameState?.activeNodeId === HACK_START_NODE_ID;
  const startIsSelected = gameState?.selectedNodeId === HACK_START_NODE_ID;
  const startPointerTarget =
    gameState?.status === "active" &&
    startIsActive &&
    startNode
      ? getStartPointerTarget(gameState)
      : null;
  const showStartPointer =
    startIsActive &&
    startPointerTarget != null &&
    startPointerTarget.id !== HACK_START_NODE_ID;
  const startSpriteTemplate = layout.nodeLive ?? { x: 0, y: 0 };
  const startPointerAngle =
    startPointerTarget != null && gridArea && layout.gridStartNode && startNode
      ? hackPointerRingAngleBetweenOverlay(
          hackConnectionNodeCenterInOverlay(
            startNode,
            gridArea,
            startSpriteTemplate,
            gridCols,
            gridRows,
            layout.gridStartNode,
            HACK_START_NODE_ID,
            layout.gridRewardCache,
            HACK_REWARD_NODE_ID
          ),
          hackConnectionNodeCenterInOverlay(
            startPointerTarget,
            gridArea,
            startSpriteTemplate,
            gridCols,
            gridRows,
            layout.gridStartNode,
            HACK_START_NODE_ID,
            layout.gridRewardCache,
            HACK_REWARD_NODE_ID
          )
        )
      : 0;
  const activeNode = gameState ? getNode(gameState, gameState.activeNodeId) : null;
  const lastColIsActive = activeNode?.col === gridCols - 1;
  const rewardNode = gameState ? getNode(gameState, HACK_REWARD_NODE_ID) : null;
  const rewardIsSelected = gameState?.selectedNodeId === HACK_REWARD_NODE_ID;
  const rewardIsSelectable =
    gameState?.status === "active" &&
    rewardNode != null &&
    isSelectableNeighbor(gameState, rewardNode);
  const tuneLineProps = useCallback(
    (id) => ({
      id,
      tune: layout[id],
    }),
    [layout]
  );

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
          <div className="consoleHackOverlay">
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
            <ConsoleHackTuneLine
              {...tuneLineProps("statusValue")}
              className={[
                "consoleHackValue",
                showSecurityFailure || showTimerExpiredOverlay || showRetriesExhaustedOverlay
                  ? "consoleHackValue--alert"
                  : "",
                gameState?.status === "complete" ? "consoleHackValue--success" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {hackStatusText}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine {...tuneLineProps("statusPulse")} className="consoleHackPulseLine">
              <HackStatusPulse animate />
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
            {HACK_SECURITY_ENABLED ? (
              <ConsoleHackTuneLine
                {...tuneLineProps("objectiveLine2")}
                className="consoleHackValue consoleHackValue--sub"
              >
                {HACK_UI.objectiveLines[1]}
              </ConsoleHackTuneLine>
            ) : null}
            <ConsoleHackTuneLine {...tuneLineProps("objectiveCount")} className="consoleHackValue">
              {hackObjectiveCount}
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
              TIMER ({gameState ? getHackRetriesLabel(gameState) : `0/${HACK_MAX_RETRIES}`})
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

            <ConsoleHackTuneLine
              {...tuneLineProps("gridStart")}
              className="consoleHackGridLabel consoleHackGridLabel--start"
            >
              {HACK_UI.gridStart}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("gridStartNode")}
              onClick={
                startIsActive
                  ? () =>
                      setGameState((prev) =>
                        prev ? selectNodeByMouse(prev, HACK_START_NODE_ID) : prev,
                      )
                  : undefined
              }
              className={[
                "consoleHackGridStartNode",
                gameState?.status === "active" && startIsSelected
                  ? "consoleHackGridStartNode--selected"
                  : "",
                startIsActive ? "consoleHackGridStartNode--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className="consoleHackNodeSprite__zapWrap"
                style={hackNodePulseTimingStyle(0)}
              >
                <span className="consoleHackNodeSprite__glow consoleHackNodeSprite__glow--start" aria-hidden="true" />
                <img
                  src={HACK_NODE_LIVE_SRC}
                  alt=""
                  className="consoleHackNodeSprite__img consoleHackNodeSprite__img--pulse"
                  draggable={false}
                />
              </span>
              {startIsSelected ? <HackNodeSelectedRing /> : null}
              {showStartPointer && startPointerTarget ? (
                <HackNodePointerRing angleDeg={startPointerAngle} />
              ) : null}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("gridReward")}
              className="consoleHackGridLabel consoleHackGridLabel--reward"
            >
              {HACK_UI.gridReward}
            </ConsoleHackTuneLine>
            <ConsoleHackTuneLine
              {...tuneLineProps("gridRewardCache")}
              onClick={
                rewardIsSelectable
                  ? () =>
                      setGameState((prev) =>
                        prev ? selectNodeByMouse(prev, HACK_REWARD_NODE_ID) : prev,
                      )
                  : undefined
              }
              className={[
                "consoleHackGridRewardCache",
                gameState?.status === "active" && rewardIsSelected
                  ? "consoleHackGridRewardCache--selected"
                  : "",
                lastColIsActive ? "consoleHackGridRewardCache--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className="consoleHackNodeSprite__zapWrap"
                style={hackNodePulseTimingStyle(5)}
              >
                <span className="consoleHackNodeSprite__glow" aria-hidden="true" />
                <img
                  src={HACK_REWARD_CACHE_SRC}
                  alt=""
                  className="consoleHackNodeSprite__img consoleHackNodeSprite__img--pulse"
                  draggable={false}
                />
              </span>
              {gameState?.status === "active" && rewardIsSelected ? <HackNodeSelectedRing /> : null}
            </ConsoleHackTuneLine>

            <ConsoleHackGridArea
              layout={layout}
              gridCols={gridCols}
              gridRows={gridRows}
              gameState={
                showTerminalFailureOverlay || !hackReady ? null : gameState
              }
              onSelectGameNode={(nodeId) => {
                setGameState((prev) => (prev ? selectNodeByMouse(prev, nodeId) : prev));
              }}
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
              <HackSecureChannelBars animate />
            </ConsoleHackTuneLine>

            <ConsoleHackTuneLine {...tuneLineProps("rewardPreviewLabel")} className="consoleHackLabel">
              {HACK_UI.rewardPreview}
            </ConsoleHackTuneLine>

            <div className="consoleHackRewardsGrid consoleHackRewardsGrid--tune">
              <ConsoleHackTuneLine
                {...tuneLineProps("rewardsLabel")}
                className="consoleHackLabel consoleHackRewardsGrid__label"
              >
                {showSuccessOverlay ? "GRANTED REWARDS" : "POTENTIAL REWARDS"}
              </ConsoleHackTuneLine>
              {(showSuccessOverlay ? grantedRewards : POTENTIAL_REWARD_ROWS).map((entry, index) => {
                const rowKey = showSuccessOverlay ? entry.key : entry.lineId;
                const text = entry.text;
                const Icon = showSuccessOverlay
                  ? REWARD_ICONS[entry.key]
                  : entry.Icon;
                const iconId = entry.iconId ?? `rewardIcon${index + 1}`;
                const lineId = entry.lineId ?? `rewardLine${index + 1}`;
                return (
                  <span
                    key={rowKey}
                    className={[
                      "consoleHackRewardRow",
                      showSuccessOverlay ? "consoleHackRewardRow--granted" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <ConsoleHackTuneLine
                      {...tuneLineProps(iconId)}
                      className="consoleHackIconLine consoleHackRewardIconLine"
                      aria-label={text}
                    >
                      <Icon className="consoleHackIcon consoleHackRewardIcon" />
                    </ConsoleHackTuneLine>
                    <ConsoleHackTuneLine
                      {...tuneLineProps(lineId)}
                      className={[
                        "consoleHackValue",
                        "consoleHackValue--list",
                        showSuccessOverlay ? "consoleHackValue--success" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {text}
                    </ConsoleHackTuneLine>
                  </span>
                );
              })}
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

          {showSuccessOverlay ? (
            <div className="consoleHackSuccessOverlay" role="status" aria-live="polite">
              <p className="consoleHackSuccessOverlayTitle">ACCESS GRANTED</p>
            </div>
          ) : null}
        </div>

        {showTimerExpiredOverlay ? (
          <button
            type="button"
            className="consoleHackTimerOverlay"
            role="alertdialog"
            aria-modal="true"
            aria-label="Time expired. Click to exit."
            onClick={handleFailureExit}
          >
            <p className="consoleHackTimerOverlayTitle">TIME EXPIRED</p>
            <p className="consoleHackTimerOverlaySub">
              Breach window closed — no retries remaining ({HACK_MAX_RETRIES}/{HACK_MAX_RETRIES})
            </p>
            <p className="consoleHackTimerOverlayHint">Click to exit</p>
          </button>
        ) : null}

        {showRetriesExhaustedOverlay ? (
          <button
            type="button"
            className="consoleHackTimerOverlay"
            role="alertdialog"
            aria-modal="true"
            aria-label="Retries exhausted. Click to exit."
            onClick={handleFailureExit}
          >
            <p className="consoleHackTimerOverlayTitle">RETRIES EXHAUSTED</p>
            <p className="consoleHackTimerOverlaySub">
              Security lockout — session terminated ({HACK_MAX_RETRIES}/{HACK_MAX_RETRIES})
            </p>
            <p className="consoleHackTimerOverlayHint">Click to exit</p>
          </button>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return backdrop;
  return createPortal(backdrop, document.body);
}
