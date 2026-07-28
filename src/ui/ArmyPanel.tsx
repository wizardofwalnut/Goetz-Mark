import { useState } from 'react';
import type { CountyId, PlayerId } from '../domain/ids';
import type { MatchState } from '../domain/match/matchState';
import { garrisonOf, troopCount } from '../domain/match/matchState';
import { neighboursOf, type MapIndex } from '../domain/map/mapQueries';
import {
  MIN_POPULATION_AFTER_LEVY,
  PEASANTS_PER_SOLDIER,
  equipmentCost,
  moveArmy,
  recruitArmy,
  upkeepOf,
} from '../domain/army/armyActions';
import type { Regiment, UnitKind } from '../domain/match/matchState';
import { UNITS } from '../content/units';
import { unitArt } from '../assets/assetManifest';
import { Sprite } from './Sprite';

/**
 * Raising and marching, from the realm map.
 *
 * The player needs the same two verbs the AI has, or the war is something that
 * happens TO them. Kept on the realm panel rather than the county screen
 * because both are realm-level decisions — where a host goes matters more than
 * which field it was raised beside.
 */

interface Props {
  readonly match: MatchState;
  readonly ix: MapIndex;
  readonly county: CountyId;
  readonly player: PlayerId;
  readonly onChange: (next: MatchState) => void;
}

const RECRUITABLE: readonly UnitKind[] = ['militia', 'archers', 'knights'];

export function ArmyPanel({ match, ix, county, player, onChange }: Props) {
  const [levy, setLevy] = useState<Regiment>({ militia: 10 });
  const [error, setError] = useState<string | null>(null);
  const [marching, setMarching] = useState<string | null>(null);

  const state = match.counties[county];
  if (!state || state.owner !== player) return null;

  const here = garrisonOf(match, county);
  const size = troopCount(levy);
  const cost = equipmentCost(levy);
  const treasury = match.treasuries[player];

  const maxLevy = Math.floor(
    (state.population - MIN_POPULATION_AFTER_LEVY) / PEASANTS_PER_SOLDIER,
  );

  const run = (result: ReturnType<typeof recruitArmy>) => {
    if (result.ok) {
      onChange(result.match);
      setError(null);
      setMarching(null);
    } else {
      setError(result.reason);
    }
  };

  return (
    <section className="panel-section">
      <h2 className="section-heading">Muster</h2>

      {RECRUITABLE.map((kind) => (
        <label key={kind} className="levy-row">
          <Sprite asset={unitArt(kind)} size={18} alt="" className="levy-icon" />
          <span className="levy-name">{UNITS[kind].name}</span>
          <input
            type="range"
            min={0}
            max={40}
            value={levy[kind] ?? 0}
            onChange={(e) => setLevy({ ...levy, [kind]: Number(e.target.value) })}
          />
          <span className="levy-count">{levy[kind] ?? 0}</span>
        </label>
      ))}

      <p className="note" style={{ margin: '6px 0' }}>
        {size} troops · {size * PEASANTS_PER_SOLDIER} peasants ·{' '}
        {Object.entries(cost)
          .map(([r, v]) => `${v} ${r}`)
          .join(', ') || 'no materials'}{' '}
        · {upkeepOf(levy)} gold a season
        {size > maxLevy && ` · only ${Math.max(0, maxLevy)} can be spared`}
      </p>

      <button
        className="panel-action"
        disabled={size === 0}
        onClick={() => run(recruitArmy(match, county, levy))}
      >
        Raise the levy
      </button>

      {here.length > 0 && (
        <>
          <h2 className="section-heading" style={{ marginTop: 16 }}>
            Hosts here
          </h2>
          {here.map((army) => (
            <div key={army.id} className="host">
              <div className="host-head">
                <span>{troopCount(army.troops)} troops</span>
                <span className="muted">{army.movementRemaining} move</span>
              </div>
              <div className="host-comp">
                {(Object.entries(army.troops) as [UnitKind, number][])
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => `${n} ${UNITS[k].name.toLowerCase()}`)
                  .join(', ')}
              </div>

              {marching === army.id ? (
                <div className="row" style={{ marginTop: 6 }}>
                  {neighboursOf(ix, county).map((n) => (
                    <button
                      key={n}
                      className="chip"
                      onClick={() => run(moveArmy(match, ix, army.id, n))}
                    >
                      {ix.countyById.get(n)?.name ?? n}
                    </button>
                  ))}
                  <button className="chip" onClick={() => setMarching(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="chip"
                  style={{ marginTop: 6 }}
                  disabled={army.movementRemaining <= 0}
                  onClick={() => setMarching(army.id)}
                >
                  {army.movementRemaining > 0 ? 'March…' : 'Marched already this season'}
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {treasury && (
        <p className="note" style={{ margin: '8px 0 0' }}>
          Wages come out of the shared purse. Unpaid mercenaries desert.
        </p>
      )}

      {error && (
        <p className="note" style={{ color: '#c98a7f', margin: '6px 0 0' }}>
          {error}
        </p>
      )}
    </section>
  );
}
