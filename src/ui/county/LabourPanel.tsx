import type { ProductionProjection } from '../../domain/county/labour';
import type { Season } from '../../domain/season';
import { resourceArt } from '../../assets/assetManifest';
import { Sprite } from '../Sprite';
import type { Resource } from '../../domain/resources';

/**
 * Labour allocation.
 *
 * The loop the spec singles out as worth replicating exactly: drag, watch the
 * deltas flip, decide. No confirm step and no recalculate button — the readout
 * recomputes as the slider moves.
 *
 * The readout is VARIABLE LENGTH on purpose. It lists only what this county
 * actually produces, so a cattle-and-stone county shows cattle and stone and
 * nothing else. A fixed three-slot layout would be wrong for most counties and
 * would imply outputs that will never arrive.
 */

interface Props {
  readonly share: number;
  readonly projection: ProductionProjection | null;
  readonly season: Season;
  readonly onShare: (value: number) => void;
  readonly onEndTurn: () => void;
}

export function LabourPanel({ share, projection, season, onShare, onEndTurn }: Props) {
  return (
    <div className="labour">
      <div className="labour-head">
        <span className="labour-pole">Field</span>
        <input
          className="labour-slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(share * 100)}
          onChange={(e) => onShare(Number(e.target.value) / 100)}
          aria-label="Labour split between agriculture and industry"
        />
        <span className="labour-pole">Forge</span>
      </div>

      <div className="labour-counts">
        <span>{projection?.farmWorkers ?? 0} farming</span>
        <span>{projection?.industryWorkers ?? 0} at industry</span>
      </div>

      {projection && projection.idleWorkers > 0 && (
        // Naming idle workers is the difference between "my slider is wrong"
        // and "I have not switched the quarry on yet".
        <div className="labour-idle">
          {projection.idleWorkers} idle — nothing on that side is running.
        </div>
      )}

      <div className="labour-lines">
        {(projection?.lines.length ?? 0) === 0 && (
          <p className="note" style={{ margin: 0 }}>
            Nothing planted and nothing running. Tap a field to sow it.
          </p>
        )}
        {projection?.lines.map((line) => (
          <div key={line.key} className="labour-line">
            <Sprite
              asset={resourceArt(line.key as Resource)}
              size={16}
              alt=""
              className="resource-icon"
              fallback={<span className="labour-dot" />}
            />
            <span className="labour-label">{line.label}</span>
            <span className={`labour-net ${line.net >= 0 ? 'gain' : 'loss'}`}>
              {line.net >= 0 ? '+' : ''}
              {line.net}
            </span>
          </div>
        ))}
      </div>

      {season === 'winter' && (
        <p className="note" style={{ margin: '8px 0 0' }}>
          Winter — the fields yield nothing. The county eats from its stores.
        </p>
      )}

      {/* Ending the season is the only irreversible action on this screen, so
          it sits apart from the reversible slider above it. */}
      <button className="btn end-turn" onClick={onEndTurn}>
        End the season
      </button>
    </div>
  );
}
