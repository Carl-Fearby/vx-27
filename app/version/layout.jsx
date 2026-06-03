import { buildPageMetadata } from "@/lib/site/siteSeo";

export const metadata = buildPageMetadata({
  title: "Version",
  path: "/version",
  description: "Build version and release history for the VX-27 site.",
  noindex: true,
});

export default function VersionLayout({ children }) {
  return children;
}
