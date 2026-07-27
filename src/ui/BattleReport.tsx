import { useMemo, useState } from 'react';
import {
  STANCES,
  resolveBattle,
  type BattleResult,
  type Stance,
} from '../domain/combat/battleResolver';
import { troopCount, type Regiment, type UnitKind } from '../domain/match/matchState';
import { UNITS } from '../content/units';
import type { Terrain } from '../domain/map/mapTypes';
import { seedFrom } from '../domain/rng';
import { uiArt, unitArt } from '../assets/assetManifest';
import { Sprite } from './Sprite';
import { seatColor } from './theme';

/**
 * The battle report — the design doc's "stamped report" moment.
 *
 * Its job is to explain the result, not just announce it: the doc calls for the
 * full math breakdown after resolve, so every modifier the resolver applied is
 * listed. A player who loses should be able to see which matchup or stance
 * decided it.
 *
 * It doubles as the tuning surface. Unit stats and stance numbers are first
 * pass and expected to move in playtesting, and this is where you watch them
 * move.
 */

const KINDS: readonly UnitKind[] = ['militia', 'archers', 'knights', 'mercenaries'];
const TERRAINS: readonly Terrain[] = ['open', 'forest', 'hills', 'chokepoint'];

interface Props {
  readonly onClose: () => void;
}

export function BattleReport({ onClose }: Props) {
  const [attacker, setAttacker] = useState<Regiment>({ militia: 30, archers: 15, knights: 5 });
  const [defender, setDefender] = useState<Regiment>({ militia: 25, archers: 20, knights: 3 });
  const [attackerStance, setAttackerStance] = useState<Stance>('aggressivePush');
  const [defenderStance, setDefenderStance] = useState<Stance>('shieldArchers');
  const [terrain, setTerrain] = useState<Terrain>('hills');
  const [engagement, setEngagement] = useState(0);

  const result: BattleResult = useMemo(
    () =>
      resolveBattle({
        attacker: { troops: attacker, stance: attackerStance, factionId: null },
        defender: { troops: defender, stance: defenderStance, factionId: null },
        terrain,
        // Seeded from the inputs, so the same muster always resolves the same
        // way until you deliberately re-roll.
        seed: seedFrom(JSON.stringify(attacker), JSON.stringify(defender), terrain, engagement),
      }),
    [attacker, defender, attackerStance, defenderStance, terrain, engagement],
  );

  const verdict: Record<BattleResult['outcome'], string> = {
    attackerWins: 'The field is taken',
    defenderHolds: 'The defence holds',
    mutualDestruction: 'Both hosts destroyed',
    stalemate: 'Neither host breaks',
  };

  return (
    <div className="report-backdrop" role="dialog" aria-label="Battle report">
      <div className="report">
        <header className="report-head">
          <div>
            <div className="report-title">Report of the Engagement</div>
            <div className="report-sub">
              {terrain} ground · seed {result.seed}
            </div>
          </div>
          <button className="report-close" onClick={onClose} aria-label="Close report">
            ✕
          </button>
        </header>

        <div className="report-controls">
          <Muster
            label="Attacker"
            troops={attacker}
            onChange={setAttacker}
            stance={attackerStance}
            onStance={setAttackerStance}
            accent={seatColor(0).bright}
          />
          <Muster
            label="Defender"
            troops={defender}
            onChange={setDefender}
            stance={defenderStance}
            onStance={setDefenderStance}
            accent={seatColor(1).bright}
          />
        </div>

        <div className="report-row">
          <label className="report-field">
            <span className="stat-label">Ground</span>
            <select
              value={terrain}
              onChange={(e) => setTerrain(e.target.value as Terrain)}
              className="report-select"
            >
              {TERRAINS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button className="report-button" onClick={() => setEngagement((n) => n + 1)}>
            Re-roll engagement
          </button>
        </div>

        <div className={`report-verdict verdict-${result.outcome}`}>
          <Sprite asset={uiArt('waxStamp')} size={44} alt="" className="report-stamp" />
          <div>
            <div className="verdict-text">{verdict[result.outcome]}</div>
            <div className="verdict-sub">
              Attacker lost {troopCount(result.attackerLosses)} · Defender lost{' '}
              {troopCount(result.defenderLosses)} · {result.rounds.length} rounds
            </div>
          </div>
        </div>

        <div className="report-scroll">
          {result.rounds.length === 0 && (
            <p className="empty-hint">No engagement — one side had nothing in the field.</p>
          )}
          {result.rounds.map((round) => (
            <div key={round.number} className="round">
              <div className="round-number">Round {round.number}</div>
              <div className="round-sides">
                {(['attacker', 'defender'] as const).map((side) => {
                  const s = round[side];
                  return (
                    <div key={side} className="round-side">
                      <div className="round-side-head">
                        <span>{side === 'attacker' ? 'Attacker' : 'Defender'}</span>
                        <span className="round-output">{s.finalOutput}</span>
                      </div>
                      <div className="round-math">
                        <span className="round-base">base {s.baseOutput}</span>
                        {s.modifiers.map((m) => (
                          <span
                            key={m.label}
                            className={`round-mod ${m.factor >= 1 ? 'mod-up' : 'mod-down'}`}
                          >
                            {m.label} ×{m.factor}
                          </span>
                        ))}
                      </div>
                      <div className="round-losses">
                        {s.casualtiesTaken === 0
                          ? 'no losses'
                          : `−${s.casualtiesTaken}: ${describeLosses(s.losses)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <footer className="report-foot">
          <Survivors label="Attacker survivors" troops={result.attackerSurvivors} />
          <Survivors label="Defender survivors" troops={result.defenderSurvivors} />
        </footer>
      </div>
    </div>
  );
}

const describeLosses = (r: Regiment) =>
  KINDS.filter((k) => (r[k] ?? 0) > 0)
    .map((k) => `${r[k]} ${UNITS[k].name.toLowerCase()}`)
    .join(', ');

function Survivors({ label, troops }: { label: string; troops: Regiment }) {
  const total = troopCount(troops);
  return (
    <div className="survivors">
      <span className="stat-label">{label}</span>
      <span className="survivors-value">
        {total === 0 ? 'annihilated' : describeLosses(troops)}
      </span>
    </div>
  );
}

function Muster({
  label,
  troops,
  onChange,
  stance,
  onStance,
  accent,
}: {
  label: string;
  troops: Regiment;
  onChange: (r: Regiment) => void;
  stance: Stance;
  onStance: (s: Stance) => void;
  accent: string;
}) {
  return (
    <div className="muster">
      <div className="muster-head" style={{ color: accent }}>
        {label} · {troopCount(troops)} in the field
      </div>

      {KINDS.map((kind) => (
        <label key={kind} className="muster-row">
          <Sprite asset={unitArt(kind)} size={20} alt="" className="muster-icon" />
          <span className="muster-name">{UNITS[kind].name}</span>
          <input
            type="range"
            min={0}
            max={60}
            value={troops[kind] ?? 0}
            onChange={(e) => onChange({ ...troops, [kind]: Number(e.target.value) })}
            className="muster-range"
          />
          <span className="muster-count">{troops[kind] ?? 0}</span>
        </label>
      ))}

      <div className="stance-row">
        {(Object.keys(STANCES) as Stance[]).map((s) => (
          <button
            key={s}
            className={`stance-chip${stance === s ? ' stance-active' : ''}`}
            onClick={() => onStance(s)}
            title={STANCES[s].blurb}
          >
            {STANCES[s].name}
          </button>
        ))}
      </div>
    </div>
  );
}
