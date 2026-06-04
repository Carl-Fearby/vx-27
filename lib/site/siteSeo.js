/** Shared SEO constants — used by metadata, sitemap, robots, and JSON-LD. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://vx-27.com";

export const SITE_NAME = "VX-27";
export const SITE_TAGLINE = "The experiment is still running.";

export const DEFAULT_DESCRIPTION =
  "VX-27 is a free tactical sci-fi FPS you play in your browser — rusted steel, burning oil barrels, automated defences, and a classified weapons programme that never shut down. Hole falls, combat death vocals, and load-screen GPU preload. Solo-built prototype; collaborators welcome.";

export const OG_IMAGE = {
  url: "/ui/vx-27poster.webp",
  width: 1055,
  height: 1491,
  alt: "VX-27 promotional poster — Vektor Dynamics tactical sci-fi FPS",
};

export const KEYWORDS = [
  "VX-27",
  "browser FPS",
  "browser game",
  "free web game",
  "sci-fi shooter",
  "tactical FPS",
  "Three.js game",
  "WebGL game",
  "industrial shooter",
  "play FPS in browser",
  "indie game",
  "game development collaboration",
  "Carl Fearby",
];

export const AUTHOR = {
  name: "Carl Fearby",
  email: "carlfearby@me.com",
};

export function absoluteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`;
}

/** @param {import("next").Metadata} overrides */
export function buildPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  noindex = false,
}) {
  const canonical = absoluteUrl(path);
  const pageTitle = title ?? `${SITE_NAME} — ${SITE_TAGLINE}`;
  const ogTitle = title ? `${title} — ${SITE_NAME}` : pageTitle;

  return {
    title: pageTitle,
    description,
    keywords: KEYWORDS,
    authors: [{ name: AUTHOR.name, url: SITE_URL }],
    creator: AUTHOR.name,
    publisher: AUTHOR.name,
    category: "games",
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url: canonical,
      siteName: SITE_NAME,
      title: ogTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [OG_IMAGE.url],
    },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };
}
