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

  const text = payload.result?.content?.map((c) => c.text).join('\n') ?? '';
  if (payload.result?.isError) throw new Error(`${name}: ${text}`);
  return text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pull the first http(s) URL out of a tool's text response. */
const findUrl = (text) => text.match(/https?:\/\/\S+?\.png/i)?.[0] ?? null;

/** Pull a job/asset id out of a tool's text response. */
const findId = (text) =>
  text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)?.[0] ?? null;

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  return buf.length;
}

/**
 * Poll a getter until the asset is ready.
 * Generation is async — create returns an id, the getter returns progress
 * until a url appears.
 */
async function waitFor(getter, idArg, id, { tries = 40, delay = 6000 } = {}) {
  for (let i = 0; i < tries; i++) {
    await sleep(delay);
    const text = await callTool(getter, { [idArg]: id });
    const url = findUrl(text);
    if (url) return url;
    if (/fail|error/i.test(text)) throw new Error(`${getter}: ${text.slice(0, 200)}`);
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

async function runBatch(batchPath) {
  const jobs = JSON.parse(readFileSync(resolve(batchPath), 'utf8'));
  console.log(`Running ${jobs.length} job(s)\n`);

  // Kick everything off first, then collect. Generation is the slow part and
  // the API is async, so serialising the waits would multiply total time.
  const started = [];
  for (const job of jobs) {
    try {
      const text = await callTool(job.tool, job.args);
      const id = findId(text);
      const immediate = findUrl(text);
      started.push({ job, id, immediate });
      console.log(`  queued  ${job.key.padEnd(24)} ${id ?? '(inline)'}`);
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
      const url = immediate ?? (getter ? await waitFor(getter, idArg, id) : null);
      if (!url) throw new Error('no image url in response');

      const bytes = await download(url, join(ART_DIR, job.out));
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
