/**
 * Screenshot a local page — DEV TOOL.
 *
 * The county-map spec asks for a render to be handed back and looked at before
 * more is built on top of it. That review only means anything if the image
 * comes from the real component tree in a real browser, so this drives the
 * actual Vite dev server rather than mocking up what it would look like.
 *
 *   node tools/shot.mjs <url> <out.png> [width] [height] [dpr]
 */

import { chromium } from 'playwright';

const [url, out, w = '414', h = '896', dpr = '2'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: shot.mjs <url> <out.png> [width] [height] [dpr]');
  process.exit(2);
}

// PLAYWRIGHT_BROWSERS_PATH points at a preinstalled Chromium. Its revision
// only lines up with the playwright package by luck, so fall back to the
// binary on disk rather than trying to download one — this environment blocks
// browser downloads on purpose.
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ executablePath: PREINSTALLED }));
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: Number(dpr),
});

const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(String(e)));
// A missing sprite must not pass silently as an empty rectangle — the whole
// point of the render is to see what is actually there.
page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() =>
  Promise.all(
    [...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {})),
  ),
);
await page.waitForTimeout(400);
await page.screenshot({ path: out, fullPage: false });
await browser.close();

console.log(`wrote ${out}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of [...new Set(problems)].slice(0, 20)) console.error(`  ${p}`);
  process.exitCode = 1;
}
