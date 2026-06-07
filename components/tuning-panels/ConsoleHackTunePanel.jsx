"use client";

import { createPortal } from "react-dom";
import { useConsoleHackTunePanelDrag } from "@/components/console-hack/useConsoleHackTunePanelDrag.js";
import {
  applyConsoleHackLayoutFromJson,
  formatConsoleHackLayoutForCopy,
  HACK_ELEMENT_META,
  isHackGridAreaElement,
  isHackSpriteElement,
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
  const isSprite = selectedId ? isHackSpriteElement(selectedId) : false;
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
          className="consoleHackTuneClose"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
        >
          Close
        </button>
      </header>
      <p className="consoleHackTuneHint">
        Drag this panel header to reposition. Click a line, grid area, or node sprite to select it.
        Drag to move, drag the corner handle to resize.
      </p>

      <label className="consoleHackTuneField">
        <span>Element</span>
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value="">— select —</option>
          {Object.entries(HACK_ELEMENT_META).map(([id, m]) => (
            <option key={id} value={id}>
              {m.group}: {m.label}
            </option>
          ))}
        </select>
      </label>

      {el && meta ? (
        <div className="consoleHackTuneSection">
          <h3>{meta.label}</h3>
          <SliderField
            label={isSprite ? "X (center offset)" : "X"}
            value={el.x}
            min={isSprite ? -0.5 : 0}
            max={isSprite ? 0.5 : 1}
            step={0.001}
            onChange={(v) => onPatch(selectedId, { x: v })}
          />
          <SliderField
            label={isSprite ? "Y (center offset)" : "Y"}
            value={el.y}
            min={isSprite ? -0.5 : 0}
            max={isSprite ? 0.5 : 1}
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
              X/Y offset the icon center from the cell center (0 = centred). W/H are shared between live
              and dead. Image scale is per variant — use Dead node sprite to shrink dead icons.
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
