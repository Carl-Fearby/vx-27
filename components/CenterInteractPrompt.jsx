"use client";

/**
 * Single center-screen prompt for door interact, hack, cooldowns, and contextual hints.
 * Content is driven imperatively from the game loop via centerInteractPromptRef.
 */
export default function CenterInteractPrompt({ promptRef }) {
  return (
    <div
      ref={promptRef}
      className="centerInteractPrompt"
      role="status"
      aria-live="polite"
      aria-hidden="true"
    />
  );
}
