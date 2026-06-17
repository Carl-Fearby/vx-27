import { spawn } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync, spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cargoBin = path.join(process.env.HOME ?? "", ".cargo", "bin");
const devEnv = {
  ...process.env,
  PATH: [cargoBin, process.env.PATH].filter(Boolean).join(path.delimiter),
};
const args = process.argv.slice(2);
const reset = args.includes("--reset");
const useTurbo = args.includes("--turbo");
const useWebpack = args.includes("--webpack") || !useTurbo;
const useHttp = args.includes("--http");
const skipWasmWatch = args.includes("--no-wasm-watch");
// Turbopack HMR breaks on wasm-bindgen .wasm assets (especially when cargo-watch rebuilds).
const devArgs = useTurbo ? ["--turbo"] : [];

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), "SIGKILL");
        console.log(`killed pid ${pid} on :${port}`);
      } catch {
        // already gone
      }
    }
  } catch {
    // nothing listening
  }
}

if (reset) {
  killPort(3000);
  killPort(3001);
  for (const dir of [
    path.join(root, ".next"),
    path.join(root, "node_modules", ".cache", "next"),
  ]) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.log(`removed ${path.relative(root, dir)}`);
    }
  }
}

spawnSync("node", ["scripts/generate-version-history.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: devEnv,
});

function commandWorks(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "ignore",
    env: devEnv,
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

function spawnWasmWatcher(label, crateDir) {
  const child = spawn(
    "cargo",
    [
      "watch",
      "--workdir",
      crateDir,
      "--watch",
      "src",
      "-s",
      "wasm-pack build . --target web --out-dir pkg",
    ],
    {
      cwd: root,
      stdio: "inherit",
      env: devEnv,
      shell: process.platform === "win32",
    }
  );

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code == null && signal == null) return;
    console.warn(`[wasm:${label}] watcher exited`, { code, signal });
  });

  return child;
}

const wasmWatchers = [];
let shuttingDown = false;
if (!skipWasmWatch) {
  const hasCargoWatch = commandWorks("cargo", ["watch", "--version"]);
  const hasWasmPack = commandWorks("wasm-pack", ["--version"]);
  if (useTurbo) {
    console.warn(
      "Turbopack dev cannot HMR wasm-bindgen .wasm files — use webpack (default) or pass --no-wasm-watch with --turbo."
    );
  } else if (hasCargoWatch && hasWasmPack) {
    console.log("Starting Rust/WASM watchers (use --no-wasm-watch to skip)");
    wasmWatchers.push(spawnWasmWatcher("hack", "rust/hack_core"));
    wasmWatchers.push(spawnWasmWatcher("game", "rust/game_core"));
  } else {
    console.warn(
      "Skipping Rust/WASM watchers: install with `cargo install cargo-watch` and ensure `wasm-pack` is on PATH."
    );
  }
}

const nextArgs = ["dev", ...devArgs];
if (!useHttp) {
  nextArgs.push("--experimental-https");
}

if (!useHttp) {
  console.log("Starting dev server at https://localhost:3000 (use --http for plain HTTP)");
}
if (useWebpack) {
  console.log("Dev bundler: webpack (default — required for RUSH/WASM). Pass --turbo to opt into Turbopack.");
} else {
  console.log("Dev bundler: Turbopack (--turbo). WASM hot reload is unsupported; prefer webpack.");
}

const child = spawn("next", nextArgs, {
  cwd: root,
  stdio: "inherit",
  env: devEnv,
  shell: process.platform === "win32",
});

function stopChildren() {
  shuttingDown = true;
  for (const watcher of wasmWatchers) {
    if (!watcher.killed) watcher.kill("SIGTERM");
  }
  if (!child.killed) child.kill("SIGTERM");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopChildren();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

child.on("exit", (code) => {
  stopChildren();
  process.exit(code ?? 0);
});
