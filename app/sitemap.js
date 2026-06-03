import { absoluteUrl } from "@/lib/site/siteSeo";

export const dynamic = "force-static";

export default function sitemap() {
  const now = new Date();
  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/game"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/credits"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/version"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
  ];
}
