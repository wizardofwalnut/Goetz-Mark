/**
 * Syntax-check every <script> block in a single-file build — DEV TOOL.
 *
 *   node tools/check-scripts.mjs playtest/aldermarch-game.html
 *
 * THE TRAP THIS EXISTS FOR. An earlier pass extracted script blocks with a
 * regex that matched nothing, handed the empty string to `node --check`, got a
 * pass, and reported success. So every block is asserted non-empty and of a
 * plausible size BEFORE it is checked, and a zero-block extraction is a hard
 * failure rather than a silent all-clear.
 *
 * It also reports the real block count, which a naive `grep -c '<script'` gets
 * wrong: the string "script" appears inside React's own source, so the raw
 * count is one higher than the number of actual tags.
 *
 * Lives in tools/ rather than a scratch directory on purpose — this has been
 * lost to a container restart once already, and a check nobody can re-run is
 * not a check.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: check-scripts.mjs <file.html>');
  process.exit(2);
}

const html = readFileSync(file, 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

if (blocks.length === 0) {
  console.error('FAIL: extraction found no script blocks — the regex is broken, not the page');
  process.exit(1);
}
console.log(`${blocks.length} script block(s)`);

const dir = mkdtempSync(join(tmpdir(), 'chk-'));
let bad = 0;

blocks.forEach((code, i) => {
  const size = code.trim().length;
  if (size < 50) {
    console.error(`  block ${i}: FAIL — extracted only ${size} chars, extraction is broken`);
    bad++;
    return;
  }
  const path = join(dir, `blk${i}.mjs`);
  writeFileSync(path, code);
  try {
    execFileSync('node', ['--check', path], { stdio: 'pipe' });
    console.log(`  block ${i}: OK (${size} chars)`);
  } catch (err) {
    console.error(`  block ${i}: SYNTAX ERROR (${size} chars)`);
    console.error(String(err.stderr).split('\n').slice(0, 8).join('\n'));
    bad++;
  }
});

process.exit(bad ? 1 : 0);
