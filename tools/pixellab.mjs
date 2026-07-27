/**
 * PixelLab MCP client — a DEV TOOL for generating art into public/art/.
 *
 * Why this exists rather than just using the MCP tools: the pixellab MCP server
 * is configured in .mcp.json to read its token from ${PIXELLAB_API_KEY}. When
 * that variable is unset the header ships unexpanded and every call fails with
 * "401: Invalid API token". This script reads .env directly, so art generation
 * works regardless of how the editor's MCP session was initialised.
 *
 * Usage:
 *   node tools/pixellab.mjs balance
 *   node tools/pixellab.mjs run <batch.json>
 *
 * A batch file is a list of jobs:
 *   [{ "key": "terrain.open", "tool": "create_image_pixflux",
 *      "args": {...}, "out": "terrain/open.png" }]
 *
 * `key` is the asset-manifest key the result fills. On success the script
 * writes the PNG and clears that entry's `pending` flag, so the manifest and
 * the files on disk cannot drift apart.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ART_DIR = join(ROOT, 'public', 'art');
const MANIFEST_PATH = join(ROOT, 'src', 'assets', 'manifest.json');
const ENDPOINT = 'https://api.pixellab.ai/mcp';

function token() {
  if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    throw new Error('No PIXELLAB_API_KEY and no .env — copy .env.example to .env');
  }
  const match = readFileSync(envPath, 'utf8').match(/^PIXELLAB_API_KEY=(.+)$/m);
  if (!match) throw new Error('.env has no PIXELLAB_API_KEY');
  return match[1].trim();
}

let nextId = 1;

/** Call an MCP tool. The server replies as SSE, so unwrap the data frame. */
async function callTool(name, args) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: nextId++,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} — ${raw.slice(0, 300)}`);

  // Response is either bare JSON or an SSE stream of `data:` frames.
  const line = raw.split('\n').find((l) => l.startsWith('data:'));
  const payload = JSON.parse(line ? line.slice(5).trim() : raw);
  if (payload.error) throw new Error(`${name}: ${JSON.stringify(payload.error)}`);

  const content = payload.result?.content ?? [];
  const text = content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  if (payload.result?.isError) throw new Error(`${name}: ${text}`);

  // Results come back as a text block plus an inline base64 image block. The
  // text carries `status:`/`id:` lines and a download URL that has NO file
  // extension — do not try to spot it by looking for ".png".
  const image = content.find((c) => c.type === 'image');
  return { text, image: image?.data ?? null, fields: parseFields(text) };
}

/** Parse the `key: value` lines the API returns as its text block. */
function parseFields(text) {
  const fields = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([a-z_]+):\s*(.+)$/i);
    if (m) fields[m[1].toLowerCase()] = m[2].trim();
  }
  return fields;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function save(base64, outPath) {
  const buf = Buffer.from(base64, 'base64');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  return buf.length;
}

/**
 * Poll a getter until the asset is ready and return its base64 image.
 *
 * Terminal states are read from the `status:` field rather than sniffed out of
 * the prose, so a job that fails server-side surfaces immediately instead of
 * burning the whole timeout.
 */
async function waitFor(getter, idArg, id, { tries = 60, delay = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const res = await callTool(getter, { [idArg]: id });
    const status = (res.fields.status ?? '').toLowerCase();

    if (res.image) return res.image;
    if (/fail|error|cancel/.test(status)) {
      throw new Error(`${getter}: status=${status} ${res.text.slice(0, 160)}`);
    }
    if (status === 'completed') {
      throw new Error(`${getter}: completed but returned no image block`);
    }
    await sleep(delay);
  }
  throw new Error(`${getter}: timed out waiting for ${id}`);
}

const GETTERS = {
  create_image_pixflux: ['get_image', 'job_id'],
  create_image_pixen: ['get_image', 'job_id'],
  create_image_pro: ['get_image', 'job_id'],
  create_tiles_pro: ['get_tiles_pro', 'tile_id'],
  create_topdown_tileset: ['get_topdown_tileset', 'tileset_id'],
  create_ui_asset: ['get_ui_asset', 'ui_asset_id'],
  create_map_object: ['get_map_object', 'object_id'],
};

/** Drop `pending` for keys whose art now exists, so nothing drifts. */
function markGenerated(keys) {
  if (keys.length === 0) return;
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  for (const key of keys) {
    const entry = manifest.entries[key];
    if (entry) delete entry.pending;
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nmanifest: cleared pending on ${keys.length} entr${keys.length === 1 ? 'y' : 'ies'}`);
}

/**
 * Palette reference, base64.
 *
 * PixelLab samples only the COLOURS of this image and forces output onto them.
 * Naming colours in the prompt is unreliable by comparison — the first pilot
 * batch asked for muted parchment tones in words and came back fully saturated.
 */
const paletteBase64 = () => {
  const p = join(HERE, 'palette-reference.png');
  if (!existsSync(p)) throw new Error('Run: node tools/make-palette-png.mjs');
  return readFileSync(p).toString('base64');
};

/** Jobs opt out with "palette": false (e.g. when matching an existing asset). */
function withPalette(job) {
  if (job.palette === false) return job.args;
  if (job.tool.startsWith('create_image_')) {
    return { ...job.args, color_image_base64: paletteBase64() };
  }
  return job.args;
}

async function runBatch(batchPath) {
  const jobs = JSON.parse(readFileSync(resolve(batchPath), 'utf8'));
  console.log(`Running ${jobs.length} job(s)\n`);

  // Kick everything off first, then collect. Generation is the slow part and
  // the API is async, so serialising the waits would multiply total time.
  const started = [];
  for (const job of jobs) {
    try {
      // `resume` re-collects an already-generated job by id instead of paying
      // for it again — used when a run generated fine server-side but the
      // client failed to read the result.
      if (job.resume) {
        started.push({ job, id: job.resume });
        console.log(`  resume  ${job.key.padEnd(24)} ${job.resume}`);
        continue;
      }
      const res = await callTool(job.tool, withPalette(job));
      const id = res.fields.id ?? null;
      started.push({ job, id, immediate: res.image });
      console.log(`  queued  ${job.key.padEnd(24)} ${id ?? '(inline result)'}`);
    } catch (err) {
      console.error(`  FAILED  ${job.key.padEnd(24)} ${err.message}`);
      started.push({ job, error: err });
    }
  }

  console.log('');
  const done = [];
  for (const entry of started) {
    if (entry.error) continue;
    const { job, id, immediate } = entry;
    try {
      const [getter, idArg] = GETTERS[job.tool] ?? [];
      let base64 = immediate;
      if (!base64) {
        if (!getter) throw new Error(`no getter registered for ${job.tool}`);
        if (!id) throw new Error('create returned neither an image nor an id');
        base64 = await waitFor(getter, idArg, id);
      }

      const bytes = save(base64, join(ART_DIR, job.out));
      console.log(`  saved   ${job.key.padEnd(24)} public/art/${job.out} (${bytes}b)`);
      done.push(job.key);
    } catch (err) {
      console.error(`  FAILED  ${job.key.padEnd(24)} ${err.message}`);
    }
  }

  markGenerated(done);
  console.log(`\n${done.length}/${jobs.length} generated`);
  if (done.length < jobs.length) process.exitCode = 1;
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'balance') {
  console.log(await callTool('get_balance', {}));
} else if (cmd === 'run' && arg) {
  await runBatch(arg);
} else {
  console.error('usage: pixellab.mjs balance | run <batch.json>');
  process.exitCode = 2;
}
