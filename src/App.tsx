import { useMemo, useState } from 'react';
import { REALM } from './content/maps/realm.generated';
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
 *
 * NOW ON THE v2 BOARD. The map is the four-county REALM rather than the
 * nineteen-county draft: v2 puts the world at four counties, both seats on ore
 * and both neutrals on stone, so a castle means taking or trading for the
 * ground between. Four seats do not fit a two-seat map, so the solo game is
 * one opponent rather than three.
 *
 * The county screen is still the ground-level isometric one. Swapping it for
 * the overhead living map is the next step and is deliberately NOT bundled
 * here — LivingMap is static, so trading it in before it can plant a field or
 * move the labour slider would cost the management loop the game is about.
 *
 * When that swap happens, MapView goes with it: the living map now covers the
 * whole realm on one scrollable surface, so a separate strategic map is a
 * second, worse picture of the same world.
 */

export default function App() {
  const [selected, setSelected] = useState<CountyId | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [inCounty, setInCounty] = useState<CountyId | null>(null);

  const initial = useMemo(
    () =>
      createSoloMatch({
        map: REALM,
        playerName: 'You',
        factionId: factionId('warden'),
        opponents: [{ name: 'Lord Aldric', factionId: factionId('knight') }],
        // The tighter interior the overhead camera is built around. Set here
        // rather than defaulted so both county screens see the same board.
        interiorGrid: { cols: 7, rows: 19 },
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
    const marched = takeAllMilitaryTurns(managed.match, indexMap(REALM));
    setMatch(advanceSeason(marched.match, REALM).match);
  };

  const countyDef = inCounty ? REALM.counties.find((c) => c.id === inCounty) : null;
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
          map={REALM}
          match={match}
          selected={selected}
          onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
        />
      </main>
      <ControlPanel
        map={REALM}
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
