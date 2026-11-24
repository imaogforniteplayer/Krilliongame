import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { navigate, useRoute } from './router';
import { useSave } from './store';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { Play } from './pages/Play';
import { Results } from './pages/Results';

// Secondary pages load on demand so the first screen stays light.
const Museum = lazy(() => import('./pages/Museum').then((m) => ({ default: m.Museum })));
const BiomeMap = lazy(() => import('./pages/BiomeMap').then((m) => ({ default: m.BiomeMap })));
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const Soon = lazy(() => import('./pages/Soon').then((m) => ({ default: m.Soon })));

const NAV: { to: string; label: string; match: string }[] = [
  { to: 'home', label: 'Home', match: 'home' },
  { to: 'play/daily', label: 'Daily Dig', match: 'play' },
  { to: 'museum', label: 'Museum', match: 'museum' },
  { to: 'biomes', label: 'Biomes', match: 'biomes' },
  { to: 'stats', label: 'Stats', match: 'stats' },
  { to: 'soon', label: 'Online', match: 'soon' },
  { to: 'settings', label: 'Settings', match: 'settings' },
];

function SavedResult({ keyParam }: { keyParam: string }) {
  const { save } = useSave();
  const rec = save.dailyResults[keyParam];
  if (!rec) {
    return (
      <div className="page">
        <p className="notice">No finished Daily Dig found for {keyParam}.</p>
        <button type="button" className="btn" onClick={() => navigate('stats')}>
          Back to stats
        </button>
      </div>
    );
  }
  return <Results run={rec.run} mode="daily" alreadyPlayed={false} />;
}

export function App() {
  const route = useRoute();
  const [first = '', second = '', third = ''] = route;
  const playing = first === 'play';

  let page: ReactNode;
  switch (first) {
    case '':
      page = <Landing />;
      break;
    case 'home':
      page = <Home />;
      break;
    case 'play':
      page =
        second === 'endless' || second === 'practice' || second === 'daily' ? <Play key={second} mode={second} /> : <Home />;
      break;
    case 'results':
      page = <SavedResult keyParam={third || second} />;
      break;
    case 'museum':
      page = <Museum />;
      break;
    case 'biomes':
      page = <BiomeMap />;
      break;
    case 'stats':
      page = <Stats />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    case 'admin':
      page = <Admin />;
      break;
    case 'soon':
      page = <Soon />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div className="app">
      {!playing ? (
        <header className="nav">
          <a className="nav__logo" href="#/" aria-label="DEEPER home">
            DEEPER
          </a>
          <nav className="nav__links" aria-label="Main">
            {NAV.map((n) => (
              <a key={n.to} href={`#/${n.to}`} className={`nav__link${first === n.match ? ' nav__link--on' : ''}`}>
                {n.label}
              </a>
            ))}
          </nav>
        </header>
      ) : null}
      <main className="main">
        <Suspense fallback={<p className="page muted">Loading...</p>}>{page}</Suspense>
      </main>
      {!playing ? (
        <footer className="foot">
          <span>Local demo mode: progress is saved on this device only.</span>
          <a href="#/admin">Admin (demo)</a>
        </footer>
      ) : null}
    </div>
  );
}
