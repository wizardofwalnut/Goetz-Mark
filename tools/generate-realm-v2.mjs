/**
 * The 4-county realm — DEV TOOL, not shipped game code.
 *
 * v2 of the spec drops the world from 19 counties to 4. That is not a trim of
 * the old map: at four counties every border matters, so the layout is a
 * deliberate 2x2 with the two seats on the diagonal — sharing only a corner,
 * which is not adjacency here, so neither player can reach the other without
 * first taking neutral ground.
 *
 * RESOURCE RULE (enforced in the data, not just the UI): a county's hard-mineral
 * slot is stone OR ore, never both. Both seats start on ore; both neutral
 * counties hold stone. That gives asymmetry worth playing around from turn one —
 * you cannot build up a castle without trading or taking ground for stone.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/content/maps/realm.generated.ts');

const SEED = 0x52_45_41_4c; // "REAL"
const W = 1000;
const H = 1000;
const JITTER = 22;

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
const jitter = (amt) => (rand() * 2 - 1) * amt;
const round = (n) => Math.round(n * 10) / 10;

// 2x2. Roughly equal, per the spec.
const MID_X = 500;
const MID_Y = 500;
const EDGE = 40;

const COUNTIES = [
  {
    id: 'hollowmere', name: 'Hollowmere', col: 0, row: 0,
    resource: 'wheat', mineral: 'ore', terrain: 'open', size: 4, yield: 22,
  },
  {
    id: 'greyfen', name: 'Greyfen', col: 1, row: 0,
    resource: 'cows', mineral: 'stone', terrain: 'hills', size: 4, yield: 16,
  },
  {
    id: 'ravensgate', name: 'Ravensgate', col: 0, row: 1,
    resource: 'cows', mineral: 'stone', terrain: 'forest', size: 4, yield: 16,
  },
  {
    id: 'marlbrook', name: 'Marlbrook', col: 1, row: 1,
    resource: 'wheat', mineral: 'ore', terrain: 'open', size: 4, yield: 22,
  },
];

// Seats sit on the diagonal: they share a corner, and a corner is not a border.
const STARTS = [
  { seat: 0, county: 'hollowmere' },
  { seat: 1, county: 'marlbrook' },
];

// Every town connects to every neighbouring town by road. Off-road is slower,
// and with only four counties the road network is the whole strategic map.
const ROADS = [
  ['hollowmere', 'greyfen'],
  ['hollowmere', 'ravensgate'],
  ['greyfen', 'marlbrook'],
  ['ravensgate', 'marlbrook'],
];

// --- geometry ---------------------------------------------------------------
// A shared, jittered border cross so the four counties tile exactly.
const vcache = new Map();
const v = (key, x, y, amt = JITTER) => {
  const hit = vcache.get(key);
  if (hit) return hit;
  const p = { x: round(x + jitter(amt)), y: round(y + jitter(amt)) };
  vcache.set(key, p);
  return p;
};

/** Points along a straight run, shared by whichever counties touch it. */
const run = (key, from, to, steps = 4, amt = JITTER) => {
  const pts = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    pts.push(
      v(`${key}:${i}`, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, amt),
    );
  }
  return pts;
};

const corner = (name, x, y) => v(`c:${name}`, x, y, JITTER * 0.6);

const NW = corner('nw', EDGE, EDGE);
const NE = corner('ne', W - EDGE, EDGE);
const SW = corner('sw', EDGE, H - EDGE);
const SE = corner('se', W - EDGE, H - EDGE);
const N = corner('n', MID_X, EDGE);
const S = corner('s', MID_X, H - EDGE);
const E = corner('e', W - EDGE, MID_Y);
const WMID = corner('w', EDGE, MID_Y);
const C = corner('c', MID_X, MID_Y);

