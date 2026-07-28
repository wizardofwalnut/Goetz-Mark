import type { CountyDef } from '../../domain/map/mapTypes';
import type { GameMap } from '../../domain/map/mapTypes';
import type { MatchState } from '../../domain/match/matchState';
import type { FieldTile, GroundCell, IndustrySiteState } from '../../domain/county/interior';
import { stageOf } from '../../domain/county/interior';
import { healthFromRations, projectProduction, type Health } from '../../domain/county/labour';
import type { Resource } from '../../domain/resources';
import { describeTurn, seasonOfTurn } from '../../domain/season';
import {
  overheadCastleArt,
  overheadFieldArt,
  overheadGroundArt,
  overheadIndustryArt,
  overheadRoadArt,
  overheadTownArt,
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
  const masks = roadMasks(interior.road, { cols: interior.cols, rows: interior.rows });

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
  for (const cell of interior.road) {
    const mask = masks[`${cell.col},${cell.row}`];
    if (mask === undefined) continue;
    put(cell.row, <RoadTile key={`r${cell.col}_${cell.row}`} cell={cell} mask={mask} />);
  }
  for (const field of interior.fields) {
    put(field.row, <FieldSquare key={field.id} field={field} />);
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
 * A field.
 *
 * Fields must read as workable at a glance even when fallow — that difference
 * from generic ground is the whole reason the bounded 8-16 set exists. The
 * art carries most of it (furrows against meadow), and a soft boundary line
 * around the block does the rest without adding UI chrome to the land.
 */
function FieldSquare({ field }: { field: FieldTile }) {
  const art = overheadFieldArt(field.status, stageOf(field));
  if (art.missing || !art.url) {
    return <rect {...tileBox(field.col, field.row)} fill={palette.parchmentDeep} />;
  }
  return <image href={art.url} {...tileBox(field.col, field.row)} />;
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
}: {
  col: number;
  row: number;
  url: string;
  /** Sprite footprint in tiles. A town covers more ground than a forge. */
  size: number;
  label: string;
}) {
  const centre = cellCentre(col, row);
  const w = TILE_W * size;
  return (
    <image
      href={url}
      x={centre.x - w / 2}
      y={centre.y + STRIDE_Y / 2 - w}
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

function IndustrySprite({ site }: { site: IndustrySiteState }) {
  const art = overheadIndustryArt(site.kind);
  if (art.missing || !art.url) return null;
  return <MapSprite col={site.col} row={site.row} url={art.url} size={1.15} label={site.kind} />;
}

/**
 * Top bar.
 *
 * Year and season, then the globally pooled raw materials as picture plus
 * number. No labels: the governing principle is images over words, and a
 * player who cannot tell ore from wood at a glance will not be helped by a
 * four-letter caption under it either.
 */
function TopBar({ match, label }: { match: MatchState; label: string }) {
  const you = match.players[0];
  // Materials pool empire-wide, so they belong in the top bar rather than in
  // any one county's panel — there is no shipping decision attached to them.
  const purse = you ? match.treasuries[you.id] : undefined;

  return (
    <header className="ov-top">
      <div className="ov-when">{label}</div>
      <div className="ov-res">
        <Readout resource="ore" value={purse?.ore ?? 0} />
        <Readout resource="wood" value={purse?.wood ?? 0} />
        <Readout resource="stone" value={purse?.stone ?? 0} />
        <Readout resource="gold" value={purse?.gold ?? 0} />
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
        <img src={art.url} alt={resource} width={22} height={22} />
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
