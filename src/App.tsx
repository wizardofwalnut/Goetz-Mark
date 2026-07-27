import { useMemo, useState } from 'react';
import { ALDERMARCH } from './content/maps/aldermarch.generated';
import { createSoloMatch } from './domain/match/createMatch';
import { factionId, type CountyId } from './domain/ids';
import { MapView } from './ui/MapView';
import { ControlPanel } from './ui/ControlPanel';
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

  const match = useMemo(
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
        // Fixed clock and rng so the dev shell renders identically every run.
        now: 0,
        rng: () => 0.42,
      }),
    [],
  );

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
      <ControlPanel map={ALDERMARCH} match={match} selected={selected} />
    </div>
  );
}
