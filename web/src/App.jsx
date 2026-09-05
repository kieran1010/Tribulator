import { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { startAutoSync } from './lib/sync';
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

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStart = useRef(null);

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
