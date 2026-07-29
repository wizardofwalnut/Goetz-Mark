import { useEffect, useMemo, useRef, useState } from 'react';
import type { CountyId } from '../../domain/ids';
import type { CountyDef, GameMap } from '../../domain/map/mapTypes';
import type { MatchState } from '../../domain/match/matchState';
import { isDefended } from '../../domain/match/matchState';
import { healthFromRations, projectProduction, type Health } from '../../domain/county/labour';
import type { Resource } from '../../domain/resources';
import { describeTurn, seasonOfTurn } from '../../domain/season';
import {
  castleFlagArt,
  overheadCastleArt,
  overheadTownArt,
  overheadWagonArt,
  resourceArt,
} from '../../assets/assetManifest';
import { palette } from '../theme';
import { Minimap } from './Minimap';
import {
  ART_SCALE,
  STRIDE_Y,
  TILE_W,
  cellCentre,
  type Cell,
} from './overheadCamera';
import {
  focusScroll,
  townOf,
  toWorld,
  worldLayout,
  worldRoad,
  worldSize,
  type WorldLayout,
  type WorldPlot,
} from './worldCamera';
import {
  BAKE_PAD_PX,
  GROUND_LAYERS,
  bakeCounty,
  type BakedCounty,
} from './bakeCounty';

/**
 * The living map — ONE WORLD, all counties, scrollable.
 *
 * This replaces the single-county overhead view. A county screen that stopped
 * at its own border made marching an army into a neighbour a thing that
 * happened somewhere the player could not see; here the counties are laid side
 * by side on one surface, the roads join across the seams, and a march is
 * something you watch rather than something you read about afterwards.
 *
 * ARCHITECTURE, because the file is much smaller than the surface it draws:
 *
 * The land is BAKED. Ground, terrain, roads and industry never change for a
 * whole match, and fields change at most once a season, so all of it is
 * composed into flat bitmaps by bakeCounty.ts — four per county — rather than
 * drawn a tile at a time. Tile by tile this world is roughly 800 live <image>
 * elements the browser must lay out and composite on every drag; baked it is
 * sixteen, plus a dozen live sprites for the things that actually move.
 *
 * Everything still resolves through the asset manifest. There is not one image
 * path in this file, or in the bake.
 */

interface Props {
  readonly map: GameMap;
  readonly match: MatchState;
  /** Which county the camera opens on. */
  readonly initialFocus?: CountyId;
}

/**
 * How many county-columns fill the screen's width.
 *
 * THE ZOOM CONTROL, and the reason the SVG no longer simply fits its stage.
 * Sized to a county rather than to the world: letting a 14-column world scale
 * to fit would halve every tile and undo the whole "tiles big enough to tap"
 * decision. One county across, and the rest of the world is scrolled to.
 */
const VIEW_COLS = 7;

export function LivingMap({ map, match, initialFocus }: Props) {
  const layout = useMemo(() => worldLayout(map, match), [map, match]);
  const [focus, setFocus] = useState<CountyId | null>(initialFocus ?? null);

  if (!layout) return <p className="empty-hint">This map cannot be tiled into a world.</p>;

  return (
    <div className="ov">
      <TopBar match={match} label={describeTurn(match.turn.number)} />
      <World layout={layout} map={map} match={match} focus={focus} onFocus={setFocus} />
      <FocusStrip layout={layout} match={match} focus={focus} />
    </div>
  );
}

