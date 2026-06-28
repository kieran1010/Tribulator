import { NavLink } from 'react-router-dom';
import brandMark from '../assets/brand-mark.png';
import { SearchIcon, BookmarkIcon, GearIcon } from './Icon';

const NAV_ITEMS = [
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/saved', label: 'Saved', icon: BookmarkIcon },
  { to: '/settings', label: 'Settings', icon: GearIcon },
];

export default function Header() {
  return (
    <header className="app-header">
      <div className="brand">
        <img src={brandMark} alt="" className="brand-icon" />
        <div className="brand-text">
          <span className="brand-hypnos">Hypnos</span>
          <span className="brand-medical">MEDICAL</span>
        </div>
        <span className="brand-divider" />
        <span className="brand-product">Tribulator</span>
      </div>
      <nav className="header-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => 'header-nav-link' + (isActive ? ' active' : '')}
          >
            <Icon width={16} height={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
