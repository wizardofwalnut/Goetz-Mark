import { useMemo } from 'react';
import type { CountyId } from '../domain/ids';
import type { GameMap, Point, Terrain } from '../domain/map/mapTypes';
import type { MatchState } from '../domain/match/matchState';
import { isDefended, troopCount, garrisonOf } from '../domain/match/matchState';
import { indexMap } from '../domain/map/mapQueries';
import { palette, seatColor, terrainTint, type } from './theme';
import { armyArt, bannerArt, castleArt, terrainArt } from '../assets/assetManifest';
import type { CastleTier } from '../domain/match/matchState';

/**
 * Static map render.
 *
 * SVG rather than canvas: the map is a few dozen polygons that change only on
 * turn boundaries, so there is nothing to gain from an imperative draw loop,
 * and SVG gives crisp borders at any zoom plus real hit targets for free when
 * interactivity lands.
 *
 * ART STATUS: terrain now renders real PixelLab tiles through the manifest. The
 * ownership hatching and castle glyph in this file are still INTERIM stopgaps,
 * registered in src/ui/interimArt.ts.
 *
 * The `terrainTint` fill remains as a defensive fallback for a manifest entry
 * that resolves to nothing — it is error handling, not standing in as the art,
 * which is why it is no longer in the interim register.
 */

interface MapViewProps {
  readonly map: GameMap;
  readonly match: MatchState;
  readonly selected: CountyId | null;
  readonly onSelect: (id: CountyId) => void;
}

const toPath = (pts: readonly Point[]) =>
  `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}Z`;

const TERRAINS: readonly Terrain[] = ['open', 'forest', 'hills', 'chokepoint'];

/**
 * Size of one terrain tile in map units.
 *
 * Counties are roughly 300x200 units, so drawing the 64px tiles at their native
 * size gives only ~5x3 repeats per county and the motif reads as wallpaper
 * competing with the county labels. Smaller repeats read as texture instead.
 */
const TILE_UNITS = 30;

