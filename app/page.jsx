import MarketingSite from "@/components/MarketingSite";
import MarketingJsonLd from "@/components/MarketingJsonLd";
import { buildPageMetadata } from "@/lib/siteSeo";

export const metadata = buildPageMetadata({
  path: "/",
  description:
    "VX-27 is a free tactical sci-fi FPS in your browser — enter a sealed exclusion zone, survive automated defences and rogue contractors, and uncover a classified weapons programme. Play the prototype or join the solo build.",
});

export default function Home() {
  return (
    <>
      <MarketingJsonLd />
      <MarketingSite />
    </>
  );
}
