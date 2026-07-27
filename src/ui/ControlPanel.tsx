import type { CountyId } from '../domain/ids';
import type { GameMap } from '../domain/map/mapTypes';
import { TERRAIN_DEFENCE_MODIFIER } from '../domain/map/mapTypes';
import type { MatchState } from '../domain/match/matchState';
import { activePlayer, garrisonOf, troopCount } from '../domain/match/matchState';
import { indexMap, neighboursOf } from '../domain/map/mapQueries';
import { getFaction } from '../content/factions';
import { RESOURCE_LABELS, type Resource } from '../domain/resources';
import { palette, seatColor, type } from './theme';
import { crestArt, resourceArt } from '../assets/assetManifest';
import { Sprite } from './Sprite';

/**
 * The control panel beside the map.
 *
 * Layout follows the reference material's arrangement (map on one side,
 * detail and orders beside it) without reproducing its art. On phones this
 * moves below the map — see styles.css.
 */

interface ControlPanelProps {
  readonly map: GameMap;
  readonly match: MatchState;
  readonly selected: CountyId | null;
  readonly onOpenReport: () => void;
}

const CASTLE_LABEL: Record<string, string> = {
  none: 'No castle',
  motteAndBailey: 'Motte & Bailey',
  normanKeep: 'Norman Keep',
  royalCastle: 'Royal Castle',
};

export function ControlPanel({ map, match, selected, onOpenReport }: ControlPanelProps) {
  const ix = indexMap(map);
  const turnPlayer = activePlayer(match);
  const county = selected ? ix.countyById.get(selected) : null;
  const countyState = selected ? match.counties[selected] : null;

  const owner = countyState?.owner
    ? match.players.find((p) => p.id === countyState.owner)
    : null;

  return (
    <aside className="panel">
      <header className="panel-header">
        <div className="panel-title">{map.name}</div>
        <div className="panel-turn">
          Turn {match.turn.number}
          {turnPlayer && (
            <>
              {' · '}
              <span style={{ color: seatColor(turnPlayer.seat).bright }}>
                {turnPlayer.displayName}
              </span>
            </>
          )}
        </div>
      </header>

      <section className="panel-section">
        <h2 className="section-heading">Lords</h2>
        <ul className="lord-list">
          {match.players.map((p) => {
            const faction = getFaction(p.factionId);
            const held = Object.values(match.counties).filter((c) => c.owner === p.id).length;
            const isTurn = p.seat === match.turn.activeSeat;
            return (
              <li key={p.id} className={`lord${isTurn ? ' lord-active' : ''}`}>
                <Sprite
                  asset={crestArt(p.factionId)}
                  size={22}
                  alt={`${faction.name} crest`}
                  className="lord-crest"
                  // Until crests are generated, the seat colour swatch is the
                  // only faction marker — so it is the fallback, not a spacer.
                  fallback={
                    <span
                      className="lord-swatch"
                      style={{ background: seatColor(p.seat).base }}
                    />
                  }
                />
                <span className="lord-name">
                  {p.displayName}
                  <span className="lord-faction">{faction.name}</span>
                </span>
                <span className="lord-meta">
                  {p.controller.kind === 'ai' ? 'AI' : 'You'} · {held}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel-section panel-grow">
        <h2 className="section-heading">County</h2>
        {!county || !countyState ? (
          <p className="empty-hint">Select a county on the map.</p>
        ) : (
          <div className="county-detail">
            <div className="county-detail-head">
              <span className="county-detail-name">{county.name}</span>
              <span
                className="county-detail-owner"
                style={{ color: owner ? seatColor(owner.seat).bright : palette.parchmentShadow }}
              >
                {owner ? owner.displayName : 'Unclaimed'}
              </span>
            </div>

            <dl className="stat-grid">
              <Stat label="Terrain" value={county.terrain} />
              <Stat
                label="Defence"
                value={`×${TERRAIN_DEFENCE_MODIFIER[county.terrain].toFixed(2)}`}
              />
              <dt className="stat-label">Resource</dt>
              <dd className="stat-value stat-with-icon">
                <Sprite
                  asset={resourceArt(county.resource)}
                  size={18}
                  alt=""
                  className="resource-icon"
                />
                {RESOURCE_LABELS[county.resource]}
              </dd>
              <Stat label="Yield" value={`${county.yield}/turn`} />
              <Stat label="Build slots" value={String(county.size)} />
              <Stat label="Castle" value={CASTLE_LABEL[countyState.castleTier] ?? '—'} />
              <Stat label="Population" value={String(countyState.population)} />
              <Stat label="Happiness" value={`${countyState.happiness}%`} />
            </dl>

            <div className="garrison-row">
              <span className="stat-label">Garrison</span>
              <span className="garrison-value">
                {(() => {
                  const troops = garrisonOf(match, county.id).reduce(
                    (sum, a) => sum + troopCount(a.troops),
                    0,
                  );
                  // Zero garrison means peaceful annexation rather than a
                  // forced battle — the design doc's deliberate change from the
                  // original, so it is worth saying plainly in the UI.
                  return troops === 0 ? 'Undefended — annexes without a fight' : `${troops} troops`;
                })()}
              </span>
            </div>

            <div className="neighbour-row">
              <span className="stat-label">Borders</span>
              <span className="neighbour-list">
                {neighboursOf(ix, county.id)
                  .map((n) => ix.countyById.get(n)?.name ?? n)
                  .join(', ')}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="panel-section">
        <h2 className="section-heading">Treasury</h2>
        {turnPlayer && (
          <div className="treasury">
            {Object.entries(match.treasuries[turnPlayer.id] ?? {}).map(([res, amount]) => (
              <div key={res} className="treasury-item">
                <span className="treasury-label">
                  <Sprite
                    asset={resourceArt(res as Resource)}
                    size={16}
                    alt=""
                    className="resource-icon"
                  />
                  {RESOURCE_LABELS[res as keyof typeof RESOURCE_LABELS] ?? res}
                </span>
                <span className="treasury-amount" style={{ fontFamily: type.numeric }}>
                  {amount}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="treasury-note">
          Materials pool empire-wide. Food is held per county and must be shipped.
        </p>
      </section>

      <section className="panel-section">
        {/* Combat is reachable before the turn loop exists, because the unit and
            stance numbers are first-pass and need somewhere to be tuned. */}
        <button className="panel-action" onClick={onOpenReport}>
          Muster a battle
        </button>
      </section>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="stat-label">{label}</dt>
      <dd className="stat-value">{value}</dd>
    </>
  );
}
