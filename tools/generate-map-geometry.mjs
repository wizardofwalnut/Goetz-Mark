/**
 * Map geometry generator — a DEV TOOL, not shipped game code.
 *
 * Hand-authoring 18 irregular county polygons that tile without slivers is
 * error-prone: every shared border has to use byte-identical vertices on both
 * sides or the map renders with hairline gaps. So the layout is specified as
 * rows/columns here, and this script derives the polygons.
 *
 * How tiling is guaranteed:
 *   - Every vertex is looked up from a keyed cache. Two counties either side of
 *     a border request the same key, so they get the same jittered point.
 *   - A county walking a horizontal boundary includes EVERY vertex on that
 *     boundary within its span, including splits belonging to the row on the
 *     other side. Skipping them would leave a T-junction and a visible sliver.
 *
 * Output is committed as src/content/maps/aldermarch.generated.ts. Re-run with
 * `npm run gen:map`; the seed makes it deterministic, so regenerating without
 * changing the spec produces no diff.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/content/maps/aldermarch.generated.ts');

const SEED = 0x41_4c_44_4d; // "ALDM"
const LEFT = 60;
const RIGHT = 940;
const JITTER_INNER = 13; // internal borders
const JITTER_COAST = 26; // outer map edge — coastline should read as irregular
const SEGMENTS_PER_EDGE = 5; // subdivisions per border segment

/** Deterministic PRNG so the committed geometry is reproducible. */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const jitter = (amount) => (rand() * 2 - 1) * amount;

// ---------------------------------------------------------------------------
// LAYOUT SPEC
//
// Two basins joined by exactly one county. Row heights and column splits vary
// deliberately: uniform counties would make every direction of expansion
// equally attractive, which drains the map of decisions.
// ---------------------------------------------------------------------------

// Column splits are symmetric about the vertical centreline (x=500), and the
// row sequence mirrors about the pass. That symmetry is deliberate and is
// enforced by tests: it is what makes all four seats structurally identical —
// same number of neighbours, same terrain mix in reach, same road distance to
// the pass. A seat that reaches the chokepoint a hop sooner than another is
// simply the better seat, and no amount of resource tuning fixes it.
//
// Variety comes from asymmetry WITHIN each basin (county sizes run 1-4, and the
// three columns differ from each other), not from asymmetry between seats.
const ROWS = [
  { key: 'A', y0: 60, y1: 230, splits: [LEFT, 330, 670, RIGHT] },
  { key: 'B', y0: 230, y1: 410, splits: [LEFT, 300, 700, RIGHT] },
  { key: 'C', y0: 410, y1: 600, splits: [LEFT, 350, 650, RIGHT] },
  { key: 'P', y0: 600, y1: 760, splits: [LEFT, RIGHT] }, // the pass — one county, full width
  { key: 'D', y0: 760, y1: 950, splits: [LEFT, 350, 650, RIGHT] },
  { key: 'E', y0: 950, y1: 1140, splits: [LEFT, 300, 700, RIGHT] },
  { key: 'F', y0: 1140, y1: 1340, splits: [LEFT, 330, 670, RIGHT] },
];

