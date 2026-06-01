import { buildPageMetadata } from "@/lib/siteSeo";
import "../globals.css";

export const metadata = buildPageMetadata({
  title: "Play",
  path: "/game",
  description:
    "Play VX-27 free in your browser — pointer-lock FPS with sprint, crouch, iron sights, weapon torch, grenades, and industrial sci-fi combat. No install required.",
});

export default function GameLayout({ children }) {
  return children;
}
