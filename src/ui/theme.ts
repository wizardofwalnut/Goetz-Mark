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

  crimson: '#a32c28',
  crimsonBright: '#c94a3f',
  steel: '#3f6b8f',
  steelBright: '#5b8db4',
  gold: '#c9a227',
  goldBright: '#e3bf4a',
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

/** Seat colours, in seat order. */
export const seatColors = [
  { base: palette.crimson, bright: palette.crimsonBright, name: 'Crimson' },
  { base: palette.steel, bright: palette.steelBright, name: 'Steel' },
  { base: palette.gold, bright: palette.goldBright, name: 'Gold' },
  { base: palette.verdigris, bright: palette.verdigrisBright, name: 'Verdigris' },
] as const;

export const seatColor = (seat: number) =>
  seatColors[seat % seatColors.length] ?? seatColors[0];

export const type = {
  display: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  body: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
  numeric: "'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
} as const;