/** One entry per county, in row-major order matching ROWS. */
const COUNTIES = [
  // Row A — northern coast. Both northern seats start here.
  { id: 'hollowmere',    name: 'Hollowmere',     size: 4, terrain: 'open',   resource: 'wheat', yield: 22, region: 'north' },
  { id: 'greyfen',       name: 'Greyfen',        size: 3, terrain: 'open',   resource: 'cows',  yield: 15, region: 'north' },
  { id: 'thornwick',     name: 'Thornwick',      size: 4, terrain: 'open',   resource: 'wheat', yield: 22, region: 'north' },
  // Row B — northern woods. Gold here; the southern mirror carries gold too.
  { id: 'auldbarrow',    name: 'Auldbarrow',     size: 3, terrain: 'forest', resource: 'wood',  yield: 18, region: 'north' },
  { id: 'kestrelHollow', name: 'Kestrel Hollow', size: 2, terrain: 'hills',  resource: 'gold',  yield: 9,  region: 'north' },
  { id: 'saltmarch',     name: 'Saltmarch',      size: 3, terrain: 'forest', resource: 'wood',  yield: 18, region: 'north' },
  // Row C — the highland approach to the pass. Northern stone sits here, one
  // county short of the chokepoint, so it is contested by both northern seats.
  { id: 'blackrush',     name: 'Blackrush',      size: 3, terrain: 'hills',  resource: 'ore',   yield: 13, region: 'north' },
  { id: 'duncarrow',     name: 'Duncarrow',      size: 2, terrain: 'hills',  resource: 'stone', yield: 8,  region: 'north' },
  { id: 'wynderly',      name: 'Wynderly',       size: 3, terrain: 'hills',  resource: 'ore',   yield: 13, region: 'north' },
  // The pass — the map's single chokepoint, and stone-bearing, so holding it is
  // an economic decision as well as a positional one. Size 1: it is a gate, not
  // a place to grow.
  { id: 'ironthroat',    name: 'Ironthroat',     size: 1, terrain: 'chokepoint', resource: 'stone', yield: 10, region: 'pass' },
  // Row D — southern approach, mirroring row C.
  { id: 'westmarch',     name: 'Westmarch',      size: 3, terrain: 'hills',  resource: 'ore',   yield: 13, region: 'south' },
  { id: 'ashcombe',      name: 'Ashcombe',       size: 2, terrain: 'hills',  resource: 'stone', yield: 8,  region: 'south' },
  { id: 'milden',        name: 'Milden',         size: 3, terrain: 'hills',  resource: 'ore',   yield: 13, region: 'south' },
  // Row E — southern woods, mirroring row B.
  { id: 'cinderlow',     name: 'Cinderlow',      size: 3, terrain: 'forest', resource: 'wood',  yield: 18, region: 'south' },
  { id: 'harrowfield',   name: 'Harrowfield',    size: 2, terrain: 'hills',  resource: 'gold',  yield: 9,  region: 'south' },
  { id: 'ferngate',      name: 'Ferngate',       size: 3, terrain: 'forest', resource: 'wood',  yield: 18, region: 'south' },
  // Row F — southern coast. Both southern seats start here.
  { id: 'ravensgate',    name: 'Ravensgate',     size: 4, terrain: 'open',   resource: 'wheat', yield: 22, region: 'south' },
  { id: 'brackenVale',   name: 'Bracken Vale',   size: 3, terrain: 'open',   resource: 'cows',  yield: 15, region: 'south' },
  { id: 'marlbrook',     name: 'Marlbrook',      size: 4, terrain: 'open',   resource: 'wheat', yield: 22, region: 'south' },
];

/**
 * Roads. These form one spine running the length of the map through the pass,
 * so the fastest route between the basins is also the contested one — a player
 * who wants speed has to fight for it.
 */
const ROADS = [
  // Northern half of the spine
  ['hollowmere', 'greyfen'],
  ['greyfen', 'thornwick'],
  ['greyfen', 'kestrelHollow'],
  ['kestrelHollow', 'duncarrow'],
  ['duncarrow', 'ironthroat'],
  // Southern half — the exact mirror, so no seat has a shorter run to the pass
  ['ironthroat', 'ashcombe'],
  ['ashcombe', 'harrowfield'],
  ['harrowfield', 'brackenVale'],
  ['brackenVale', 'ravensgate'],
  ['brackenVale', 'marlbrook'],
];

/**
 * Starting seats. Four opposed corners, two per basin, every start a wheat
 * county of size 4 — starts are the one place the map is deliberately
 * symmetric. Asymmetry belongs in the contested middle, not in who can feed
 * themselves on turn one.
 */
const STARTS = [
  { seat: 0, county: 'hollowmere' },
  { seat: 1, county: 'thornwick' },
  { seat: 2, county: 'ravensgate' },
  { seat: 3, county: 'marlbrook' },
];

// ---------------------------------------------------------------------------
// GEOMETRY
// ---------------------------------------------------------------------------

/** Horizontal boundary lines: y-index -> sorted union of adjacent rows' splits. */
const boundaries = [];
for (let i = 0; i <= ROWS.length; i++) {
  const above = ROWS[i - 1];
  const below = ROWS[i];
  const xs = new Set([...(above?.splits ?? []), ...(below?.splits ?? [])]);
  boundaries.push({
    y: below ? below.y0 : above.y1,
    xs: [...xs].sort((a, b) => a - b),
    isCoast: !above || !below,
  });
}

const round = (n) => Math.round(n * 10) / 10;

/**
 * Per-boundary wave parameters.
 *
 * Jitter alone is not enough: it perturbs individual vertices but leaves each
 * row's boundary running dead straight on average, so the map reads as a grid.
 * Adding a low-frequency wave to each horizontal boundary makes counties bulge
 * and pinch across the map's width the way drawn borders do.
 *
 * The wave is a pure function of x on a given boundary, so both counties either
 * side evaluate it identically and the tiling guarantee is untouched.
 */
