import { useMemo, useState } from 'react';
import type { CountyId } from '../../domain/ids';
import type { CountyDef } from '../../domain/map/mapTypes';
import type { MatchState } from '../../domain/match/matchState';
import type { FieldTile, GroundKind, IndustrySiteState } from '../../domain/county/interior';
import {
  MAX_HERD_PER_FIELD,
  allowedTransitions,
  destroysCrop,
  stageOf,
} from '../../domain/county/interior';
import { projectProduction } from '../../domain/county/labour';
import {
  setFieldUse,
  setLabourSplit,
  toggleIndustry,
} from '../../domain/county/actions';
import { describeTurn, seasonOfTurn, type Season } from '../../domain/season';
import {
  bannerArt,
  castleArt,
  fieldArt,
  groundArt,
  industryArt,
  spriteArt,
} from '../../assets/assetManifest';
import { useLongPress } from '../useLongPress';
import { palette, seatColor } from '../theme';
import { CASTLES } from '../../content/castles';
import { LabourPanel } from './LabourPanel';
import { InfoSheet, type InfoContent } from './InfoSheet';

/**
 * County management screen.
 *
 * The second map level: an isometric view inside a single county, where the
 * player plants fields, staffs industry and allocates labour. The realm map
 * becomes the minimap beside it.
 *
 * INTERACTION CONVENTION, applied without exception: tap performs an action,
 * long-press opens read-only information. Every target on this screen goes
 * through useLongPress so the rule holds everywhere — a convention that is true
 * of most things is worse than no convention, because the player stops
 * trusting it.
 */

const TILE_W = 64;
const TILE_H = 32;

interface Props {
  readonly county: CountyDef;
  readonly match: MatchState;
  readonly onChange: (next: MatchState) => void;
  readonly onBack: () => void;
}

const isoX = (col: number, row: number) => ((col - row) * TILE_W) / 2;
const isoY = (col: number, row: number) => ((col + row) * TILE_H) / 2;

/**
 * Generated isometric tiles are 64x64 BLOCKS: a 64x32 top face with roughly
 * another 32px of side depth below it. They must be drawn whole and unclipped —
 * clipping to the flat diamond shears the depth off and the county goes back to
 * looking like paper cut-outs. Painter's order (col+row) makes nearer blocks
 * overlap correctly.
 */
const TILE_IMG = 64;
const tileImageProps = (x: number, y: number) => ({
  x: x - TILE_W / 2,
  y: y - TILE_H / 2,
  width: TILE_IMG,
  height: TILE_IMG,
});

const diamond = (cx: number, cy: number) =>
  `${cx},${cy - TILE_H / 2} ${cx + TILE_W / 2},${cy} ${cx},${cy + TILE_H / 2} ${cx - TILE_W / 2},${cy}`;

const FIELD_TINT: Record<string, string> = {
  fallow: '#8a6f4a',
  barren: '#9c9382',
  cattle: '#7d9a5e',
  parched: '#b08a4f',
  flooded: '#5f7f96',
  grain: '#c9a227',
};

