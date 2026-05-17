// Rendert App-Store-Screenshots (3 Slides × 2 Devices = 6 PNGs)
// via Headless Chromium aus template.html.
//
// Voraussetzung: playwright im npm-Install-Pfad.
// Output: scripts/asc-screenshots/output/<device>-<slide>.png
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = "file://" + path.resolve(__dirname, "template.html").replace(/\\/g, "/");
const OUT = path.resolve(__dirname, "output");

const DEVICES = [
  { name: "iphone69", w: 1290, h: 2796 },
  { name: "ipadpro129", w: 2048, h: 2732 },
];
const SLIDES = ["1", "2", "3"];

const browser = await chromium.launch();
for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  for (const s of SLIDES) {
    const url = `${TEMPLATE}?device=${d.name}&slide=${s}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const file = path.join(OUT, `${d.name}-${s}.png`);
    await page.screenshot({ path: file, fullPage: false, omitBackground: false, type: "png" });
    console.log(`✓ ${file}`);
  }
  await ctx.close();
}
await browser.close();
