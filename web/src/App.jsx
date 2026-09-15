import { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { startAutoSync } from './lib/sync';
import { DEFAULT_FILTERS } from './lib/constants';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import UpdatePrompt from './components/UpdatePrompt';
import SearchScreen from './screens/SearchScreen';
import ResultsScreen from './screens/ResultsScreen';
import DetailScreen from './screens/DetailScreen';
import SavedScreen from './screens/SavedScreen';
import SettingsScreen from './screens/SettingsScreen';
import OptimiseScreen from './screens/OptimiseScreen';

const TAB_ORDER = ['/search', '/saved', '/settings'];
const SWIPE_MIN_DISTANCE = 60;

// The Android share sheet lands here as a plain GET to the site root (see the
// share_target manifest entry in vite.config.js), carrying whatever the
// source app supplied as query params — never all three at once in practice.
// A shared page's url is the most reliable handle (it's where the PMID/DOI
// lives), so it's preferred over the free-form text or title.
function readSharedQuery() {
  const params = new URLSearchParams(window.location.search);
  const shared = params.get('url') || params.get('text') || params.get('title');
  return shared?.trim() || null;
}

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef(null);

  useEffect(() => {
    const query = readSharedQuery();
    if (!query) return;
    // Strip the share params so refreshing or navigating back doesn't replay
    // the same lookup.
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    navigate('/results', { state: { query, filters: DEFAULT_FILTERS, mode: 'lookup' } });
    // Runs once, on the initial load that a share can land on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTouchStart = e => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = e => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const tabIndex = TAB_ORDER.indexOf(location.pathname);
    if (tabIndex === -1) return;

    const t = e.changedTouches[0];
    const deltaX = t.clientX - start.x;
    const deltaY = t.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    const nextIndex = deltaX < 0 ? tabIndex + 1 : tabIndex - 1;
    if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;
    navigate(TAB_ORDER[nextIndex]);
  };

  return (
    <div className="app-shell">
      <Header />
      <UpdatePrompt />
      <main className="app-main" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  // Syncs on launch when Drive sync is switched on, then after every change.
  useEffect(() => { startAutoSync(); }, []);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<SearchScreen />} />
          {/* Smart search folded into /search; kept so old links still land somewhere. */}
          <Route path="/smart-search" element={<Navigate to="/search" replace />} />
          <Route path="/results" element={<ResultsScreen />} />
          <Route path="/detail" element={<DetailScreen />} />
          <Route path="/saved" element={<SavedScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/optimise" element={<OptimiseScreen />} />
          <Route path="*" element={<Navigate to="/search" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
