"use client";

import { createPortal } from "react-dom";
import { useConsoleHackTunePanelDrag } from "@/components/console-hack/useConsoleHackTunePanelDrag.js";
import {
  applyConsoleHackLayoutFromJson,
  formatConsoleHackLayoutForCopy,
  HACK_ELEMENT_META,
  isHackGridAreaElement,
  isHackGridMarkerElement,
  isHackMarkerOrSpriteElement,
  resetConsoleHackElement,
  resetConsoleHackLayout,
} from "@/lib/console-hack/ConsoleHackLayoutTuning.js";

function ColorField({ label, value, onChange }) {
  const hex =
    /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#9ee8ff";
  return (
    <label className="consoleHackTuneField">
      <span>{label}</span>
      <span className="consoleHackTuneColorRow">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="consoleHackTuneText"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </span>
    </label>
  );
}

function clampNum(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function SliderField({ label, value, min, max, step, onChange }) {
  const decimals = step < 0.01 ? 4 : step < 0.1 ? 2 : 3;
  const apply = (v) => onChange(clampNum(v, min, max));
  const display = parseFloat(Number(value).toFixed(decimals));

  return (
    <div className="poseControl">
      <span className="sliderLabel">
        {label} <output>{display.toFixed(decimals)}</output>
      </span>
      <input
        type="range"
        className="poseRange"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => apply(Number(e.target.value))}
      />
      <input
        type="number"
        className="poseNumber"
        min={min}
        max={max}
        step={step}
        value={display}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!Number.isNaN(parsed)) apply(parsed);
        }}
      />
    </div>
  );
}

/**
 * @param {{
 *   selectedId: string | null,
 *   layout: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutTuning,
 *   onSelect: (id: string | null) => void,
 *   onPatch: (id: string, patch: Partial<import("@/lib/console-hack/ConsoleHackLayoutTuning.js").HackElementTune>) => void,
 *   onLayoutReplace: (layout: import("@/lib/console-hack/ConsoleHackLayoutTuning.js").ConsoleHackLayoutTuning) => void,
 *   onClose: () => void,
 * }} props
 */
