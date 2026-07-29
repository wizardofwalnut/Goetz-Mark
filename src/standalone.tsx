import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LivingMap } from './ui/county/LivingMap';
import { REALM } from './content/maps/realm.generated';
import { createMatch } from './domain/match/createMatch';
import { createRng } from './domain/rng';
import { factionId } from './domain/ids';
import './ui/styles.css';

/**
 * The standalone handoff build — DEV ENTRY, not part of the game.
 *
 * This is the entry `npm run standalone` bundles into one self-contained HTML
 * file: no server, no network, no build step, every image inlined. It exists so
 * the game can be handed to a chat assistant for tuning away from the repo.
 *
 * WHY IT HOLDS TWO SCREENS RATHER THAN JUST THE APP.
 *
 * App is the playable game — turn loop, AI, battles, county management — but it
 * still renders the ground-level isometric CountyScreen. The overhead LivingMap
 * is finished and is what the game is moving to, and it is reachable from
 * nothing but its own checkpoint page.
 *
 * Bundling App alone would therefore tree-shake LivingMap out of the file
 * entirely, and whoever opened it could not touch the very thing most in need
 * of work. Joining the two IS the open task: make the living map interactive
 * (tap a field, move the labour slider, end a season) and retire CountyScreen.
 * So both are here, side by side, as the raw material for exactly that.
 *
 * The tab strip below exists ONLY in this entry. App.tsx and main.tsx are
 * untouched, so nothing about the real game is shaped by the handoff format.
 */

type Tab = 'realm' | 'living';

/** The same seeded board the checkpoint uses, so the two screens agree. */
const useDemoMatch = () =>
  useMemo(
    () =>
      createMatch({
        map: REALM,
        rng: createRng(20260728).next,
        interiorGrid: { cols: 7, rows: 19 },
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
      }),
    [],
  );

function Standalone() {
  const [tab, setTab] = useState<Tab>('realm');
  const match = useDemoMatch();
  const opensOn = REALM.starts[0]?.county;

  return (
    <div className="sa">
      <nav className="sa-tabs">
        <button
          className={`sa-tab${tab === 'realm' ? ' on' : ''}`}
          onClick={() => setTab('realm')}
        >
          Realm — playable
        </button>
        <button
          className={`sa-tab${tab === 'living' ? ' on' : ''}`}
          onClick={() => setTab('living')}
        >
          Living map — new
        </button>
      </nav>

      <div className="sa-body">
        {/*
          Both stay MOUNTED, hidden rather than unmounted. The living map bakes
          its land into bitmaps on mount and revokes the blob URLs on unmount,
          so tab-switching would otherwise rebuild the whole world every time —
          and the app would lose its match state, which is the game.
        */}
        <div className="sa-pane" hidden={tab !== 'realm'}>
          <App />
        </div>
        <div className="sa-pane" hidden={tab !== 'living'}>
          {opensOn && <LivingMap map={REALM} match={match} initialFocus={opensOn} />}
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <Standalone />
  </StrictMode>,
);