/** The scrolling surface. */
function World({
  layout,
  map,
  match,
  focus,
  onFocus,
}: {
  layout: WorldLayout;
  map: GameMap;
  match: MatchState;
  focus: CountyId | null;
  onFocus: (id: CountyId) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const surface = useRef<SVGSVGElement>(null);
  const [baked, setBaked] = useState<ReadonlyMap<CountyId, BakedCounty> | null>(null);
  const [view, setView] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const { width, height } = worldSize(layout);
  const masks = useMemo(() => worldRoad(layout), [layout]);

  // Compose the land. Async because the art has to decode first, so the world
  // shows nothing for a frame rather than showing a half-built map.
  useEffect(() => {
    let live = true;
    const made: BakedCounty[] = [];

    void (async () => {
      const entries = new Map<CountyId, BakedCounty>();
      for (const plot of layout.plots) {
        const county = await bakeCounty(plot, masks);
        made.push(county);
        entries.set(plot.county.id, county);
      }
      if (!live) {
        for (const county of made) county.release();
        return;
      }
      setBaked(entries);
    })();

    return () => {
      live = false;
      for (const county of made) county.release();
    };
  }, [layout, masks]);

  // Track where the camera is, so the minimap can show it. Passive, and it only
  // ever writes numbers the indicator needs — nothing here re-renders the map.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () =>
      setView({
        left: el.scrollLeft,
        top: el.scrollTop,
        width: el.clientWidth,
        height: el.clientHeight,
      });
    read();
    el.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      el.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [baked]);

  // Fly to the focused county's town centre. `smooth` only after the first
  // placement: opening the map already scrolled somewhere is right, opening it
  // visibly sliding into position is not.
  const settled = useRef(false);
  useEffect(() => {
    const el = stage.current;
    const svg = surface.current;
    if (!el || !svg || !focus) return;
    const plot = layout.plots.find((p) => p.county.id === focus);
    if (!plot) return;

    // User units to rendered pixels. The surface is drawn at a fixed cell size
    // and then scaled by CSS to whatever width the stage gives it.
    const scale = svg.clientWidth / width;
    if (!scale) return;

    const { left, top } = focusScroll(
      townOf(plot),
      scale,
      { width: el.clientWidth, height: el.clientHeight },
      { width: svg.clientWidth, height: svg.clientHeight },
    );
    el.scrollTo({ left, top, behavior: settled.current ? 'smooth' : 'auto' });
    settled.current = true;
  }, [focus, layout, width, baked]);

  const season = seasonOfTurn(match.turn.number);

  return (
    <>
      <div className="ov-stage" ref={stage}>
        <svg
          ref={surface}
          className="ov-map"
          viewBox={`0 0 ${width} ${height}`}
          // Sized to the COUNTY, not the world — see VIEW_COLS.
          style={{ width: `${(layout.cols / VIEW_COLS) * 100}%` }}
          role="img"
          aria-label={`The realm, seen from above in ${season}`}
        >
          {baked && <Land layout={layout} baked={baked} />}
          {baked && <Movers layout={layout} match={match} />}
        </svg>
      </div>

      {/*
        OUTSIDE the stage, deliberately. The minimap used to sit inside it,
        which was harmless while the county fitted the screen — but the world
        scrolls, and an absolutely positioned child of a scroll container
        scrolls with the content. Travelling to another county carried the
        minimap off the screen with the land, taking the travel control away at
        exactly the moment it was being used.
      */}
      <div className="ov-corner">
        <Minimap
          map={map}
          match={match}
          focus={focus}
          onFocus={onFocus}
          aspect={height / width}
          viewport={viewportInWorld(view, surface.current, width, height)}
        />
      </div>
    </>
  );
}

/**
 * The camera's rectangle, in world cell units, for the minimap to draw.
 *
 * Returns null until the surface has been laid out — a viewport indicator sized
 * from a zero-width element would cover the whole minimap and read as "you are
 * everywhere", which is worse than showing nothing.
 */
function viewportInWorld(
  view: { left: number; top: number; width: number; height: number },
  svg: SVGSVGElement | null,
  worldW: number,
  worldH: number,
) {
  if (!svg || !svg.clientWidth || !view.width) return null;
  const scale = svg.clientWidth / worldW;
  if (!scale) return null;
  return {
    x: view.left / scale / TILE_W,
    y: view.top / scale / STRIDE_Y,
    width: view.width / scale / TILE_W,
    height: view.height / scale / STRIDE_Y,
    worldCols: worldW / TILE_W,
    worldRows: worldH / STRIDE_Y,
  };
}

/**
 * The baked land.
 *
 * ALL ground layers for EVERY county, then all prop layers. That order is
 * load-bearing rather than tidy: a county's bitmap overlaps upward onto the one
 * above it, so drawing county-by-county would let Ravensgate's grass paint over
 * the woods standing on Hollowmere's bottom row — the same clipping that once
 * rendered a knight as a head and a flag, moved to the seams.
 */
function Land({
  layout,
  baked,
}: {
  layout: WorldLayout;
  baked: ReadonlyMap<CountyId, BakedCounty>;
}) {
  const sheet = (plot: WorldPlot, which: 'ground' | 'props') => {
    const county = baked.get(plot.county.id);
    if (!county) return null;
    const wanted = county.layers.filter((l) =>
      which === 'props' ? l.name === 'props' : GROUND_LAYERS.includes(l.name),
    );
    // The bake is padded so props overhanging a county's edge survive the crop;
    // that padding is offset back out here so cell (0,0) still lands where the
    // camera says it does.
    const x = plot.origin.col * TILE_W - BAKE_PAD_PX * ART_SCALE;
    const y = plot.origin.row * STRIDE_Y - BAKE_PAD_PX * ART_SCALE;

    return wanted.map((layer) => (
      <image
        key={`${plot.county.id}-${layer.name}`}
        href={layer.url}
        x={x}
        y={y}
        width={county.width * ART_SCALE}
        height={county.height * ART_SCALE}
        style={{ imageRendering: 'pixelated' }}
      />
    ));
  };

  // Row-major, so a county lower in the world draws over the one above it.
  const ordered = [...layout.plots].sort(
    (a, b) => a.origin.row - b.origin.row || a.origin.col - b.origin.col,
  );

  return (
    <>
      <g>{ordered.map((plot) => sheet(plot, 'ground'))}</g>
      <g>{ordered.map((plot) => sheet(plot, 'props'))}</g>
    </>
  );
}

/**
 * Everything that is not land: the buildings and the traffic.
 *
 * Live rather than baked because these change on a turn's timescale — a castle
 * is built, a flag goes up when a garrison arrives, the caravan moves. There
 * are about a dozen of them across the whole world, so they cost nothing to
 * keep as real elements, and being real elements is what will let them be
 * tapped once the map becomes interactive.
 */