export default function ConsoleHackTunePanel({
  selectedId,
  layout,
  onSelect,
  onPatch,
  onLayoutReplace,
  onClose,
}) {
  const el = selectedId ? layout[selectedId] : null;
  const meta = selectedId ? HACK_ELEMENT_META[selectedId] : null;
  const isSprite = selectedId ? isHackMarkerOrSpriteElement(selectedId) : false;
  const isGridMarker = selectedId ? isHackGridMarkerElement(selectedId) : false;
  const isCellSprite = isSprite && !isGridMarker;
  const isGridArea = selectedId ? isHackGridAreaElement(selectedId) : false;
  const isTextElement = el && meta && !isSprite && !isGridArea;

  const copyJson = async () => {
    const text = formatConsoleHackLayoutForCopy(layout);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy layout JSON:", text);
    }
  };

  const importJson = () => {
    const text = window.prompt("Paste layout JSON:");
    if (!text?.trim()) return;
    try {
      onLayoutReplace(applyConsoleHackLayoutFromJson(text));
      onSelect(null);
    } catch {
      window.alert("Could not import layout JSON. Check the format and try again.");
    }
  };

  const { panelRef, panelStyle, startPanelDrag, dragging } = useConsoleHackTunePanelDrag();

  const panel = (
    <aside
      ref={panelRef}
      className={[
        "consoleHackTunePanel",
        "weaponTunePanel",
        dragging ? "consoleHackTunePanel--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={panelStyle}
      role="dialog"
      aria-label="Console hack layout wizard"
    >
      <header
        className="consoleHackTunePanelHead consoleHackTunePanelHead--draggable"
        onMouseDown={startPanelDrag}
      >
        <h2>Console layout wizard</h2>
        <button
          type="button"
          className="tunePanelClose"
          aria-label="Close console layout wizard"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      </header>
      <p className="consoleHackTuneHint">
        Drag this panel header to reposition. Click a line, grid area, START/reward markers, or node sprite to select it.
        Drag to move, drag the corner handle to resize.
      </p>

      <label className="consoleHackTuneField">
        <span>Element</span>
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value="">— select —</option>
          {Object.entries(
            Object.entries(HACK_ELEMENT_META).reduce((groups, [id, m]) => {
              (groups[m.group] ??= []).push([id, m]);
              return groups;
            }, /** @type {Record<string, [string, { label: string, group: string }][]>} */ ({}))
          ).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map(([id, m]) => (
                <option key={id} value={id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {el && meta ? (
        <div className="consoleHackTuneSection">
          <h3>{meta.label}</h3>
          <SliderField
            label={isCellSprite ? "X (center offset)" : "X"}
            value={el.x}
            min={isCellSprite ? -0.5 : 0}
            max={isCellSprite ? 0.5 : 1}
            step={0.001}
            onChange={(v) => onPatch(selectedId, { x: v })}
          />
          <SliderField
            label={isCellSprite ? "Y (center offset)" : "Y"}
            value={el.y}
            min={isCellSprite ? -0.5 : 0}
            max={isCellSprite ? 0.5 : 1}
            step={0.001}
            onChange={(v) => onPatch(selectedId, { y: v })}
          />
          <SliderField label="Width" value={el.w} min={0.01} max={1} step={0.001} onChange={(v) => onPatch(selectedId, { w: v })} />
          <SliderField label="Height" value={el.h} min={0.01} max={1} step={0.001} onChange={(v) => onPatch(selectedId, { h: v })} />
          <SliderField
            label={isSprite ? "Image scale" : "Font scale"}
            value={el.fontScale}
            min={0.25}
            max={3}
            step={0.05}
            onChange={(v) => onPatch(selectedId, { fontScale: v })}
          />
          {isGridArea ? (
            <>
              <SliderField
                label="Grid columns"
                value={el.gridCols ?? 5}
                min={2}
                max={12}
                step={1}
                onChange={(v) => onPatch(selectedId, { gridCols: Math.round(v) })}
              />
              <SliderField
                label="Grid rows"
                value={el.gridRows ?? 3}
                min={2}
                max={8}
                step={1}
                onChange={(v) => onPatch(selectedId, { gridRows: Math.round(v) })}
              />
            </>
          ) : null}
          {isTextElement ? (
            <>
              <ColorField label="Label colour" value={el.labelColor} onChange={(v) => onPatch(selectedId, { labelColor: v })} />
              <ColorField label="Value colour" value={el.valueColor} onChange={(v) => onPatch(selectedId, { valueColor: v })} />
              <ColorField label="Accent colour" value={el.accentColor} onChange={(v) => onPatch(selectedId, { accentColor: v })} />
            </>
          ) : null}
          {isSprite ? (
            <p className="consoleHackTuneHint">
              {selectedId === "gridStartNode" || selectedId === "gridRewardCache"
                ? "Drag to reposition the flanking marker. W/H set the tune box; image scale sizes the sprite inside it."
                : "X/Y offset the icon center from the cell center (0 = centred). W/H are shared between live and dead. Image scale is per variant — use Dead node sprite to shrink dead icons."}
            </p>
          ) : null}
          <button
            type="button"
            className="consoleHackTuneBtn"
            onClick={() => onLayoutReplace(resetConsoleHackElement(layout, selectedId))}
          >
            Reset this element
          </button>
        </div>
      ) : null}

      <div className="consoleHackTuneActions">
        <button type="button" className="consoleHackTuneBtn" onClick={copyJson}>
          Copy layout JSON
        </button>
        <button type="button" className="consoleHackTuneBtn" onClick={importJson}>
          Import layout JSON
        </button>
        <button
          type="button"
          className="consoleHackTuneBtn consoleHackTuneBtn--danger"
          onClick={() => {
            onLayoutReplace(resetConsoleHackLayout());
            onSelect(null);
          }}
        >
          Reset all
        </button>
      </div>
    </aside>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
