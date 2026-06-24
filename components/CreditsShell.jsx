"use client";

import dynamic from "next/dynamic";

const CreditsScene = dynamic(() => import("@/components/CreditsScene"), {
  ssr: false,
  loading: () => (
    <div className="creditsBoot" aria-live="polite">
      <p className="creditsBootLabel">Loading credits…</p>
    </div>
  ),
});

export default function CreditsShell() {
  return <CreditsScene />;
}
