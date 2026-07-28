import type { CountyDef } from '../../domain/map/mapTypes';
import type { GameMap } from '../../domain/map/mapTypes';
import type { MatchState } from '../../domain/match/matchState';
import type { FieldTile, GroundCell, IndustrySiteState } from '../../domain/county/interior';
import { stageOf } from '../../domain/county/interior';
import { healthFromRations, projectProduction, type Health } from '../../domain/county/labour';
import type { Resource } from '../../domain/resources';
import { describeTurn, seasonOfTurn } from '../../domain/season';
import {
  armyBearerArt,
  armySizeBand,
  armySoldierArt,
  overheadCastleArt,
  overheadFieldArt,
  overheadForestArt,
  overheadGroundArt,
  overheadIndustryArt,
  overheadMountainArt,
  overheadRoadArt,
  overheadTownArt,
  overheadWagonArt,
  resourceArt,
} from '../../assets/assetManifest';
import { palette } from '../theme';
import { Minimap } from './Minimap';
import {
  ART_SCALE,
  ART_TILE_PX,
  STRIDE_Y,
  TILE_W,
  cellCentre,
  cellX,
  cellY,
  gridSize,
  roadMasks,
} from './overheadCamera';

/**
 * The county living map, overhead camera — STATIC.
 *
 * The county-map spec asks for exactly this before anything interactive is
 * built on top of it: one county, town centre, castle, a handful of fields,
 * the road out to the county edge, and the minimap in the corner. Nothing here
 * handles a tap, changes state, or knows what a labour allocation is. That is
 * the point — a wrong camera angle costs ten minutes to fix now and a day to
 * fix once interaction is layered over it.
 *
 * Everything it draws comes through the asset manifest. There is not one image
 * path in this file.
 */

interface Props {
  readonly county: CountyDef;
  readonly map: GameMap;
  readonly match: MatchState;
}

export function CountyOverhead({ county, map, match }: Props) {
  const state = match.counties[county.id];
  const interior = state?.interior;
  if (!state || !interior) return <p className="empty-hint">This county has no interior.</p>;

  const season = seasonOfTurn(match.turn.number);
  const { width, height } = gridSize(interior.cols, interior.rows);
  const bounds = { cols: interior.cols, rows: interior.rows };
  const masks = roadMasks(interior.road, bounds);

  // Sprites stand on the ground, so they must be drawn in row order together
  // with it — a castle two rows back has to be covered by the land in front of
  // it, not painted over the whole map afterwards.
  const bandOf = (row: number) => row;
  const bands = new Map<number, JSX.Element[]>();
  const put = (row: number, el: JSX.Element) => {
    const band = bands.get(bandOf(row)) ?? [];
    band.push(el);
    bands.set(bandOf(row), band);
  };

  for (const cell of interior.ground) {
    put(cell.row, <GroundTile key={`g${cell.col}_${cell.row}`} cell={cell} />);
  }
  // Fields go down over the ground and UNDER the roads: a road is cut through
  // worked land, not ploughed over.
  for (const field of interior.fields) {
    put(field.row, <FieldTileView key={field.id} field={field} />);
  }
  for (const cell of interior.road) {
    const mask = masks[`${cell.col},${cell.row}`];
    if (mask === undefined) continue;
    put(cell.row, <RoadTile key={`r${cell.col}_${cell.row}`} cell={cell} mask={mask} />);
  }
  // Peaks and woods are sprites standing on their own ground, not flat tiles.
  // See overheadMountainArt for why that distinction matters at this camera —
  // it applies to a wood for the same reason it applies to a crag.
  for (const cell of interior.ground) {
    if (cell.kind === 'mountain') {
      put(cell.row, <MountainSprite key={`m${cell.col}_${cell.row}`} col={cell.col} row={cell.row} />);
    } else if (cell.kind === 'forest') {
      put(cell.row, <ForestSprite key={`f${cell.col}_${cell.row}`} col={cell.col} row={cell.row} />);
    }
  }
  for (const site of interior.industry) {
    put(site.row, <IndustrySprite key={site.kind} site={site} />);
  }


  // The town is the anchor of the whole screen; the castle stands apart from
  // it on ground the interior reserved. Both positions come from the data —
  // the renderer does not get to decide where a building is.
  const { town, castle } = interior;
  put(town.row, <TownSprite key="town" col={town.col} row={town.row} />);
  if (state.castleTier !== 'none') {
    put(
      castle.row,
      <CastleSprite key="keep" col={castle.col} row={castle.row} tier={state.castleTier} />,
    );
  }

  // Armies go down AFTER the buildings they stand beside. Within a row things
  // paint in the order they were added, so a garrison queued before the keep is
  // a garrison painted over by it.
  for (const army of Object.values(match.armies)) {
    if (army.location.kind !== 'garrison' || army.location.county !== county.id) continue;
    const owner = match.players.find((p) => p.id === army.owner);
    put(
      castle.row,
      <ArmySprite
        key={army.id}
        col={castle.col}
        row={castle.row}
        seat={owner?.seat ?? 0}
        troops={Object.values(army.troops).reduce((a, b) => a + (b ?? 0), 0)}
      />,
    );
  }

  // The caravan, if it is in this county. Its cell always sits on a road —
  // county/movement.ts is what guarantees a wagon can never be anywhere else.
  if (match.merchant && match.merchant.county === county.id) {
    const { col, row } = match.merchant.at;
    put(row, <WagonSprite key="merchant" col={col} row={row} />);
  }

  const rows = [...bands.keys()].sort((a, b) => a - b);

  return (
    <div className="ov">
      <TopBar match={match} label={describeTurn(match.turn.number)} />

      <div className="ov-stage" ref={centreOnLoad}>
        <svg
          className="ov-map"
          viewBox={`0 0 ${width} ${height}`}
          style={{ aspectRatio: `${width} / ${height}` }}
          role="img"
          aria-label={`${county.name}, seen from above in ${season}`}
        >
          {rows.map((row) => (
            <g key={row}>{bands.get(row)}</g>
          ))}
        </svg>

        <div className="ov-corner">
          <Minimap map={map} match={match} focus={county.id} />
        </div>
      </div>

      <CountyStrip county={county} match={match} />
    </div>
  );
}

