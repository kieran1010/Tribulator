import { NavLink } from 'react-router-dom';
import { SearchIcon, BookmarkIcon, GearIcon } from './Icon';

const NAV_ITEMS = [
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/saved', label: 'Saved', icon: BookmarkIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => 'bottom-nav-link' + (isActive ? ' active' : '')}
        >
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
