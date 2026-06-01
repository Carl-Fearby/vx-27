import {
  absoluteUrl,
  AUTHOR,
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/siteSeo";

export default function MarketingJsonLd() {
  const poster = absoluteUrl("/ui/vx-27poster.webp");
  const gameUrl = absoluteUrl("/game");

  const graph = [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      inLanguage: "en-GB",
      publisher: { "@id": `${SITE_URL}/#person` },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: DEFAULT_DESCRIPTION,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#videogame` },
      inLanguage: "en-GB",
    },
    {
      "@type": "VideoGame",
      "@id": `${SITE_URL}/#videogame`,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      url: gameUrl,
      image: poster,
      genre: ["First-person shooter", "Science fiction", "Tactical shooter"],
      gamePlatform: ["Web browser"],
      applicationCategory: "Game",
      operatingSystem: "Any",
      playMode: "SinglePlayer",
      inLanguage: "en-GB",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
        url: gameUrl,
      },
      author: { "@id": `${SITE_URL}/#person` },
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: AUTHOR.name,
      email: AUTHOR.email,
      url: SITE_URL,
      jobTitle: "Game developer",
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