/**
 * Start the view centred rather than at the top-left corner.
 *
 * The camera fills the screen height, so a county wider than the viewport
 * overflows sideways. Landing on the left edge would put the town off-screen,
 * and v2 is explicit that the town centre is what a county view centres on.
 * This is framing, not interaction — nothing here responds to a tap.
 */
const centreOnLoad = (el: HTMLDivElement | null) => {
  if (!el) return;
  el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
};

/**
 * Tile art is drawn at its full canvas size and left unclipped.
 *
 * The bottom of each canvas is the tile's depth band. Clipping it away is what
 * turns an overhead-with-relief map back into a flat paper one, so rows are
 * allowed to overlap and painter's order does the rest.
 */
const tileBox = (col: number, row: number) => ({
  x: cellX(col),
  y: cellY(row),
  width: ART_TILE_PX * ART_SCALE,
  height: ART_TILE_PX * ART_SCALE,
  style: { imageRendering: 'pixelated' as const },
});

/**
 * A ground cell.
 *
 * Plain ground goes down under EVERY cell, with forest, mountain or water
 * drawn over it. That is not redundant: generated tiles are not guaranteed to
 * fill their canvas — the water tile came back with a transparent lower band —
 * and without something beneath it, the hole shows the page through the map.
 * Grass under everything is also simply true of the terrain it describes.
 */
function GroundTile({ cell }: { cell: GroundCell }) {
  const base = overheadGroundArt('ground');
  const art = cell.kind === 'ground' ? base : overheadGroundArt(cell.kind);
  const box = tileBox(cell.col, cell.row);

  return (
    <>
      {base.missing || !base.url ? (
        <rect {...box} fill={palette.parchmentShadow} />
      ) : (
        <image href={base.url} {...box} />
      )}
      {art !== base && !art.missing && art.url && <image href={art.url} {...box} />}
    </>
  );
}

function RoadTile({ cell, mask }: { cell: { col: number; row: number }; mask: number }) {
  const art = overheadRoadArt(mask);
  if (art.missing || !art.url) return null;
  return <image href={art.url} {...tileBox(cell.col, cell.row)} />;
}

/**
 * A field, drawn for WHAT IS IN IT.
 *
 * Fields must read as workable at a glance even when fallow — that difference
 * from generic ground is the whole reason the bounded 8-16 set exists. But the
 * status matters just as much: a grain field visibly changing across the season
 * cycle is a mechanic, not decoration, and barren land has to look like
 * something that needs reclaiming rather than something ready to sow.
 *
 * An earlier pass drew every field from a corner mask alone and silently lost
 * all of that — fallow, barren, cattle and all four grain stages rendered
 * identically. Passing the field itself, rather than a mask derived from where
 * it sits, is what stops that recurring.
 */
