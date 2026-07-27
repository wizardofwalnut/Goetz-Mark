import { useMemo } from 'react';
import type { CountyId } from '../domain/ids';
import type { GameMap, Point, Terrain } from '../domain/map/mapTypes';
import type { MatchState } from '../domain/match/matchState';
import { isDefended, troopCount, garrisonOf } from '../domain/match/matchState';
import { indexMap } from '../domain/map/mapQueries';
import { palette, seatColor, terrainTint, type } from './theme';
import { terrainArt } from '../assets/assetManifest';

/**
 * Static map render.
 *
 * SVG rather than canvas: the map is a few dozen polygons that change only on
 * turn boundaries, so there is nothing to gain from an imperative draw loop,
 * and SVG gives crisp borders at any zoom plus real hit targets for free when
 * interactivity lands.
 *
 * ART STATUS: the tinted terrain fills, ownership hatching and castle glyph in
 * this file are INTERIM stopgaps carrying the established palette, registered in
 * src/ui/interimArt.ts. All shipping art comes from PixelLab through the asset
 * manifest. Once tiles exist, `terrainArt()` returns a url and the same shapes
 * take a pattern fill — no structural change, which is the point of the
 * manifest.
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
              width="64"
              height="64"
              patternUnits="userSpaceOnUse"
            >
              <image href={art.url} width="64" height="64" />
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

        {/* Mountain ridges flanking the pass — decoration only. */}
        {map.scenery?.map((s, i) => (
          <path
            key={i}
            d={toPath(s.shape)}
            fill={palette.parchmentShadow}
            stroke={palette.inkLine}
            strokeWidth="1.4"
            opacity="0.75"
          />
        ))}

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
              {state?.castleTier !== 'none' && (
                <g filter="url(#castleShadow)" transform={`translate(${county.centroid.x}, ${county.centroid.y - 12})`}>
                  <CastleGlyph fill={seat !== null ? seatColor(seat).base : palette.inkLine} />
                </g>
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
 * INTERIM STOPGAP — not final art. See src/ui/interimArt.ts.
 *
 * Shipping castle markers come from PixelLab via `castleArt(tier)`. This exists
 * only so the board is readable before those are generated, and is deleted the
 * moment they land — a test fails if it outlives its replacement.
 */
function CastleGlyph({ fill }: { fill: string }) {
  return (
    <g fill={fill} stroke={palette.ink} strokeWidth="0.8">
      <path d="M-11,4 L-11,-4 L-7.5,-4 L-7.5,-7 L-4,-7 L-4,-4 L-1.5,-4 L-1.5,-9 L1.5,-9 L1.5,-4 L4,-4 L4,-7 L7.5,-7 L7.5,-4 L11,-4 L11,4 Z" />
      <rect x="-11" y="4" width="22" height="3.5" />
    </g>
  );
}