const waves = boundariesWaveParams();
function boundariesWaveParams() {
  // ROWS.length + 1 horizontal boundaries.
  return Array.from({ length: ROWS.length + 1 }, () => ({
    amp: 16 + rand() * 14,
    freq: (0.9 + rand() * 1.4) * ((2 * Math.PI) / (RIGHT - LEFT)),
    phase: rand() * Math.PI * 2,
  }));
}
const hWave = (bIndex, x) => {
  const w = waves[bIndex];
  return Math.sin(x * w.freq + w.phase) * w.amp;
};

/**
 * Vertical borders get a wave too, enveloped to zero at both ends so the
 * shared corner vertices stay exactly where the horizontal boundaries put them.
 */
const vWave = (rIndex, x, t) => {
  const w = waves[(rIndex + 3) % waves.length];
  return Math.sin(t * Math.PI) * Math.sin(x * w.freq + w.phase + rIndex) * (w.amp * 0.7);
};

const vertexCache = new Map();
/** Keyed vertex lookup — identical keys yield identical points, so borders tile. */
const vertex = (key, x, y, amount) => {
  const hit = vertexCache.get(key);
  if (hit) return hit;
  const p = { x: round(x + jitter(amount)), y: round(y + jitter(amount)) };
  vertexCache.set(key, p);
  return p;
};

const isCoastX = (x) => x === LEFT || x === RIGHT;

/** Points along a horizontal boundary from x=a to x=b inclusive, left to right. */
function horizontalRun(bIndex, a, b) {
  const { y, xs, isCoast } = boundaries[bIndex];
  const pts = [];
  const within = xs.filter((x) => x >= a && x <= b);
  for (let i = 0; i < within.length; i++) {
    const x = within[i];
    // Corner vertices on the map edge get coastline-scale jitter.
    const amount = isCoast || isCoastX(x) ? JITTER_COAST : JITTER_INNER;
    pts.push(vertex(`h:${bIndex}:${x}`, x, y + hWave(bIndex, x), isCoast ? JITTER_COAST : amount));
    const next = within[i + 1];
    if (next === undefined) continue;
    for (let s = 1; s < SEGMENTS_PER_EDGE; s++) {
      const t = s / SEGMENTS_PER_EDGE;
      const mx = x + (next - x) * t;
      pts.push(
        vertex(
          `hm:${bIndex}:${x}:${next}:${s}`,
          mx,
          y + hWave(bIndex, mx),
          isCoast ? JITTER_COAST : JITTER_INNER,
        ),
      );
    }
  }
  return pts;
}

/** Intermediate points down a vertical border at x, within row rIndex. */
function verticalRun(rIndex, x) {
  const { y0, y1 } = ROWS[rIndex];
  const amount = isCoastX(x) ? JITTER_COAST : JITTER_INNER;
  const pts = [];
  for (let s = 1; s < SEGMENTS_PER_EDGE; s++) {
    const t = s / SEGMENTS_PER_EDGE;
    // Map-edge borders stay straight-ish; interior ones wander.
    const dx = isCoastX(x) ? 0 : vWave(rIndex, x, t);
    pts.push(vertex(`v:${rIndex}:${x}:${s}`, x + dx, y0 + (y1 - y0) * t, amount));
  }
  return pts;
}

/** Area-weighted polygon centroid — better label placement than a bbox centre. */
function centroidOf(pts) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const cross = p.x * q.y - q.x * p.y;
    area += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-6) {
    const n = pts.length;
    return {
      x: round(pts.reduce((s, p) => s + p.x, 0) / n),
      y: round(pts.reduce((s, p) => s + p.y, 0) / n),
    };
  }
  return { x: round(cx / (6 * area)), y: round(cy / (6 * area)) };
}

// Assign counties to grid cells, then build each polygon.
const cells = [];
let cursor = 0;
ROWS.forEach((row, rIndex) => {
  for (let c = 0; c < row.splits.length - 1; c++) {
    const spec = COUNTIES[cursor++];
    if (!spec) throw new Error(`COUNTIES is short: expected an entry at index ${cursor - 1}`);
    cells.push({ ...spec, rIndex, x0: row.splits[c], x1: row.splits[c + 1] });
  }
});
if (cursor !== COUNTIES.length) {
  throw new Error(`COUNTIES has ${COUNTIES.length} entries but the grid holds ${cursor}`);
}