function FieldTileView({ field }: { field: FieldTile }) {
  const art = overheadFieldArt(field.status, stageOf(field));
  if (art.missing || !art.url) {
    return <rect {...tileBox(field.col, field.row)} fill={palette.parchmentDeep} />;
  }
  return <image href={art.url} {...tileBox(field.col, field.row)} />;
}

function MountainSprite({ col, row }: { col: number; row: number }) {
  const art = overheadMountainArt();
  if (art.missing || !art.url) return null;
  return <MapSprite col={col} row={row} url={art.url} size={1.5} label="Mountain" />;
}

/**
 * An army standing on the map.
 *
 * Two questions answered without opening anything: WHOSE, from the flag the
 * bearer carries in the owner's seat colour, and HOW BIG, from the number of
 * figures — one, two or three for small, medium and large.
 *
 * Only the bearer is coloured. Three men carrying three flags would read as
 * three armies rather than one large one, which is the opposite of what the
 * count is for.
 */
const FIGURES_FOR: Record<ReturnType<typeof armySizeBand>, number> = {
  small: 1,
  medium: 2,
  large: 3,
};

/** A loose knot, so two and three read as "more men" and not as a formation. */
const FIGURE_OFFSETS = [
  { x: -0.5, y: 0.9 },
  { x: -0.16, y: 1.32 },
  { x: -0.84, y: 1.36 },
] as const;

function ArmySprite({
  col,
  row,
  seat,
  troops,
}: {
  col: number;
  row: number;
  seat: number;
  troops: number;
}) {
  const bearer = armyBearerArt(seat);
  const soldier = armySoldierArt();
  const count = FIGURES_FOR[armySizeBand(troops)];

  // Bearer last, so his flag is never hidden behind a spearman's shoulder.
  const figures = FIGURE_OFFSETS.slice(0, count)
    .map((offset, i) => ({ offset, art: i === 0 ? bearer : soldier, key: i }))
    .reverse();

  return (
    <>
      {figures.map(({ offset, art, key }) =>
        art.missing || !art.url ? null : (
          <MapSprite
            key={key}
            col={col}
            row={row}
            url={art.url}
            size={1.15}
            offset={offset}
            label={`${troops} men`}
          />
        ),
      )}
    </>
  );
}

function ForestSprite({ col, row }: { col: number; row: number }) {
  const art = overheadForestArt();
  if (art.missing || !art.url) return null;
  return <MapSprite col={col} row={row} url={art.url} size={1.4} label="Woods" />;
}

/**
 * A sprite standing on a tile.
 *
 * Anchored bottom-centre to the middle of the tile's top face, so it sits ON
 * the ground rather than floating over it. Its height then rises up the screen
 * — which is what gives the overhead view its relief.
 */
function MapSprite({
  col,
  row,
  url,
  size,
  label,
  offset,
}: {
  col: number;
  row: number;
  url: string;
  /** Sprite footprint in tiles. A town covers more ground than a forge. */
  size: number;
  label: string;
  /** Nudge within the cell, in tiles. Lets several figures share one cell. */
  offset?: { readonly x: number; readonly y: number };
}) {
  const centre = cellCentre(col, row);
  const w = TILE_W * size;
  return (
    <image
      href={url}
      x={centre.x - w / 2 + (offset?.x ?? 0) * TILE_W}
      y={centre.y + STRIDE_Y / 2 - w + (offset?.y ?? 0) * STRIDE_Y}
      width={w}
      height={w}
      style={{ imageRendering: 'pixelated' }}
    >
      <title>{label}</title>
    </image>
  );
}

function TownSprite({ col, row }: { col: number; row: number }) {
  const art = overheadTownArt();
  if (art.missing || !art.url) return null;
  return <MapSprite col={col} row={row} url={art.url} size={1.9} label="Town centre" />;
}

function CastleSprite({
  col,
  row,
  tier,
}: {
  col: number;
  row: number;
  tier: Parameters<typeof overheadCastleArt>[0];
}) {
  const art = overheadCastleArt(tier);
  if (art.missing || !art.url) return null;
  return <MapSprite col={col} row={row} url={art.url} size={1.5} label="Castle" />;
}

/**
 * The merchant's wagon.
 *
 * Roads only — never across open land. That is not enforced here: the rule
 * lives in county/movement.ts as the `wheeled` travel kind, so it holds for
 * anything that moves the wagon rather than only for whatever draws it.
 */
