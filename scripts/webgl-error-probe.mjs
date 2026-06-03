/**
 * Capture WebGL console errors after full game load + start.
 */
import { chromium } from "playwright";

const url = process.argv.find((a) => a.startsWith("http")) ?? "https://localhost:3000/game";
const beforeClick = [];
const afterClick = [];
let clicked = false;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--ignore-certificate-errors", "--use-angle=metal"],
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });

page.on("console", (msg) => {
  const text = msg.text();
  if (!text.includes("Mismatch")) return;
  (clicked ? afterClick : beforeClick).push(text);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
console.log("Waiting for Start Game button (GPU warmup)...");
await page.waitForSelector(".loadingStartBtn", { timeout: 180000 });
console.log("Warmup done. Before-click mismatches:", beforeClick.length);
clicked = true;
await page.click(".loadingStartBtn");
await page.waitForTimeout(4000);
console.log("After-click mismatches:", afterClick.length, "total:", beforeClick.length + afterClick.length);

await browser.close();
