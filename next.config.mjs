import { execSync, spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

spawnSync("node", ["scripts/generate-version-history.mjs"], {
  cwd: __dirname,
  stdio: "inherit",
});

function gitValue(args) {
  try {
    return execSync(`git ${args}`, { cwd: __dirname, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const pkg = JSON.parse(
  readFileSync(path.join(__dirname, "package.json"), "utf8")
);
const threePath = path.resolve(__dirname, "node_modules/three");
/** Turbopack treats alias values as project-relative paths — not absolute. */
const threeTurbopackAlias = "./node_modules/three";

/** Keep Next build output out of Dropbox-synced .next (webpack pack cache corrupts there). */
const distDir = path.join("node_modules", ".cache", "next");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  distDir,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_GIT_SHA: gitValue("rev-parse --short HEAD") || "dev",
    NEXT_PUBLIC_GIT_BRANCH: gitValue("rev-parse --abbrev-ref HEAD") || "local",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  ...(process.env.STATIC_EXPORT === "1"
    ? { output: "export", images: { unoptimized: true } }
    : {}),
  transpilePackages: ["three"],
  async redirects() {
    return [
      { source: "/game/credits", destination: "/credits", permanent: true },
    ];
  },
  turbopack: {
    resolveAlias: {
      three: threeTurbopackAlias,
    },
  },
  webpack: (config, { dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      three: threePath,
    };
    // Avoid writing webpack pack files to disk in dev — Dropbox/HMR often corrupts them.
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