const built = cells.map((cell) => {
  const { rIndex, x0, x1 } = cell;
  const top = rIndex;
  const bottom = rIndex + 1;

  const shape = [
    ...horizontalRun(top, x0, x1), // top edge, left to right
    ...verticalRun(rIndex, x1), // right edge, descending
    ...horizontalRun(bottom, x0, x1).reverse(), // bottom edge, right to left
    ...verticalRun(rIndex, x0).reverse(), // left edge, ascending
  ];

  return { ...cell, shape, centroid: centroidOf(shape) };
});

// Adjacency: same row + consecutive columns, or consecutive rows with
// overlapping x-spans. Because the pass row is a single full-width county, it
// is the only link between the two basins — that is the map's whole shape.
const borders = [];
const seen = new Set();
const roadSet = new Set(ROADS.map(([a, b]) => [a, b].sort().join('|')));

for (const a of built) {
  for (const b of built) {
    if (a.id === b.id) continue;
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) continue;

    const sameRow = a.rIndex === b.rIndex && (a.x1 === b.x0 || b.x1 === a.x0);
    const stacked =
      Math.abs(a.rIndex - b.rIndex) === 1 && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0;

    if (!sameRow && !stacked) continue;
    seen.add(key);
    borders.push({ a: a.id, b: b.id, road: roadSet.has(key) });
  }
}

for (const key of roadSet) {
  if (!seen.has(key)) throw new Error(`Road declared between non-adjacent counties: ${key}`);
}

// Mountain ridges flanking the pass. Decoration only — impassability is
// expressed by the absence of a border, never by geometry.
const pass = built.find((c) => c.id === 'ironthroat');
const ridge = (x0, x1) => {
  const { y0, y1 } = ROWS[pass.rIndex];
  const midY = (y0 + y1) / 2;
  const pts = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({ x: round(x0 + (x1 - x0) * t), y: round(y0 + 16 + jitter(9)) });
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const peak = Math.sin(t * Math.PI) * 26;
    pts.push({ x: round(x0 + (x1 - x0) * t), y: round(midY + 34 - peak + jitter(9)) });
  }
  return pts;
};
const scenery = [
  { kind: 'ridge', shape: ridge(LEFT + 10, 388) },
  { kind: 'ridge', shape: ridge(612, RIGHT - 10) },
];

// ---------------------------------------------------------------------------
// EMIT
// ---------------------------------------------------------------------------

const fmtPts = (pts) =>
  pts.map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(', ');

const countySrc = built
  .map(
    (c) => `  {
    id: countyId('${c.id}'),
    name: ${JSON.stringify(c.name)},
    size: ${c.size},
    terrain: '${c.terrain}',
    resource: '${c.resource}',
    yield: ${c.yield},
    region: '${c.region}',
    centroid: { x: ${c.centroid.x}, y: ${c.centroid.y} },
    shape: [${fmtPts(c.shape)}],
  },`,
  )
  .join('\n');

const borderSrc = borders
  .map((b) => `  { a: countyId('${b.a}'), b: countyId('${b.b}'), road: ${b.road} },`)
  .join('\n');

const startSrc = STARTS.map(
  (s) => `  { seat: ${s.seat}, county: countyId('${s.county}') },`,
).join('\n');

const scenerySrc = scenery
  .map((s) => `  { kind: '${s.kind}', shape: [${fmtPts(s.shape)}] },`)
  .join('\n');

const src = `// GENERATED FILE — do not edit by hand.
// Produced by tools/generate-map-geometry.mjs (seed 0x${SEED.toString(16)}).
// Change the layout spec in that script and run \`npm run gen:map\`.

import { countyId, mapId } from '../../domain/ids';
import type { BorderDef, CountyDef, GameMap, StartingPosition } from '../../domain/map/mapTypes';

const counties: readonly CountyDef[] = [
${countySrc}
];

const borders: readonly BorderDef[] = [
${borderSrc}
];

const starts: readonly StartingPosition[] = [
${startSrc}
];

export const ALDERMARCH: GameMap = {
  id: mapId('aldermarch'),
  name: 'The Aldermarch',
  description:
    'Two basins joined by a single pass. Stone is scarce and sits in contested ground, ' +
    'so no lord upgrades a castle without either taking Ironthroat or trading for the ' +
    'privilege.',
  width: 1000,
  height: 1400,
  minPlayers: 2,
  maxPlayers: 4,
  counties,
  borders,
  starts,
  scenery: [
${scenerySrc}
  ],
};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, src);

console.log(`Wrote ${OUT}`);
console.log(`  counties: ${built.length}`);
console.log(`  borders:  ${borders.length} (${borders.filter((b) => b.road).length} roads)`);
console.log(`  starts:   ${STARTS.length}`);
