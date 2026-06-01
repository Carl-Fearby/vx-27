import { Orbitron } from "next/font/google";
import "./marketing.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-futuristic",
  display: "swap",
});

export const metadata = {
  title: "VX-27 — The experiment is still running.",
  description:
    "A tactical sci-fi FPS built mostly solo — looking for collaborators who want to make games for fun. Play the prototype or join the build.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={orbitron.variable}>
      <body>{children}</body>
    </html>
  );
}