function WagonSprite({ col, row }: { col: number; row: number }) {
  const art = overheadWagonArt();
  if (art.missing || !art.url) return null;
  return <MapSprite col={col} row={row} url={art.url} size={1.15} label="Merchant caravan" />;
}

function IndustrySprite({ site }: { site: IndustrySiteState }) {
  const art = overheadIndustryArt(site.kind);
  if (art.missing || !art.url) return null;
  return <MapSprite col={site.col} row={site.row} url={art.url} size={1.15} label={site.kind} />;
}

/**
 * Everything that pools empire-wide, materials first and money last.
 *
 * These four and no others. What they have in common is that they need no
 * shipping decision, which is exactly why a single realm-wide total is a true
 * statement about them. Food is deliberately absent for the opposite reason —
 * it is held per county and must be carted, so one number for it would be a
 * lie however convenient.
 */
const POOLED_RESOURCES = ['wood', 'stone', 'ore', 'gold'] as const;

/**
 * Top bar — an OVERLAY, not a header.
 *
 * It floats over the map rather than taking a strip of its own, so the land
 * runs full-bleed to the top of the screen. On a phone the map is the thing
 * worth the pixels; chrome that reserves its own band costs a row of county
 * for information that is only glanced at.
 *
 * Year and season, then each material as picture plus number. No labels: the
 * governing principle is images over words, and a player who cannot tell ore
 * from stone at a glance is not helped by a five-letter caption under it —
 * they are helped by the two icons not looking alike, which is a job for the
 * art, not for text.
 */
function TopBar({ match, label }: { match: MatchState; label: string }) {
  const you = match.players[0];
  const purse = you ? match.treasuries[you.id] : undefined;

  return (
    <header className="ov-top">
      <div className="ov-when">{label}</div>
      <div className="ov-res">
        {POOLED_RESOURCES.map((resource) => (
          <Readout key={resource} resource={resource} value={purse?.[resource] ?? 0} />
        ))}
      </div>
    </header>
  );
}

/**
 * The universal resource readout: a picture of the material and a number.
 *
 * One component for every resource in every panel, so the convention cannot
 * drift screen to screen. `signed` switches it to the net-change form the spec
 * asks for on per-county figures.
 */
function Readout({
  resource,
  value,
  signed = false,
}: {
  resource: Parameters<typeof resourceArt>[0];
  value: number;
  signed?: boolean;
}) {
  const art = resourceArt(resource);
  const text = signed && value > 0 ? `+${value}` : String(value);
  const tone = !signed ? '' : value > 0 ? ' up' : value < 0 ? ' down' : '';

  return (
    <div className={`ov-readout${tone}`} title={resource}>
      {art.missing || !art.url ? (
        <span className="ov-chip" aria-hidden />
      ) : (
        <img src={art.url} alt={resource} width={30} height={30} />
      )}
      <span className="ov-num">{text}</span>
    </div>
  );
}

/**
 * The county summary strip.
 *
 * This IS the county panel — icon and number, nothing else. The spec is
 * explicit that a paragraph-style stat card is the wrong default, and that a
 * panel which ends up mostly text is a signal to redesign it rather than a
 * style quibble.
 */
function CountyStrip({ county, match }: { county: CountyDef; match: MatchState }) {
  const state = match.counties[county.id];
  const interior = state?.interior;
  if (!state || !interior) return null;

  const season = seasonOfTurn(match.turn.number);
  const net = projectProduction({
    interior,
    population: state.population,
    split: { agricultureShare: state.agricultureShare },
    season,
  });
  const of = (resource: Resource) => net.lines.find((l) => l.key === resource)?.net ?? 0;

  // Health is DERIVED from rations, not a stored field — the thermometer is a
  // readout of a rule, so there is nothing here that can disagree with it.
  const health = healthFromRations(state.rationLevel, state.seasonsAtRation);

  return (
    <footer className="ov-strip">
      <Readout resource={county.resource} value={of(county.resource)} signed />
      {county.mineral && <Readout resource={county.mineral} value={of(county.mineral)} signed />}
      <Readout resource="wood" value={of('wood')} signed />
      <div className="ov-health" title={`Health: ${health}`}>
        <div
          className="ov-health-fill"
          style={{ height: `${HEALTH_FILL[health]}%` }}
          data-health={health}
        />
      </div>
    </footer>
  );
}

/** Thermometer fill per health band, weakest to strongest. */
const HEALTH_FILL: Record<Health, number> = {
  diseased: 12,
  sick: 34,
  average: 56,
  good: 78,
  perfect: 100,
};
