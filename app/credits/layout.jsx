import { buildPageMetadata } from "@/lib/siteSeo";
import "./credits.css";

export const metadata = buildPageMetadata({
  title: "Credits",
  path: "/credits",
  description:
    "Credits for VX-27 — the tactical browser FPS built mostly solo by Carl Fearby. Soundtrack, art, code, and the people behind the exclusion zone.",
});

export default function CreditsLayout({ children }) {
  return children;
}
