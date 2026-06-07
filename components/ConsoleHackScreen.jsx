"use client";

/**
 * Full-screen console hack UI — logic TBD; opens from nearby control panels (H key).
 */
export default function ConsoleHackScreen({ open, panelId, panelLabel, onClose }) {
  if (!open) return null;

  const title = panelLabel ?? (panelId ? `Console ${panelId}` : "Control console");

  return (
    <div
      className="settingsBackdrop consoleHackBackdrop"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <div
        className="settingsModal consoleHackModal"
        role="dialog"
        aria-labelledby="console-hack-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settingsHeader">
          <h2 id="console-hack-title">{title}</h2>
          <button type="button" className="settingsClose" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="settingsBody">
          <p className="settingsHint" style={{ marginTop: 0 }}>
            Hack interface — logic coming soon.
          </p>
          <p className="settingsHint">
            Press <strong>Esc</strong> or click outside to disconnect.
          </p>
        </div>
      </div>
    </div>
  );
}