const topLeft = [NW, ...run('n-l', NW, N), N, ...run('v-t', N, C), C, ...run('h-l', C, WMID).reverse(), WMID, ...run('w-t', WMID, NW)];
const topRight = [N, ...run('n-r', N, NE), NE, ...run('e-t', NE, E), E, ...run('h-r', E, C).reverse(), C, ...run('v-t', C, N).reverse()];
const bottomLeft = [WMID, ...run('h-l', WMID, C), C, ...run('v-b', C, S), S, ...run('s-l', S, SW).reverse(), SW, ...run('w-b', SW, WMID)];
const bottomRight = [C, ...run('h-r', C, E), E, ...run('e-b', E, SE), SE, ...run('s-r', SE, S).reverse(), S, ...run('v-b', S, C).reverse()];

const SHAPES = { hollowmere: topLeft, greyfen: topRight, ravensgate: bottomLeft, marlbrook: bottomRight };

function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross; cx += (p.x + q.x) * cross; cy += (p.y + q.y) * cross;
  }
  a *= 0.5;
  return { x: round(cx / (6 * a)), y: round(cy / (6 * a)) };
}

// Shared-edge adjacency: diagonals touch only at the centre point, which is a
// corner rather than a border, so they are deliberately NOT adjacent.
const ADJACENT = [
  ['hollowmere', 'greyfen'],
  ['hollowmere', 'ravensgate'],
  ['greyfen', 'marlbrook'],
  ['ravensgate', 'marlbrook'],
];

const roadSet = new Set(ROADS.map(([a, b]) => [a, b].sort().join('|')));
const borders = ADJACENT.map(([a, b]) => ({
  a, b, road: roadSet.has([a, b].sort().join('|')),
}));

// --- verify the rule before emitting ---------------------------------------
for (const c of COUNTIES) {
  if (c.mineral !== 'stone' && c.mineral !== 'ore' && c.mineral !== null) {
    throw new Error(`${c.id}: mineral must be stone, ore or null`);
  }
}
for (const s of STARTS) {
  const c = COUNTIES.find((x) => x.id === s.county);
  if (c.mineral !== 'ore') throw new Error(`${c.id} is a start and must hold ore`);
}
for (const c of COUNTIES) {
  const isStart = STARTS.some((s) => s.county === c.id);
  if (!isStart && c.mineral !== 'stone') {
    throw new Error(`${c.id} is neutral and must hold stone`);
  }
}

const fmt = (pts) => pts.map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(', ');

const src = `// GENERATED FILE — do not edit by hand.
// Produced by tools/generate-realm-v2.mjs (seed 0x${SEED.toString(16)}).
// Run \`npm run gen:realm\` after changing the layout spec in that script.

import { countyId, mapId } from '../../domain/ids';
import type { BorderDef, CountyDef, GameMap, StartingPosition } from '../../domain/map/mapTypes';

const counties: readonly CountyDef[] = [
${COUNTIES.map((c) => {
  const shape = SHAPES[c.id];
  const cen = centroid(shape);
  return `  {
    id: countyId('${c.id}'),
    name: ${JSON.stringify(c.name)},
    size: ${c.size},
    terrain: '${c.terrain}',
    resource: '${c.resource}',
    mineral: '${c.mineral}',
    yield: ${c.yield},
    region: 'realm',
    centroid: { x: ${cen.x}, y: ${cen.y} },
    shape: [${fmt(shape)}],
  },`;
}).join('\n')}
];

const borders: readonly BorderDef[] = [
${borders.map((b) => `  { a: countyId('${b.a}'), b: countyId('${b.b}'), road: ${b.road} },`).join('\n')}
];

const starts: readonly StartingPosition[] = [
${STARTS.map((s) => `  { seat: ${s.seat}, county: countyId('${s.county}') },`).join('\n')}
];

export const REALM: GameMap = {
  id: mapId('realm'),
  name: 'The Aldermarch',
  description:
    'Four counties. Both lords sit on iron and neither on stone, so a castle ' +
    'means taking or trading for the neutral ground between them.',
  width: ${W},
  height: ${H},
  minPlayers: 2,
  maxPlayers: 2,
  counties,
  borders,
  starts,
};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, src);
console.log(`Wrote ${OUT}`);
console.log(`  counties: ${COUNTIES.length}, borders: ${borders.length}, starts: ${STARTS.length}`);
console.log(`  minerals: ${COUNTIES.map((c) => `${c.id}=${c.mineral}`).join(', ')}`);
