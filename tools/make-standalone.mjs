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

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Built by `vite build --mode standalone`, which is UNMINIFIED and has its own
// outDir so it can never overwrite the real `dist/`. See vite.config.ts.
const DIST = join(ROOT, 'dist-standalone');
const ENTRY = 'standalone.html';
const ART = join(ROOT, 'public', 'art');
const OUT = join(ROOT, 'playtest', 'aldermarch-game.html');
const STAMP = join(ROOT, 'playtest', '.standalone-stamp');

const sha = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Refuse to overwrite a page that is no longer ours.
 *
 * THE FAILURE THIS PREVENTS, which already happened once: the built page became
 * the place the game was actually being developed. Whole features — a labour
 * screen, tile movement, transport caravans — lived only in
 * playtest/aldermarch-game.html and existed nowhere in src/. Running this script
 * would have regenerated the page from source and destroyed all of it, silently,
 * with a cheerful success message.
 *
 * So: every successful write records the hash of what it produced. On the next
 * run, if the page on disk does not hash to that stamp, something downstream
 * edited it and src/ is no longer the source of truth for this artefact.
 *
 * Hashing the ARTEFACT is the right check. Comparing timestamps against src/
 * would be guesswork — a git checkout rewrites mtimes wholesale, so it would
 * both miss real edits and cry wolf after every branch switch. The question that
 * matters is not "is src/ newer?" but "is this file still the one I wrote?",
 * and only a hash answers that.
 */
function assertSafeToOverwrite(force) {
  if (!existsSync(OUT)) return;

  const current = sha(readFileSync(OUT, 'utf8'));
  const stamped = existsSync(STAMP) ? readFileSync(STAMP, 'utf8').trim() : null;
  if (current === stamped) return;

  const why = stamped
    ? 'it has been edited since this script last wrote it'
    : 'there is no record of this script having written it';

  if (force) {
    console.warn(`! Overwriting ${relative(ROOT, OUT)} anyway (--force): ${why}.`);
    return;
  }

  console.error(
    `\nREFUSING to overwrite ${relative(ROOT, OUT)} — ${why}.\n\n` +
      'That file may hold work that exists nowhere in src/. Rebuilding from\n' +
      'source would delete it, and this script has no way to get it back.\n\n' +
      'Before doing anything else, save a copy of it somewhere safe.\n\n' +
      'Then either:\n' +
      '  - port its changes back into src/ and run this again, or\n' +
      '  - re-run with --force if you are certain src/ is ahead and the\n' +
      '    page is genuinely disposable.\n',
  );
  process.exit(1);
}

assertSafeToOverwrite(process.argv.includes('--force'));

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
const html = readFileSync(join(DIST, ENTRY), 'utf8');

const jsMatch = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const cssMatch = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if (!jsMatch) {
  throw new Error(
    `No script tag in ${DIST}/${ENTRY} — run \`vite build --mode standalone\` first`,
  );
}

const js = readFileSync(join(DIST, jsMatch[1].replace(/^\//, '')), 'utf8');
const css = cssMatch ? readFileSync(join(DIST, cssMatch[1].replace(/^\//, '')), 'utf8') : '';

// The build must be READABLE — that is the entire reason this page exists.
// A minified bundle runs fine, so nothing else here would notice; the failure
// would only surface as an assistant unable to find anything to edit.
for (const marker of ['resolveConquest', 'bakeCounty', 'projectProduction']) {
  if (!js.includes(marker)) {
    throw new Error(
      `Bundle looks minified: "${marker}" is missing. ` +
        'Build with `vite build --mode standalone` so identifiers survive.',
    );
  }
}

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
// Record what we produced, so the next run can tell our own output apart from
// a page someone has since edited. Committed, so the check works on a fresh
// clone rather than only for whoever last built locally.
writeFileSync(STAMP, `${sha(out)}\n`);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(`Wrote ${relative(ROOT, OUT)}  (${mb(out.length)})`);
console.log(`  ${Object.keys(art).length} images inlined`);
console.log(`  js ${(js.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB`);
