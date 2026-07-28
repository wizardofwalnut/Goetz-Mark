import { useMemo, useState } from 'react';
import { ALDERMARCH } from './content/maps/aldermarch.generated';
import { createSoloMatch } from './domain/match/createMatch';
import { factionId, type CountyId } from './domain/ids';
import { createRng } from './domain/rng';
import { MapView } from './ui/MapView';
import { ControlPanel } from './ui/ControlPanel';
import { BattleReport } from './ui/BattleReport';
import { CountyScreen } from './ui/county/CountyScreen';
import { advanceSeason } from './domain/turn/advanceTurn';
import { takeAllAiTurns } from './domain/ai/countyAi';
import { takeAllMilitaryTurns } from './domain/ai/militaryAi';
import { indexMap } from './domain/map/mapQueries';
import './ui/styles.css';

/**
 * Milestone 1 shell: a real match, rendered.
 *
 * Note this uses `createSoloMatch`, which is a thin wrapper over the same
 * `createMatch` a networked game will use. The state below is already the
 * shape that syncs to Firebase in Milestone 2 — there is no single-player-only
 * structure to migrate away from later.
 */

export default function App() {
  const [selected, setSelected] = useState<CountyId | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [inCounty, setInCounty] = useState<CountyId | null>(null);

  const initial = useMemo(
    () =>
      createSoloMatch({
        map: ALDERMARCH,
        playerName: 'You',
        factionId: factionId('warden'),
        opponents: [
          { name: 'Lord Aldric', factionId: factionId('knight') },
          { name: 'Dame Ysolde', factionId: factionId('merchant') },
          { name: 'Lord Bevan', factionId: factionId('steward') },
        ],
        // Fixed clock and a SEEDED rng so the dev shell renders identically
        // every run. It must be a real generator, not a constant — a constant
        // makes every roll the same, which quietly produced counties where no
        // tile was ever barren.
        now: 0,
        rng: createRng(20250728).next,
      }),
    [],
  );

  // Held in state because county actions return new match state. The turn loop
  // will own this later; the actions it dispatches are already the real ones.
  const [match, setMatch] = useState(initial);

  /**
   * One season-advance for both screens. The player must not get a different
   * game depending on which button they pressed.
   */
  const endSeason = () => {
    const managed = takeAllAiTurns(match);
    const marched = takeAllMilitaryTurns(managed.match, indexMap(ALDERMARCH));
    setMatch(advanceSeason(marched.match, ALDERMARCH).match);
  };

  const countyDef = inCounty ? ALDERMARCH.counties.find((c) => c.id === inCounty) : null;
  if (countyDef) {
    return (
      <CountyScreen
        county={countyDef}
        match={match}
        onChange={setMatch}
        onBack={() => setInCounty(null)}
      />
    );
  }

  return (
    <div className="app">
      <main className="map-stage">
        <MapView
          map={ALDERMARCH}
          match={match}
          selected={selected}
          onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
        />
      </main>
      <ControlPanel
        map={ALDERMARCH}
        match={match}
        selected={selected}
        onOpenReport={() => setReportOpen(true)}
        onEnterCounty={setInCounty}
        onChange={setMatch}
        onEndSeason={endSeason}
      />
      {reportOpen && <BattleReport onClose={() => setReportOpen(false)} />}
    </div>
  );
}
