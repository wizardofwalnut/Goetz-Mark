import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { REALM } from './content/maps/realm.generated';
import { createMatch } from './domain/match/createMatch';
import { createRng } from './domain/rng';
import { factionId } from './domain/ids';
import { CountyOverhead } from './ui/county/CountyOverhead';
import './ui/styles.css';

/**
 * Checkpoint render — DEV ENTRY, not part of the game.
 *
 * The county-map spec asks for one static county to be rendered and looked at
 * before any interaction is built on it. This page is that render and nothing
 * else: real map data, real match state, the real component, no click
 * handlers. It has its own entry point so the checkpoint can be screenshotted
 * without threading a debug route through the app the player actually uses.
 *
 * Delete this file once the interactive county screen replaces it.
 */

// Seeded, so the county in the screenshot is the county in the next
// screenshot — a layout that changes every reload cannot be reviewed.
const rng = createRng(20260728).next;

const match = createMatch({
  map: REALM,
  rng,
  // Small enough that a whole county fits a phone screen with tiles drawn
  // large enough to tap. See the note on CreateMatchOptions.interiorGrid.
  interiorGrid: { cols: 5, rows: 13 },
  seats: [
    {
      displayName: 'You',
      factionId: factionId('knight'),
      controller: { kind: 'human', userId: null },
    },
    {
      displayName: 'Lady Aubrey',
      factionId: factionId('warden'),
      controller: { kind: 'ai', difficulty: 'steady' },
    },
  ],
});

const county = REALM.counties.find((c) => c.id === REALM.starts[0]?.county);
if (!county) throw new Error('Realm has no starting county to render');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CountyOverhead county={county} map={REALM} match={match} />
  </StrictMode>,
);
