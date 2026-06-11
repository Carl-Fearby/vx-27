"use client";

import { createPortal } from "react-dom";
import {
  DEFAULT_HUD_BOTTOM_BAR_TUNING,
  formatHudBottomBarTuningForCopy,
  saveHudBottomBarTuning,
} from "@/lib/ui/HudBottomBarTuning";

function clampNum(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function SliderField({ label, value, min, max, step, onChange }) {
  const decimals = step < 0.1 ? 2 : 1;
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
 *   tuning: import("@/lib/ui/HudBottomBarTuning.js").HudBottomBarTuning,
 *   onChange: (next: import("@/lib/ui/HudBottomBarTuning.js").HudBottomBarTuning) => void,
 *   onClose?: () => void,
 * }} props
 */
export default function HudBottomBarTunePanel({ tuning, onChange, onClose }) {
  const patch = (partial) => onChange({ ...tuning, ...partial });

  const panel = (
    <aside
      className="weaponTunePanel hudBottomBarTunePanel"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="weaponTunePanelHeader">
        <div className="tunePanelHeader">
          <strong>Ammo HUD layout</strong>
          {onClose ? (
            <button
              type="button"
              className="tunePanelClose"
              aria-label="Close ammo HUD layout"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="weaponTunePanelScroll">
        <p className="settingsHint">ROUNDS · MAG · MAGS positions (% of bar width).</p>
        <SliderField label="Bar scale" value={tuning.barScale} min={0.25} max={1.5} step={0.01} onChange={(barScale) => patch({ barScale })} />
        <SliderField label="Value font (vw)" value={tuning.valueFont} min={1} max={6} step={0.01} onChange={(valueFont) => patch({ valueFont })} />
        <SliderField label="Label scale" value={tuning.labelScale} min={0.5} max={2} step={0.05} onChange={(labelScale) => patch({ labelScale })} />
        <SliderField label="Label Y (px)" value={tuning.labelY} min={-20} max={30} step={1} onChange={(labelY) => patch({ labelY })} />
        <SliderField label="Rounds X" value={tuning.roundsX} min={10} max={50} step={0.5} onChange={(roundsX) => patch({ roundsX })} />
        <SliderField label="Rounds Y" value={tuning.roundsY} min={0} max={40} step={0.5} onChange={(roundsY) => patch({ roundsY })} />
        <SliderField label="Mag X" value={tuning.magX} min={20} max={60} step={0.5} onChange={(magX) => patch({ magX })} />
        <SliderField label="Mag Y" value={tuning.magY} min={0} max={40} step={0.5} onChange={(magY) => patch({ magY })} />
        <SliderField label="Mags X" value={tuning.magsX} min={30} max={70} step={0.5} onChange={(magsX) => patch({ magsX })} />
        <SliderField label="Mags Y" value={tuning.magsY} min={0} max={40} step={0.5} onChange={(magsY) => patch({ magsY })} />
        <p className="settingsHint">Fire-mode carousel (right HUD slot).</p>
        <SliderField label="Fire X" value={tuning.fireCarouselX} min={55} max={95} step={0.5} onChange={(fireCarouselX) => patch({ fireCarouselX })} />
        <SliderField label="Fire Y" value={tuning.fireCarouselY} min={0} max={40} step={0.5} onChange={(fireCarouselY) => patch({ fireCarouselY })} />
        <SliderField label="Fire scale" value={tuning.fireCarouselScale} min={0.6} max={3.5} step={0.05} onChange={(fireCarouselScale) => patch({ fireCarouselScale })} />
        <SliderField label="Cog X" value={tuning.cogX} min={0} max={20} step={0.5} onChange={(cogX) => patch({ cogX })} />
        <SliderField label="Cog Y" value={tuning.cogY} min={0} max={60} step={0.5} onChange={(cogY) => patch({ cogY })} />
        <SliderField label="Cog size" value={tuning.cogSize} min={4} max={16} step={0.5} onChange={(cogSize) => patch({ cogSize })} />
      </div>
      <div className="weaponTunePanelFooter">
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            const next = { ...DEFAULT_HUD_BOTTOM_BAR_TUNING };
            onChange(next);
            saveHudBottomBarTuning(next);
          }}
        >
          Reset defaults
        </button>
        <button
          type="button"
          className="settingsBtn settingsInlineBtn"
          onClick={() => {
            navigator.clipboard?.writeText(formatHudBottomBarTuningForCopy(tuning));
          }}
        >
          Copy JSON
        </button>
      </div>
    </aside>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}
