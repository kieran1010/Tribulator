import brandMark from '../assets/brand-mark-transparent.png';

export default function Header() {
  return (
    <header className="app-header">
      <a href="https://hypnos.one" className="brand">
        <img src={brandMark} alt="" className="brand-icon" />
        <div className="brand-text">
          <span className="brand-hypnos">Hypnos</span>
          <span className="brand-medical">MEDICAL</span>
        </div>
        <span className="brand-divider" />
        <span className="brand-product">Tribulator</span>
      </a>
    </header>
  );
}