export function CountyScreen({ county, match, onChange, onBack }: Props) {
  const state = match.counties[county.id];
  const [info, setInfo] = useState<InfoContent | null>(null);
  const [editing, setEditing] = useState<FieldTile | null>(null);
  const [confirming, setConfirming] = useState<{ field: FieldTile; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const season = seasonOfTurn(match.turn.number);
  const interior = state?.interior ?? null;

  const projection = useMemo(() => {
    if (!interior || !state) return null;
    return projectProduction({
      interior,
      population: state.population,
      split: { agricultureShare: state.agricultureShare },
      season,
    });
  }, [interior, state, season]);

  if (!state || !interior) {
    return (
      <div className="county-screen">
        <p className="empty-hint">This county has no interior.</p>
      </div>
    );
  }

  const owner = state.owner ? match.players.find((p) => p.id === state.owner) : null;

  const dispatch = (result: ReturnType<typeof setFieldUse>) => {
    if (result.ok) {
      onChange(result.match);
      setError(null);
    } else {
      setError(result.reason);
    }
  };

  const changeField = (field: FieldTile, to: string, confirmed = false) =>
    dispatch(setFieldUse(match, county.id, field.id, to as FieldTile['status'], { confirmed }));

  // Painter's order: tiles further back drawn first so nearer ones overlap.
  const depth = (c: { col: number; row: number }) => c.col + c.row;
  const ordered = [...interior.fields].sort((a, b) => depth(a) - depth(b));
  const orderedGround = [...interior.ground].sort((a, b) => depth(a) - depth(b));

  // Headroom only above, for the castle and banner that overhang the town tile.
  const overhang = TILE_H * 1.5;
  const width = (interior.cols + interior.rows) * (TILE_W / 2) + TILE_W;
  const height = (interior.cols + interior.rows) * (TILE_H / 2) + TILE_H + overhang;
  const originX = width / 2;
  const originY = overhang + TILE_H / 2;

  return (
    <div className="county-screen">
      <header className="cs-head">
        <button className="cs-back" onClick={onBack} aria-label="Back to realm map">
          ‹ Realm
        </button>
        <div>
          <div className="cs-title">{county.name}</div>
          <div className="cs-sub">
            {describeTurn(match.turn.number)} ·{' '}
            {owner ? owner.displayName : 'Unclaimed'} · {CASTLES[state.castleTier].name}
          </div>
        </div>
      </header>

      <div className="cs-body">
        <div className="cs-map-wrap">
          <svg
            className="cs-map"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${county.name} fields`}
          >
            {/* Ground first — the surface everything else stands on. Most of a
                county is plain walkable ground with nothing to manage. */}
            {orderedGround.map((cell) => (
              <GroundCellView
                key={`g_${cell.col}_${cell.row}`}
                kind={cell.kind}
                season={season}
                x={originX + isoX(cell.col, cell.row)}
                y={originY + isoY(cell.col, cell.row)}
              />
            ))}

            {/* The bounded workable set, drawn over the ground. */}
            {ordered.map((field) => (
              <FieldTileView
                key={field.id}
                field={field}
                x={originX + isoX(field.col, field.row)}
                y={originY + isoY(field.col, field.row)}
                onTap={() => setEditing(field)}
                onInfo={() => setInfo(fieldInfo(field))}
              />
            ))}

            {/* The town sits above the fields it commands. */}
            <TownView
              x={originX + isoX(interior.town.col, interior.town.row)}
              y={originY + isoY(interior.town.col, interior.town.row)}
              castle={state.castleTier}
              seat={owner?.seat ?? null}
              onTap={() => setInfo(labourInfo())}
              onInfo={() =>
                setInfo({
                  title: county.name,
                  lines: [
                    ['Population', String(state.population)],
                    ['Happiness', `${state.happiness}%`],
                    ['Castle', CASTLES[state.castleTier].name],
                    ['Rations', `${(state.rationLevel * 100).toFixed(0)}%`],
                  ],
                })
              }
            />

            {interior.industry.map((site) => (
              <IndustryView
                key={site.kind}
                site={site}
                x={originX + isoX(site.col, site.row)}
                y={originY + isoY(site.col, site.row)}
                onTap={() => dispatch(toggleIndustry(match, county.id, site.kind))}
                onInfo={() =>
                  setInfo({
                    title: SITE_LABEL[site.kind] ?? site.kind,
                    lines: [
                      ['Status', site.active ? 'Working' : 'Idle'],
                      ['Workers', String(site.workers)],
                      ...(site.weapon ? ([['Forging', site.weapon]] as [string, string][]) : []),
                    ],
                    note: site.active
                      ? 'Tap to shut it down.'
                      : 'Tap to put it to work. Idle sites draw no labour.',
                  })
                }
              />
            ))}
          </svg>
        </div>

        <LabourPanel
          share={state.agricultureShare}
          projection={projection}
          season={season}
          onShare={(v) => dispatch(setLabourSplit(match, county.id, v))}
        />
      </div>

      {error && (
        <div className="cs-error" role="alert" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {editing && (
        <FieldUsePanel
          field={editing}
          onClose={() => setEditing(null)}
          onPick={(to) => {
            if (destroysCrop(editing)) {
              setConfirming({ field: editing, to });
            } else {
              changeField(editing, to);
              setEditing(null);
            }
          }}
        />
      )}

      {confirming && (
        <div className="cs-confirm-backdrop">
          <div className="cs-confirm">
            <div className="cs-confirm-title">Destroy the standing crop?</div>
            <p className="note">
              This field is carrying a crop that has not been harvested. Changing its
              use now loses it.
            </p>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="chip"
                onClick={() => {
                  setConfirming(null);
                  setEditing(null);
                }}
              >
                Keep the crop
              </button>
              <button
                className="chip danger"
                onClick={() => {
                  changeField(confirming.field, confirming.to, true);
                  setConfirming(null);
                  setEditing(null);
                }}
              >
                Plough it under
              </button>
            </div>
          </div>
        </div>
      )}

      {info && <InfoSheet content={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

const SITE_LABEL: Record<IndustrySiteState['kind'], string> = {
  quarry: 'Quarry',
  mine: 'Mine',
  lumberMill: 'Lumber Mill',
  blacksmith: 'Blacksmith',
};

function fieldInfo(field: FieldTile): InfoContent {
  const stage = stageOf(field);
  return {
    title: `Field ${field.col + 1}-${field.row + 1}`,
    lines: [
      ['Use', field.status],
      ...(stage ? ([['Crop', stage]] as [string, string][]) : []),
      ...(field.status === 'cattle'
        ? ([['Herd', `${field.herd} / ${MAX_HERD_PER_FIELD}`]] as [string, string][])
        : []),
      ...(field.status === 'barren'
        ? ([['Reclaimed', `${Math.round(field.reclaimed * 100)}%`]] as [string, string][])
        : []),
    ],
    note:
      field.status === 'barren'
        ? 'Barren land must be reclaimed before anything will grow.'
        : field.herd >= MAX_HERD_PER_FIELD
          ? 'Overcrowded — open another pasture to keep the herd growing.'
          : undefined,
  };
}

const labourInfo = (): InfoContent => ({
  title: 'County town',
  lines: [],
  note: 'Drag the labour slider below to move workers between field and forge.',
});

const GROUND_TINT: Record<GroundKind, string> = {
  ground: '#6f7d4f',
  forest: '#3f5238',
  mountain: '#6d6659',
  water: '#3f5f74',
};

/**
 * A plain ground cell.
 *
 * Deliberately NOT interactive: generic ground has nothing to assign, and
 * making it tappable would teach players that every tile does something.
 */
function GroundCellView({
  kind,
  season,
  x,
  y,
}: {
  kind: GroundKind;
  season: Season;
  x: number;
  y: number;
}) {
  const art = groundArt(kind, season);

  if (art.missing || !art.url) {
    return (
      <g pointerEvents="none">
        <polygon points={diamond(x, y)} fill={GROUND_TINT[kind]} />
        <polygon
          points={diamond(x, y)}
          fill="none"
          stroke={palette.ink}
          strokeWidth="0.5"
          opacity="0.35"
        />
      </g>
    );
  }

  return (
    <image
      href={art.url}
      {...tileImageProps(x, y)}
      pointerEvents="none"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function FieldTileView({
  field,
  x,
  y,
  onTap,
  onInfo,
}: {
  field: FieldTile;
  x: number;
  y: number;
  onTap: () => void;
  onInfo: () => void;
}) {
  const { handlers, holding } = useLongPress({ onTap, onInfo });
  const art = fieldArt(field.status, stageOf(field));

  return (
    <g className={`cs-tile${holding ? ' cs-holding' : ''}`} {...handlers}>
      {art.missing || !art.url ? (
        <polygon
          points={diamond(x, y)}
          fill={FIELD_TINT[field.status] ?? '#8a6f4a'}
          pointerEvents="none"
        />
      ) : (
        <image
          href={art.url}
          {...tileImageProps(x, y)}
          pointerEvents="none"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
      {/* Fields must read as workable at a glance even when fallow — this ring
          is what separates the bounded set from the generic ground around it. */}
      <polygon
        points={diamond(x, y)}
        fill="none"
        stroke={palette.parchmentDeep}
        strokeWidth="1.2"
        opacity="0.7"
      />
      {/* Herd size reads from sprite count, not a number the player looks up. */}
      {field.status === 'cattle' &&
        Array.from({ length: field.herd }).map((_, i) => (
          <CowSprite key={i} x={x - 12 + i * 11} y={y - 4} />
        ))}

      {/* The ONLY hit target: the visible top face. The block art is drawn
          unclipped so its side depth shows, which makes each image rectangle
          overlap its neighbours — without this, taps land on whichever tile
          happened to render last rather than the one under the finger. Top-face
          diamonds tile exactly and never overlap, so this is precise. */}
      <polygon points={diamond(x, y)} fill="transparent" />
    </g>
  );
}

function CowSprite({ x, y }: { x: number; y: number }) {
  const art = spriteArt('cow');
  if (art.missing || !art.url) {
    return <circle cx={x} cy={y} r="3.5" fill={palette.parchment} stroke={palette.ink} strokeWidth="1" />;
  }
  return (
    <image
      href={art.url}
      x={x - 7}
      y={y - 9}
      width="14"
      height="14"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function TownView({
  x,
  y,
  castle,
  seat,
  onTap,
  onInfo,
}: {
  x: number;
  y: number;
  castle: MatchState['counties'][CountyId]['castleTier'];
  seat: number | null;
  onTap: () => void;
  onInfo: () => void;
}) {
  const { handlers, holding } = useLongPress({ onTap, onInfo });
  const art = castleArt(castle);

  return (
    <g className={`cs-tile${holding ? ' cs-holding' : ''}`} {...handlers}>
      <polygon points={diamond(x, y)} fill="#6b5a44" stroke={palette.inkLine} strokeWidth="1" />
      {!art.missing && art.url && (
        <image
          href={art.url}
          x={x - 22}
          y={y - 36}
          width="44"
          height="44"
          style={{ imageRendering: 'pixelated' }}
        />
      )}
      {/* Owner's banner flies over a held town. */}
      {seat !== null && <TownBanner seat={seat} x={x + 14} y={y - 40} />}
    </g>
  );
}

/** Seat index to banner id — same order as seatColors in theme.ts. */
const SEAT_BANNERS = ['crimson', 'steel', 'gold', 'verdigris'] as const;

function TownBanner({ seat, x, y }: { seat: number; x: number; y: number }) {
  const art = bannerArt(SEAT_BANNERS[seat % SEAT_BANNERS.length] ?? 'crimson');
  if (art.missing || !art.url) {
    return <rect x={x} y={y} width="9" height="7" fill={seatColor(seat).bright} />;
  }
  return (
    <image
      href={art.url}
      x={x}
      y={y}
      width="14"
      height="24"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function IndustryView({
  site,
  x,
  y,
  onTap,
  onInfo,
}: {
  site: IndustrySiteState;
  x: number;
  y: number;
  onTap: () => void;
  onInfo: () => void;
}) {
  const { handlers, holding } = useLongPress({ onTap, onInfo });
  const art = industryArt(site.kind, site.active);

  return (
    <g className={`cs-tile${holding ? ' cs-holding' : ''}`} {...handlers}>
      {/* A sprite standing ON the ground, never a tile of its own. Only the
          active ring is drawn on the tile beneath it. */}
      {site.active && (
        <polygon
          points={diamond(x, y)}
          fill="none"
          stroke={palette.gold}
          strokeWidth="1.8"
          opacity="0.9"
        />
      )}
      {!art.missing && art.url ? (
        <image
          href={art.url}
          x={x - 20}
          y={y - 32}
          width="40"
          height="40"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <text x={x} y={y + 4} textAnchor="middle" className="cs-site-label">
          {SITE_LABEL[site.kind]}
        </text>
      )}
    </g>
  );
}

function FieldUsePanel({
  field,
  onPick,
  onClose,
}: {
  field: FieldTile;
  onPick: (to: string) => void;
  onClose: () => void;
}) {
  const options = allowedTransitions(field);

  return (
    <div className="cs-sheet-backdrop" onClick={onClose}>
      <div className="cs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cs-sheet-title">
          Field {field.col + 1}-{field.row + 1} · currently {field.status}
        </div>
        {options.length === 0 ? (
          <p className="note">
            {field.status === 'barren'
              ? `Reclaim this land first — ${Math.round(field.reclaimed * 100)}% done.`
              : 'Storm-damaged. Nothing can be done until it settles.'}
          </p>
        ) : (
          <div className="row">
            {options.map((o) => (
              <button key={o} className="chip" onClick={() => onPick(o)}>
                {o === 'fallow' ? 'Leave fallow' : o === 'grain' ? 'Sow grain' : 'Graze cattle'}
              </button>
            ))}
          </div>
        )}
        <button className="chip cs-sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
