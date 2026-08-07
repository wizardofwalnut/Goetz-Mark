/**
 * Open the town-centre labor screen and drive it — DEV TOOL.
 *
 *   node tools/shoot-town.mjs playtest/aldermarch-game.html docs/
 *
 * Runs the real page from file:// with the network hard-blocked, opens each
 * county's town centre, exercises a stepper, and screenshots the result. Any
 * request that escapes the page is a failure: the whole promise of this build
 * is that it works with nothing behind it.
 *
 * Drives rather than just looks, because a screen can render perfectly and
 * still be wired to nothing — the stepper assertions are what catch that.
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const FILE = resolve(process.argv[2] ?? 'playtest/aldermarch-game.html');
const OUT = process.argv[3] ?? 'docs';
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ executablePath: PREINSTALLED }));
const page = await browser.newPage({
  viewport: { width: 900, height: 980 },
  deviceScaleFactor: 2,
});

const problems = [];
const escaped = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(String(e)));
await page.route('**/*', (r) => {
  const u = r.request().url();
  if (u.startsWith('file://') || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
  escaped.push(u);
  return r.abort();
});

await page.goto(`file://${FILE}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('.ov-map image').length > 4, {
  timeout: 25000,
});
await page.waitForTimeout(800);

/** Open a county's town centre. Matches on the town title, not the county name
 *  alone — the castle sprite's title also starts with the county name and has
 *  no click handler, so a looser match silently opens nothing. */
const openTown = (name) =>
  page.evaluate((n) => {
    const t = [...document.querySelectorAll('.ov-map image title')].find(
      (x) => x.textContent.startsWith(n) && /town centre/i.test(x.textContent),
    );
    if (!t) return false;
    t.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, name);

const tapPlot = (label) =>
  page.evaluate((l) => {
    const t = [...document.querySelectorAll('.ov-plan title')].find((x) =>
      x.textContent.startsWith(l),
    );
    if (!t) return false;
    t.parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, label);

const state = () =>
  page.evaluate(() => ({
    count: document.querySelector('.ov-town-count')?.textContent ?? null,
    idle: document.querySelector('.ov-idle-pill')?.textContent ?? null,
    plots: [...document.querySelectorAll('.ov-plan title')].map((t) => t.textContent),
  }));

const counties = await page.evaluate(() =>
  [...document.querySelectorAll('.ov-map image title')]
    .filter((t) => /town centre/i.test(t.textContent))
    .map((t) => t.textContent.split(' town centre')[0]),
);
console.log(`towns: ${counties.join(', ')}`);

let failed = false;
for (const [i, name] of counties.entries()) {
  if (!(await openTown(name))) continue;
  await page.waitForTimeout(700);
  const s = await state();
  console.log(`\n${name}: ${s.idle}`);
  for (const p of s.plots) console.log(`    ${p}`);
  await page.screenshot({ path: `${OUT}/town-${i}-${name.toLowerCase()}.png` });

  // Drive the first plot that has a stepper, and prove state actually moved.
  if (i === 0) {
    await tapPlot('Grain');
    await page.waitForTimeout(400);
    const before = await state();
    await page.evaluate(() =>
      [...document.querySelectorAll('.ov-town-btn')].find((b) => b.textContent === '+')?.click(),
    );
    await page.waitForTimeout(500);
    const after = await state();
    const moved = before.count !== after.count && before.idle !== after.idle;
    console.log(`  grain ${before.count} -> ${after.count}, idle ${before.idle} -> ${after.idle}`);
    console.log(moved ? '  stepper mutates state' : '  STEPPER DID NOT MOVE STATE');
    if (!moved) failed = true;
    await page.screenshot({ path: `${OUT}/town-stepper.png` });
  }
  await page.evaluate(() => document.querySelector('.ov-labor-close')?.click());
  await page.waitForTimeout(350);
}

await browser.close();
console.log(escaped.length ? `\nESCAPED THE PAGE: ${escaped.length}` : '\nno network escaped the page');
for (const u of [...new Set(escaped)].slice(0, 5)) console.log('  ' + u);
if (problems.length) {
  console.error(`\n${problems.length} console/page problem(s):`);
  for (const p of [...new Set(problems)].slice(0, 8)) console.error('  ' + p);
}
if (failed || escaped.length || problems.length) process.exitCode = 1;
