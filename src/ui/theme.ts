/**
 * Visual tokens — the ledger/parchment-and-ink direction from the battle
 * resolver prototype, carried into the wider game rather than living only on
 * the battle screen.
 *
 * Deliberately not a literal recreation of the source game's sprites or UI.
 * The reference material informed layout and feel (map with a control panel
 * beside it, clear county borders, a minimap) and nothing more.
 *
 * Player colours are picked to stay distinguishable for the most common forms
 * of colour blindness: crimson and verdigris differ in lightness as well as
 * hue, and steel/gold differ strongly in both. Ownership is never signalled by
 * hue alone on the map — counties also carry a hatch pattern per seat.
 */

export const palette = {
  ink: '#0d0b09',
  inkSoft: '#17130f',
  inkLine: '#2a231c',

  parchment: '#e8dcc0',
  parchmentDim: '#d3c4a2',
  parchmentDeep: '#bfae8a',
  parchmentShadow: '#a4906c',

  crimson: '#c0392b',
  crimsonBright: '#e0554a',
  steel: '#2f6fd0',
  steelBright: '#5b93e8',
  gold: '#e8c33a',
  goldBright: '#f5d968',
  sable: '#26262e',
  sableBright: '#4a4a58',

  /* Kept because MapView and the isometric CountyScreen still reference the
     green in their own decoration. NOT a seat colour any more — see below. */
  verdigris: '#4a7c59',
  verdigrisBright: '#68a077',

  wax: '#8c2f24',
} as const;

/** Terrain fills, tuned to read as a drawn map rather than a data heatmap. */
export const terrainTint = {
  open: '#d8c9a4',
  forest: '#a8ab7d',
  hills: '#c2ab84',
  chokepoint: '#9c8f76',
} as const;

/**
 * Seat colours, in seat order.
 *
 * CHOSEN BY MEASUREMENT, not by taste. Every pair has to stay apart under
 * normal vision and under all three kinds of colour blindness, because these
 * carry "whose army is that" on a token roughly fifteen pixels wide.
 *
 * The previous set — crimson, steel, gold, verdigris — had a worst-case
 * separation of 33 (steel against verdigris under tritanopia). This set scores
 * 110, and theme.test.ts fails if any pair drops below 100.
 *
 * Verdigris is gone as a seat colour for a second and separate reason: it sat
 * RGB-distance 49 from the grass-green the minimap fills unclaimed counties
 * with, so a county held by that seat read as nobody's. Green is a poor choice
 * of team colour in a game whose map is a field.
 *
 * Sable replaces it. A near-black banner is the most separable fourth against
 * red, blue and gold in every simulation, and it competes with nothing on the
 * map.
 */
export const seatColors = [
  { base: palette.crimson, bright: palette.crimsonBright, name: 'Crimson' },
  { base: palette.steel, bright: palette.steelBright, name: 'Azure' },
  { base: palette.gold, bright: palette.goldBright, name: 'Gold' },
  { base: palette.sable, bright: palette.sableBright, name: 'Sable' },
] as const;

export const seatColor = (seat: number) =>
  seatColors[seat % seatColors.length] ?? seatColors[0];

export const type = {
  display: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  body: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
  numeric: "'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
} as const;
