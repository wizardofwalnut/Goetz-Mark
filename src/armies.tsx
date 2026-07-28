import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { armyBearerArt, armySizeBand, armySoldierArt, overheadGroundArt } from './assets/assetManifest';
import { seatColors } from './ui/theme';
import { ART_SCALE, ART_TILE_PX, STRIDE_Y, TILE_W, cellCentre } from './ui/county/overheadCamera';
import './ui/styles.css';

/**
 * Army token preview — DEV PAGE, not part of the game.
 *
 * An army token answers two questions off the map: whose it is, and how big.
 * Neither can be judged from a sprite viewed large in isolation — the whole
 * question is whether four flags stay apart at the size they actually ship at,
 * roughly fifteen pixels of colour on a green field.
 *
 * So the grid is every seat at every size, drawn through the same geometry and
 * on the same ground the county map uses, and then repeated under greyscale and
 * a red-green colour-blindness filter. That last row is the point: "these are
 * easy to tell apart" is a claim, and a claim about colour should be shown
 * rather than asserted.
 */

/** Troop counts that sit in the middle of each band, per armySizeBand. */
const SAMPLE_TROOPS = [12, 50, 140];

/**
 * Where each figure stands within the cell, in tiles.
 *
 * A loose knot rather than a rank: men bunched the way a company would stand,
 * so two and three read as "more of them" instead of as a formation.
 */
const FIGURE_OFFSETS = [
  { x: 0, y: 0 },
  { x: 0.34, y: 0.42 },
  { x: -0.32, y: 0.46 },
] as const;

const FIGURES_FOR: Record<ReturnType<typeof armySizeBand>, number> = {
  small: 1,
  medium: 2,
  large: 3,
};

function Token({ seat, troops }: { seat: number; troops: number }) {
  const ground = overheadGroundArt('ground');
  const bearer = armyBearerArt(seat);
  const soldier = armySoldierArt();
  const count = FIGURES_FOR[armySizeBand(troops)];

  const cols = 3;
  const rows = 3;
  const width = cols * TILE_W;
  const height = (rows - 1) * STRIDE_Y + Math.round(TILE_W * (29 / 32));
  const centre = cellCentre(1, 1);
  const w = TILE_W * 1.15;

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) cells.push({ col, row });
  }

  // The bearer goes down LAST so his flag is never hidden behind a spearman.
  const figures = FIGURE_OFFSETS.slice(0, count)
    .map((offset, i) => ({ offset, art: i === 0 ? bearer : soldier, key: i }))
    .reverse();

  return (
    <svg
      className="tier-plot"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${seatColors[seat]?.name} army of ${troops}`}
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
      {figures.map(({ offset, art, key }) =>
        art.missing || !art.url ? null : (
          <image
            key={key}
            href={art.url}
            x={centre.x - w / 2 + offset.x * TILE_W}
            y={centre.y + STRIDE_Y / 2 - w + offset.y * STRIDE_Y}
            width={w}
            height={w}
            style={{ imageRendering: 'pixelated' }}
          />
        ),
      )}
    </svg>
  );
}

function Grid() {
  return (
    <div className="armies-grid">
      {seatColors.map((seat, i) => (
        <div className="armies-seat" key={seat.name}>
          <div className="armies-seat-name">
            <span className="armies-swatch" style={{ background: seat.base }} />
            {seat.name}
          </div>
          <div className="armies-sizes">
            {SAMPLE_TROOPS.map((troops) => (
              <div className="armies-cell" key={troops}>
                <Token seat={i} troops={troops} />
                <div className="armies-label">
                  {armySizeBand(troops)} · {troops}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Page() {
  return (
    <div className="tiers">
      <h1 className="tiers-head">Army tokens, at map scale</h1>
      <p className="tiers-sub">
        One flag per army whatever its size. The bearer carries the seat colour; the
        men beside him are in nobody&rsquo;s livery, so the count reads as strength
        rather than as more armies.
      </p>
      <Grid />

      <h2 className="armies-vision">Greyscale</h2>
      <p className="tiers-sub">Colour removed entirely — the worst case.</p>
      <div className="vision-grey">
        <Grid />
      </div>

      <h2 className="armies-vision">Red-green colour blindness</h2>
      <p className="tiers-sub">
        Roughly one man in twelve. If two flags merge here, the palette is wrong
        however good it looks above.
      </p>
      <div className="vision-deut">
        <Grid />
      </div>

      {/* The filter itself. Applied through CSS so the sprites above are the
          same elements, not a second set that could disagree with them. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="deuteranopia" colorInterpolationFilters="linearRGB">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0
                    0.7   0.3   0 0 0
                    0     0.3   0.7 0 0
                    0     0     0 1 0"
          />
        </filter>
      </svg>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
