/** Sci-fi HUD icons for the NODE BREACH console — use currentColor for tuning. */

export function HackClockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.15" />
      <path
        d="M8 5.2V8.5l2.4 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 2.5V3.6M8 13.4V14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function HackLockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="3.25"
        y="7.25"
        width="9.5"
        height="6.5"
        rx="1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <path
        d="M5.4 7.25V5.6a2.6 2.6 0 0 1 5.2 0V7.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle cx="8" cy="10.5" r="0.85" fill="currentColor" />
      <path
        d="M8 11.35V12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** HUD bullet profile — matches `/ui/bullet.webp`. */
export function HackAmmoIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6.1 8.1h3.8v5.1c0 .55-.45 1-1 1H7.1c-.55 0-1-.45-1-1V8.1Z"
        fill="currentColor"
      />
      <path
        d="M6.4 8.1 8 2.8l1.6 5.3H6.4Z"
        fill="currentColor"
      />
      <path
        d="M6.8 9.2h2.4"
        stroke="rgba(0,0,0,0.28)"
        strokeWidth="0.55"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Medkit case — cross heal pickup readout. */
export function HackMedkitIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <rect
        x="3.2"
        y="4.4"
        width="9.6"
        height="8.8"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M8 6.1v5.4M5.3 8.8h5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M3.8 5.2h1.1M11.1 5.2h1.1"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** Jagged strike bolt — overlays live grid nodes on occasional zap hits. */
export function HackLightningBoltIcon({ className, style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 32"
      aria-hidden="true"
    >
      <path
        d="M14.4 0 6.2 14.8h4.5L3.8 32l12.6-17.4H11.8L19.2 0Z"
        fill="rgba(210, 245, 255, 0.35)"
        stroke="rgba(120, 220, 255, 0.55)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path
        d="M13.6 2.2 7.4 14.2h3.4L5.6 28.8l10.2-14.4H12.4L17.4 2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Credit chip — stylised $ badge for reward credits. */
export function HackCreditIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.1" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M9.35 4.1H7.25c-1.05 0-1.85.72-1.85 1.62 0 .78.5 1.28 1.45 1.5 1.15.25 1.55.72 1.55 1.48 0 .9-.82 1.62-1.9 1.62H5.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 4.1v8.1" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
    </svg>
  );
}
