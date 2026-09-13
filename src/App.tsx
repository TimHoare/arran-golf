import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { PL, R, TRIP } from './data/trip';
import { ROUTE_KEY } from './lib/state';
import { recordNav, teamOrFirst } from './lib/nav';
import { useStore } from './lib/useStore';
import { Header, Tabs, Toast } from './components/Chrome';
import { Welcome } from './components/Welcome';
import { SettingsSheet } from './components/SettingsSheet';
import { TripPage } from './pages/Trip';
import { PlayerPage } from './pages/Player';
import { PlayerRoundPage } from './pages/PlayerRound';
import { RoundPage } from './pages/Round';
import { ScoringPage } from './pages/Scoring';
import { PlayersPage } from './pages/Players';
import { StandingsPage } from './pages/Standings';

function titleFor(path: string) {
  const p = path.split('/').filter(Boolean);
  const base =
    p[0] === 'players' ? 'Players' :
    p[0] === 'player' && PL(p[1]) && p[2] === 'round' && R(p[3]) ? teamOrFirst(p[1], p[3]) + ' · ' + R(p[3])!.short :
    p[0] === 'player' && PL(p[1]) ? PL(p[1]).name :
    p[0] === 'standings' ? 'Standings' :
    p[0] === 'round' && R(p[1]) ? (p[2] === 'score' ? 'Scores · ' + R(p[1])!.short : R(p[1])!.short) :
    'Trip';
  return `${base} · ${TRIP.name} ${TRIP.year}`;
}

// Remember where we are (so a PWA cold start reopens the same page), keep the
// tab title in step, and scroll to the top on page changes — but not when only
// the hole number in a scoring URL changes (that's a swipe, not a navigation).
function RouteEffects() {
  const loc = useLocation();
  const { pathname } = loc;
  // Recorded during render, not in an effect: this sits above the routes, so
  // the page's back button sees the trail on the same pass (idempotent per key).
  recordNav(loc, useNavigationType());
  const prevBase = useRef<string>(undefined);
  useEffect(() => {
    localStorage.setItem(ROUTE_KEY, pathname);
    document.title = titleFor(pathname);
    const base = pathname.replace(/(\/score)\/\d+$/, '$1');
    if (prevBase.current !== undefined && prevBase.current !== base) window.scrollTo({ top: 0 });
    prevBase.current = base;
  }, [pathname]);
  return null;
}

export default function App() {
  const { me } = useStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <RouteEffects />
      <Header onSettings={() => setSheetOpen(true)} />
      <main id="view" className="view">
        <Routes>
          <Route path="/" element={<Navigate to="/trip" replace />} />
          <Route path="/trip" element={<TripPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/player/:pid" element={<PlayerPage />} />
          <Route path="/player/:pid/round/:rid" element={<PlayerRoundPage />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/round/:rid" element={<RoundPage />} />
          <Route path="/round/:rid/score/:hole?" element={<ScoringPage />} />
          <Route path="*" element={<Navigate to="/trip" replace />} />
        </Routes>
      </main>
      <Tabs />
      {sheetOpen && <SettingsSheet onClose={() => setSheetOpen(false)} />}
      {!me && <Welcome />}
      <Toast />
    </>
  );
}
