import { buildPageMetadata } from "@/lib/site/siteSeo";
import "../credits/credits.css";
import "./music.css";

export const metadata = buildPageMetadata({
  title: "Soundtrack",
  path: "/music",
  description:
    "Listen to the VX-27 original soundtrack — Galactic Drifter loading theme and in-game combat mix. Browser player with live audio visualizer.",
});

export default function MusicLayout({ children }) {
  return children;
}
