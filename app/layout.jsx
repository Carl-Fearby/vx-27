import { Orbitron } from "next/font/google";
import "./marketing.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-futuristic",
  display: "swap",
});

export const metadata = {
  title: "VX-27 — Tactical Arena FPS",
  description:
    "Browser-based first-person combat. Clear the arena, stack the barrels, survive the catwalk.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={orbitron.variable}>
      <body>{children}</body>
    </html>
  );
}
