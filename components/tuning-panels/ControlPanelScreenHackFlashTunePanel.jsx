"use client";

import {
  CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS,
  CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MAX,
  CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MIN,
  CONTROL_PANEL_SCREEN_RED_BRIGHTNESS,
  saveControlPanelScreenGreenBrightness,
  saveControlPanelScreenRedBrightness,
} from "@/lib/control-panel/ControlPanelScreenCHackFlashTuning.js";

function BrightnessSlider({ label, value, onChange }) {
  return (
    <label className="sliderRow">
      <span className="sliderLabel">
        {label} <output>{value.toFixed(1)}</output>
      </span>
      <input
        type="range"
        min={CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MIN}
        max={CONTROL_PANEL_SCREEN_HACK_FLASH_BRIGHTNESS_MAX}
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

/**
 * @param {{
 *   previewOutcome: 'green' | 'red',
 *   onPreviewOutcomeChange: (outcome: 'green' | 'red') => void,
 *   greenBrightness: number,
 *   redBrightness: number,
 *   onGreenBrightnessChange: (value: number) => void,
 *   onRedBrightnessChange: (value: number) => void,
 *   onClose: () => void,
 * }} props
 */
export default function ControlPanelScreenHackFlashTunePanel({
  previewOutcome,
  onPreviewOutcomeChange,
  greenBrightness,
  redBrightness,
  onGreenBrightnessChange,
  onRedBrightnessChange,
  onClose,
}) {
  const handleGreenChange = (value) => {
    onGreenBrightnessChange(value);
    saveControlPanelScreenGreenBrightness(value);
    if (previewOutcome === "green") onPreviewOutcomeChange("green");
  };

  const handleRedChange = (value) => {
    onRedBrightnessChange(value);
    saveControlPanelScreenRedBrightness(value);
    if (previewOutcome === "red") onPreviewOutcomeChange("red");
  };

  return (
    <div
      className="hackFlashTunePanel"
      role="dialog"
      aria-label="Hack screen colour tuning"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="hackFlashTuneHeader">
        <span>Hack screen colours</span>
        <button
          type="button"
          className="tunePanelClose"
          onClick={onClose}
          aria-label="Close hack screen colours"
        >
          ×
        </button>
      </div>
      <p className="hackFlashTuneHint">
        Face a console to preview. Sliders update the nearest screen live.
      </p>
      <div className="hackFlashTunePreviewRow">
        <button
          type="button"
          className={`hackFlashTunePreviewBtn hackFlashTunePreviewBtn--green${
            previewOutcome === "green" ? " isActive" : ""
          }`}
          onClick={() => onPreviewOutcomeChange("green")}
        >
          Preview green
        </button>
        <button
          type="button"
          className={`hackFlashTunePreviewBtn hackFlashTunePreviewBtn--red${
            previewOutcome === "red" ? " isActive" : ""
          }`}
          onClick={() => onPreviewOutcomeChange("red")}
        >
          Preview red
        </button>
      </div>
      <BrightnessSlider
        label="Green brightness"
        value={greenBrightness}
        onChange={handleGreenChange}
      />
      <BrightnessSlider
        label="Red brightness"
        value={redBrightness}
        onChange={handleRedChange}
      />
      <button
        type="button"
        className="hudTuneReset"
        onClick={() => {
          handleGreenChange(CONTROL_PANEL_SCREEN_GREEN_BRIGHTNESS);
          handleRedChange(CONTROL_PANEL_SCREEN_RED_BRIGHTNESS);
        }}
      >
        Reset defaults
      </button>
    </div>
  );
}
