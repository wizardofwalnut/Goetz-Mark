/**
 * Build the game as ONE self-contained HTML file.
 *
 * No server, no network, no build step to run it — open the file and play.
 * That makes it something you can hand to a playtester, drop in a chat, or keep
 * as a dated snapshot of how the game felt on a given day.
 *
 * Everything is inlined: the JS bundle, the CSS, and every PNG as a data URI.
 * Art paths are resolved at RUNTIME from the manifest, so string-replacing
 * them in the bundle would not work — instead the page defines
 * `window.__ALDERMARCH_ART__` before the app loads, and the manifest's url
 * builder prefers it when present.
 *
 * Run: npm run standalone   (runs `vite build` first)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ART = join(ROOT, 'public', 'art');
const OUT = join(ROOT, 'playtest', 'aldermarch-game.html');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

// --- inline every asset -----------------------------------------------------
const art = {};
for (const file of walk(ART)) {
  // Keys match the manifest's `path` field: relative, forward slashes.
  const key = relative(ART, file).split(/[\\/]/).join('/');
  art[key] = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
}

// --- pull the built bundle --------------------------------------------------
const html = readFileSync(join(DIST, 'index.html'), 'utf8');

const jsMatch = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const cssMatch = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if (!jsMatch) throw new Error('No script tag in dist/index.html — run vite build first');

const js = readFileSync(join(DIST, jsMatch[1].replace(/^\//, '')), 'utf8');
const css = cssMatch ? readFileSync(join(DIST, cssMatch[1].replace(/^\//, '')), 'utf8') : '';

const title = (html.match(/<title>([^<]*)<\/title>/) ?? [, 'The Aldermarch'])[1];
const icon = art['ui/app-icon.png'];

// --- assemble ---------------------------------------------------------------
// The art map is written as its own script so a browser parses it as data
// rather than scanning a megabyte of base64 looking for code.
const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d0b09">
<title>${title}</title>
${icon ? `<link rel="icon" href="${icon}">` : ''}
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>window.__ALDERMARCH_ART__ = ${JSON.stringify(art)};</script>
<script type="module">${js}</script>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(`Wrote ${relative(ROOT, OUT)}  (${mb(out.length)})`);
console.log(`  ${Object.keys(art).length} images inlined`);
console.log(`  js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB`);