function Movers({ layout, match }: { layout: WorldLayout; match: MatchState }) {
  const sprites: { row: number; el: JSX.Element }[] = [];

  for (const plot of layout.plots) {
    const state = match.counties[plot.county.id];
    if (!state) continue;
    const { interior, origin } = plot;

    const town = toWorld(origin, interior.town);
    sprites.push({
      row: town.row,
      el: (
        <MapSprite
          key={`${plot.county.id}-town`}
          cell={town}
          art={overheadTownArt()}
          size={1.9}
          label={`${plot.county.name} town centre`}
        />
      ),
    });

    if (state.castleTier !== 'none') {
      const keep = toWorld(origin, interior.castle);
      sprites.push({
        row: keep.row,
        el: (
          <MapSprite
            key={`${plot.county.id}-keep`}
            cell={keep}
            art={overheadCastleArt(state.castleTier)}
            size={1.5}
            label={`${plot.county.name} castle`}
          />
        ),
      });

      // Flag up only when there are men inside. An empty keep shelters nobody
      // and adds nothing to the defence, so "is it manned?" is the single most
      // useful thing this screen can tell an attacker at a glance.
      const holder = state.owner ? match.players.find((p) => p.id === state.owner) : null;
      if (holder && isDefended(match, plot.county.id)) {
        sprites.push({
          row: keep.row,
          el: (
            <MapSprite
              key={`${plot.county.id}-flag`}
              cell={keep}
              art={castleFlagArt(holder.seat)}
              size={1.0}
              offset={{ x: 0.34, y: -1.15 }}
              label={`${plot.county.name} garrisoned`}
            />
          ),
        });
      }
    }

    // The caravan, if it is in this county. Its cell always sits on a road —
    // county/movement.ts is what guarantees a wagon can never be anywhere else.
    if (match.merchant && match.merchant.county === plot.county.id) {
      const at = toWorld(origin, match.merchant.at);
      sprites.push({
        row: at.row,
        el: (
          <MapSprite
            key="merchant"
            cell={at}
            art={overheadWagonArt()}
            size={1.15}
            label="Merchant caravan"
          />
        ),
      });
    }
  }

  // GARRISONED ARMIES ARE NOT DRAWN. A garrison is inside its castle, and the
  // flag above the keep already says so — a token standing in the field beside
  // it would say the men are in the field, which is the opposite. Armies appear
  // when they take the road, and the world grid this file now draws on is the
  // coordinate space a marching army will live in.

  sprites.sort((a, b) => a.row - b.row);
  return <>{sprites.map((s) => s.el)}</>;
}

/**
 * A sprite standing on a tile.
 *
 * Anchored bottom-centre to the middle of the tile's top face, so it sits ON
 * the ground rather than floating over it. Its height then rises up the screen
 * — which is what gives the overhead view its relief. `bakeCounty` follows the
 * same rule for baked props, so a wood and a castle stand the same way.
 */
function MapSprite({
  cell,
  art,
  size,
  label,
  offset,
}: {
  cell: Cell;
  art: { url: string | null; missing: boolean };
  /** Sprite footprint in tiles. A town covers more ground than a forge. */
  size: number;
  label: string;
  /** Nudge within the cell, in tiles. Lets several figures share one cell. */
  offset?: { readonly x: number; readonly y: number };
}) {
  if (art.missing || !art.url) return null;
  const centre = cellCentre(cell.col, cell.row);
  const w = TILE_W * size;

  return (
    <image
      href={art.url}
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

/**
 * Everything that pools empire-wide, materials first and money last.
 *
 * These four and no others. What they have in common is that they need no
 * shipping decision, which is exactly why a single realm-wide total is a true
 * statement about them. Food is deliberately absent for the opposite reason —
 * it is held per county and must be carted, so one number for it would be a lie
 * however convenient.
 */
const POOLED_RESOURCES = ['wood', 'stone', 'ore', 'gold'] as const;

/**
 * Top bar — an OVERLAY, not a header.
 *
 * It floats over the map rather than taking a strip of its own, so the land
 * runs full-bleed to the top of the screen. On a phone the map is the thing
 * worth the pixels; chrome that reserves its own band costs a row of county for
 * information that is only glanced at.
 *
 * Year and season, then each material as picture plus number. No labels: the
 * governing principle is images over words, and a player who cannot tell ore
 * from stone at a glance is not helped by a five-letter caption under it — they
 * are helped by the two icons not looking alike, which is a job for the art.
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

/** The summary strip, showing whichever county the camera is looking at. */
function FocusStrip({
  layout,
  match,
  focus,
}: {
  layout: WorldLayout;
  match: MatchState;
  focus: CountyId | null;
}) {
  const plot = layout.plots.find((p) => p.county.id === focus) ?? layout.plots[0];
  if (!plot) return null;
  return <CountyStrip county={plot.county} match={match} />;
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
      <span className="ov-where" style={{ color: palette.parchment }}>
        {county.name}
      </span>
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
