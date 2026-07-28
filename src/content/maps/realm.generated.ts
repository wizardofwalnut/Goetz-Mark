// GENERATED FILE — do not edit by hand.
// Produced by tools/generate-realm-v2.mjs (seed 0x5245414c).
// Run `npm run gen:realm` after changing the layout spec in that script.

import { countyId, mapId } from '../../domain/ids';
import type { BorderDef, CountyDef, GameMap, StartingPosition } from '../../domain/map/mapTypes';

const counties: readonly CountyDef[] = [
  {
    id: countyId('hollowmere'),
    name: "Hollowmere",
    size: 4,
    terrain: 'open',
    resource: 'wheat',
    mineral: 'ore',
    yield: 22,
    region: 'realm',
    centroid: { x: 273.9, y: 279.5 },
    shape: [{ x: 50.8, y: 51.2 }, { x: 147.7, y: 60.9 }, { x: 287.4, y: 33 }, { x: 381.7, y: 40.7 }, { x: 498, y: 35.7 }, { x: 482.3, y: 132.8 }, { x: 509.2, y: 259.2 }, { x: 514.7, y: 401.6 }, { x: 496.8, y: 509.4 }, { x: 167.2, y: 519.9 }, { x: 249.5, y: 499.1 }, { x: 395.4, y: 497.7 }, { x: 33.5, y: 501.5 }, { x: 43.1, y: 396.1 }, { x: 33, y: 293.6 }, { x: 40.1, y: 150.7 }],
  },
  {
    id: countyId('greyfen'),
    name: "Greyfen",
    size: 4,
    terrain: 'hills',
    resource: 'cows',
    mineral: 'stone',
    yield: 16,
    region: 'realm',
    centroid: { x: 728.1, y: 271.6 },
    shape: [{ x: 498, y: 35.7 }, { x: 614.9, y: 44.2 }, { x: 750.5, y: 30 }, { x: 852.9, y: 44.4 }, { x: 962.1, y: 31.9 }, { x: 946.7, y: 149.2 }, { x: 939.2, y: 258.1 }, { x: 973.9, y: 377.8 }, { x: 949, y: 509.2 }, { x: 625.5, y: 505.4 }, { x: 738, y: 512.6 }, { x: 845, y: 507.3 }, { x: 496.8, y: 509.4 }, { x: 514.7, y: 401.6 }, { x: 509.2, y: 259.2 }, { x: 482.3, y: 132.8 }],
  },
  {
    id: countyId('ravensgate'),
    name: "Ravensgate",
    size: 4,
    terrain: 'forest',
    resource: 'cows',
    mineral: 'stone',
    yield: 16,
    region: 'realm',
    centroid: { x: 270.7, y: 737.1 },
    shape: [{ x: 33.5, y: 501.5 }, { x: 395.4, y: 497.7 }, { x: 249.5, y: 499.1 }, { x: 167.2, y: 519.9 }, { x: 496.8, y: 509.4 }, { x: 496.4, y: 635.8 }, { x: 503.9, y: 742.1 }, { x: 498.9, y: 841.5 }, { x: 508.2, y: 962.9 }, { x: 180, y: 977 }, { x: 266.4, y: 957.5 }, { x: 405.6, y: 966.6 }, { x: 41.9, y: 953.2 }, { x: 44.3, y: 837.2 }, { x: 42, y: 735.9 }, { x: 39.2, y: 594.1 }],
  },
  {
    id: countyId('marlbrook'),
    name: "Marlbrook",
    size: 4,
    terrain: 'open',
    resource: 'wheat',
    mineral: 'ore',
    yield: 22,
    region: 'realm',
    centroid: { x: 720.8, y: 732.6 },
    shape: [{ x: 496.8, y: 509.4 }, { x: 845, y: 507.3 }, { x: 738, y: 512.6 }, { x: 625.5, y: 505.4 }, { x: 949, y: 509.2 }, { x: 965.6, y: 598.4 }, { x: 929.5, y: 727.2 }, { x: 930.9, y: 829.3 }, { x: 951.1, y: 947.2 }, { x: 610.5, y: 957.3 }, { x: 728.6, y: 938.7 }, { x: 855.6, y: 967.3 }, { x: 508.2, y: 962.9 }, { x: 498.9, y: 841.5 }, { x: 503.9, y: 742.1 }, { x: 496.4, y: 635.8 }],
  },
];

const borders: readonly BorderDef[] = [
  { a: countyId('hollowmere'), b: countyId('greyfen'), road: true },
  { a: countyId('hollowmere'), b: countyId('ravensgate'), road: true },
  { a: countyId('greyfen'), b: countyId('marlbrook'), road: true },
  { a: countyId('ravensgate'), b: countyId('marlbrook'), road: true },
];

const starts: readonly StartingPosition[] = [
  { seat: 0, county: countyId('hollowmere') },
  { seat: 1, county: countyId('marlbrook') },
];

export const REALM: GameMap = {
  id: mapId('realm'),
  name: 'The Aldermarch',
  description:
    'Four counties. Both lords sit on iron and neither on stone, so a castle ' +
    'means taking or trading for the neutral ground between them.',
  width: 1000,
  height: 1000,
  minPlayers: 2,
  maxPlayers: 2,
  counties,
  borders,
  starts,
};