export function MapView({ map, match, selected, onSelect }: MapViewProps) {
  const ix = useMemo(() => indexMap(map), [map]);

  const ownerSeat = (id: CountyId): number | null => {
    const owner = match.counties[id]?.owner;
    if (!owner) return null;
    return match.players.find((p) => p.id === owner)?.seat ?? null;
  };

  const roads = map.borders.filter((b) => b.road);

  return (
    <svg
      className="map-svg"
      viewBox={`0 0 ${map.width} ${map.height}`}
      role="img"
      aria-label={`Map of ${map.name}`}
    >
      <defs>
        {/* Paper grain. Cheap, and it stops large fills reading as flat vector. */}
        <filter id="grain" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.16" intercept="0" />
          </feComponentTransfer>
          <feComposite operator="in" in2="SourceGraphic" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>

        {/* Soft vignette so the parchment sits inside the ink field. */}
        <radialGradient id="vignette" cx="50%" cy="45%" r="72%">
          <stop offset="60%" stopColor={palette.ink} stopOpacity="0" />
          <stop offset="100%" stopColor={palette.ink} stopOpacity="0.55" />
        </radialGradient>

        {/* One hatch per seat, so ownership survives a greyscale screenshot. */}
        {[0, 1, 2, 3].map((seat) => (
          <pattern
            key={seat}
            id={`hatch-${seat}`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${seat * 45})`}
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={seatColor(seat).base} strokeWidth="2.2" />
          </pattern>
        ))}

        <filter id="castleShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor={palette.ink} floodOpacity="0.5" />
        </filter>

        {/* Terrain tile patterns, defined only for terrains whose art actually
            resolves. Until PixelLab tiles land these produce nothing and the
            tinted fallback fill is used instead. */}
        {TERRAINS.map((t) => {
          const art = terrainArt(t);
          if (art.missing || !art.url) return null;
          return (
            <pattern
              key={t}
              id={`tile-${t}`}
              width={TILE_UNITS}
              height={TILE_UNITS}
              patternUnits="userSpaceOnUse"
            >
              <image href={art.url} width={TILE_UNITS} height={TILE_UNITS} />
            </pattern>
          );
        })}
      </defs>

      {/* Sea / backing */}
      <rect width={map.width} height={map.height} fill={palette.inkSoft} />

      <g filter="url(#grain)">
        {map.counties.map((county) => {
          const seat = ownerSeat(county.id);
          const isSelected = selected === county.id;
          const art = terrainArt(county.terrain);

          return (
            <g
              key={county.id}
              className="county"
              onClick={() => onSelect(county.id)}
              role="button"
              tabIndex={0}
              aria-label={`${county.name}, ${county.terrain}, ${county.resource}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(county.id);
              }}
            >
              {/* Base terrain. `art.missing` is expected until PixelLab tiles
                  land; the tinted fill is the designed fallback, not a stub. */}
              <path
                d={toPath(county.shape)}
                fill={art.missing ? terrainTint[county.terrain] : `url(#tile-${county.terrain})`}
              />

              {/* Ownership hatch, layered over terrain so both read at once. */}
              {seat !== null && (
                <path d={toPath(county.shape)} fill={`url(#hatch-${seat})`} opacity="0.34" />
              )}

              <path
                d={toPath(county.shape)}
                fill="none"
                stroke={seat !== null ? seatColor(seat).base : palette.inkLine}
                strokeWidth={seat !== null ? 2.6 : 1.6}
                strokeLinejoin="round"
                opacity={seat !== null ? 0.95 : 0.55}
              />

              {isSelected && (
                <path
                  d={toPath(county.shape)}
                  fill="none"
                  stroke={palette.goldBright}
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeDasharray="10 6"
                  className="county-selected"
                />
              )}
            </g>
          );
        })}

        {/* Roads drawn over county fills but under markers. */}
        <g className="roads">
          {roads.map((b) => {
            const a = ix.countyById.get(b.a);
            const c = ix.countyById.get(b.b);
            if (!a || !c) return null;
            return (
              <line
                key={`${b.a}-${b.b}`}
                x1={a.centroid.x}
                y1={a.centroid.y}
                x2={c.centroid.x}
                y2={c.centroid.y}
                stroke={palette.parchmentShadow}
                strokeWidth="3"
                strokeDasharray="1 9"
                strokeLinecap="round"
                opacity="0.8"
              />
            );
          })}
        </g>

        {/* County markers */}
        {map.counties.map((county) => {
          const state = match.counties[county.id];
          const seat = ownerSeat(county.id);
          const defended = isDefended(match, county.id);
          const troops = garrisonOf(match, county.id).reduce(
            (sum, a) => sum + troopCount(a.troops),
            0,
          );

          return (
            <g key={`marker-${county.id}`} pointerEvents="none">
              {state && state.castleTier !== 'none' && (
                <CastleMarker
                  tier={state.castleTier}
                  x={county.centroid.x}
                  y={county.centroid.y - 12}
                />
              )}

              {seat !== null && <BannerMarker seat={seat} x={county.centroid.x - 26} y={county.centroid.y - 14} />}

              {/* Armies standing here. The figure count reads small/medium/
                  large without the player reading a number. */}
              {troops > 0 && (
                <ArmyMarker troops={troops} x={county.centroid.x + 22} y={county.centroid.y - 8} />
              )}

              <text
                x={county.centroid.x}
                y={county.centroid.y + 16}
                textAnchor="middle"
                className="county-label"
                style={{ fontFamily: type.display }}
              >
                {county.name}
              </text>

              <text
                x={county.centroid.x}
                y={county.centroid.y + 31}
                textAnchor="middle"
                className="county-sub"
                style={{ fontFamily: type.numeric }}
              >
                {county.resource} · {county.yield}
              </text>

              {defended && (
                <g transform={`translate(${county.centroid.x}, ${county.centroid.y + 44})`}>
                  <rect
                    x="-19"
                    y="-9"
                    width="38"
                    height="17"
                    rx="3"
                    fill={palette.ink}
                    opacity="0.82"
                  />
                  <text
                    textAnchor="middle"
                    y="3.5"
                    className="garrison-count"
                    style={{ fontFamily: type.numeric }}
                    fill={seat !== null ? seatColor(seat).bright : palette.parchment}
                  >
                    ⚔ {troops}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>

      <rect width={map.width} height={map.height} fill="url(#vignette)" pointerEvents="none" />
    </svg>
  );
}

/**
 * Army standing in a county.
 *
 * Size is carried by the sprite itself — the manifest picks a one, two or
 * three figure sprite from the troop count, so the player reads strength at a
 * glance rather than from the garrison pill.
 */
function ArmyMarker({ troops, x, y }: { troops: number; x: number; y: number }) {
  const art = armyArt(troops);
  if (art.missing || !art.url) return null;
  return (
    <image
      href={art.url}
      x={x}
      y={y - 20}
      width="26"
      height="26"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

/** Seat index to banner id. Order matches `seatColors` in theme.ts. */
const SEAT_BANNERS = ['crimson', 'steel', 'gold', 'verdigris'] as const;

/**
 * Owner's banner planted beside the castle.
 *
 * This is a second, redundant ownership cue on purpose. The hatch fill carries
 * ownership for colour-blind and greyscale readers; the banner reads faster for
 * everyone else. Neither is load-bearing alone.
 */
function BannerMarker({ seat, x, y }: { seat: number; x: number; y: number }) {
  const art = bannerArt(SEAT_BANNERS[seat % SEAT_BANNERS.length] ?? 'crimson');
  if (art.missing || !art.url) return null;

  const w = 15;
  const h = 25;
  return (
    <image
      href={art.url}
      x={x}
      y={y - h / 2}
      width={w}
      height={h}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

/**
 * Castle marker — the generated sprite for the tier.
 *
 * There is no drawn fallback: castle art exists for every buildable tier, and
 * hand-authored SVG standing in for a sprite is exactly what this project does
 * not ship. A tier with no art simply renders nothing, which is visible enough
 * to notice and honest about what is missing.
 */
function CastleMarker({ tier, x, y }: { tier: CastleTier; x: number; y: number }) {
  const art = castleArt(tier);
  if (art.missing || !art.url) return null;

  const size = 34;
  return (
    <g filter="url(#castleShadow)" transform={`translate(${x}, ${y})`}>
      <image
        href={art.url}
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        style={{ imageRendering: 'pixelated' }}
      />
    </g>
  );
}
