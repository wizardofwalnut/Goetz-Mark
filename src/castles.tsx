import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BUILDABLE_TIERS, CASTLES } from './content/castles';
import type { CastleTier } from './domain/match/matchState';
import type { MaterialResource } from './domain/resources';
import {
  overheadCastleArt,
  overheadGroundArt,
  resourceArt,
} from './assets/assetManifest';
import { ART_SCALE, ART_TILE_PX, STRIDE_Y, TILE_W, cellCentre } from './ui/county/overheadCamera';
import './ui/styles.css';

/**
 * Castle ladder preview — DEV PAGE, not part of the game.
 *
 * The county map only ever draws whichever tier a county currently holds, so
 * the five have never been seen side by side. The one question a tier preview
 * exists to answer is whether each step LOOKS like an upgrade on the one
 * before it — a ladder where tier four reads as weaker than tier three is a
 * ladder players resent paying for — and that can only be judged in a row.
 *
 * Two things here are deliberate rather than incidental:
 *
 *   1. Each castle is drawn at MAP SCALE on the map's own ground tile, through
 *      the same geometry the county screen uses. A castle previewed large on a
 *      dark background says nothing about whether it reads at 59pt tiles.
 *   2. The source canvases differ (64/64/72/80/96px) because the ladder is
 *      meant to grow physically. Footprints are proportional to canvas size
 *      rather than normalised, or the preview would hide the very progression
 *      it is meant to show.
 *
 * Every number comes from src/content/castles.ts. Nothing is retyped here, so
 * the preview cannot drift from what the game actually charges.
 */

/** Widest canvas in the set. Footprints scale against it. */
const REFERENCE_PX = 96;

/** Source canvas size per tier, which is what encodes the ladder's growth. */
const CANVAS_PX: Record<Exclude<CastleTier, 'none'>, number> = {
  woodenPalisade: 64,
  motteAndBailey: 64,
  normanKeep: 72,
  stoneCastle: 80,
  royalCastle: 96,
};

/** A 3x3 patch of the map's own ground, with the castle standing on it. */
function TierPlot({ tier }: { tier: Exclude<CastleTier, 'none'> }) {
  const art = overheadCastleArt(tier);
  const ground = overheadGroundArt('ground');

  const cols = 3;
  const rows = 3;
  const width = cols * TILE_W;
  const height = (rows - 1) * STRIDE_Y + Math.round(TILE_W * (29 / 32));

  // Footprint in tiles, proportional to the source canvas so the biggest
  // castle covers the most ground — the same relationship the map shows.
  const size = 1.9 * (CANVAS_PX[tier] / REFERENCE_PX);
  const centre = cellCentre(1, 1);
  const w = TILE_W * size;

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) cells.push({ col, row });
  }

  return (
    <svg
      className="tier-plot"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={CASTLES[tier].name}
    >
      {cells.map((c) => (
        <image
          key={`${c.col},${c.row}`}
          href={ground.url ?? ''}
          x={c.col * TILE_W}
          y={c.row * STRIDE_Y}
          width={ART_TILE_PX * ART_SCALE}
          height={ART_TILE_PX * ART_SCALE}
          style={{ imageRendering: 'pixelated' }}
        />
      ))}
      {!art.missing && art.url && (
        <image
          href={art.url}
          x={centre.x - w / 2}
          y={centre.y + STRIDE_Y / 2 - w}
          width={w}
          height={w}
          style={{ imageRendering: 'pixelated' }}
        />
      )}
    </svg>
  );
}

/** Cost line: picture of the material plus a number, as everywhere else. */
function Cost({ cost }: { cost: Partial<Record<MaterialResource, number>> }) {
  const entries = (Object.keys(cost) as MaterialResource[]).filter((k) => (cost[k] ?? 0) > 0);
  if (entries.length === 0) return <span className="tier-free">no cost</span>;

  return (
    <div className="tier-cost">
      {entries.map((resource) => {
        const art = resourceArt(resource);
        return (
          <span className="ov-readout" key={resource} title={resource}>
            {art.missing || !art.url ? (
              <span className="ov-chip" aria-hidden />
            ) : (
              <img src={art.url} alt={resource} width={24} height={24} />
            )}
            <span className="ov-num">{cost[resource]}</span>
          </span>
        );
      })}
    </div>
  );
}

function Ladder() {
  return (
    <div className="tiers">
      <h1 className="tiers-head">Castle tiers, at map scale</h1>
      <p className="tiers-sub">
        Weakest to strongest. Each stands on the map&rsquo;s own ground at the size it
        renders in a county.
      </p>

      <div className="tiers-row">
        {BUILDABLE_TIERS.map((tier, i) => {
          const spec = CASTLES[tier];
          return (
            <div className="tier" key={tier}>
              <TierPlot tier={tier as Exclude<CastleTier, 'none'>} />
              <div className="tier-rank">Tier {i + 1}</div>
              <div className="tier-name">{spec.name}</div>
              <p className="tier-blurb">{spec.blurb}</p>
              <Cost cost={spec.cost} />
              <div className="tier-stats">
                <span>
                  <b>{spec.seasons}</b> season{spec.seasons === 1 ? '' : 's'}
                </span>
                <span>
                  defence <b>&times;{spec.defence}</b>
                </span>
                <span>
                  garrison <b>+{spec.garrisonBonus}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Ladder />
  </StrictMode>,
);
