import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DATE_FILTERS, QUARTILE_FILTERS, STUDY_TYPES } from '../lib/constants';
import { SearchIcon } from '../components/Icon';

export default function SearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState('All Time');
  const [minQuartile, setMinQuartile] = useState('Any');
  const [medlineOnly, setMedlineOnly] = useState(true);
  const [studyTypes, setStudyTypes] = useState(STUDY_TYPES.map(t => t.id));

  const toggleStudyType = id => {
    setStudyTypes(prev => (prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]));
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    navigate('/results', { state: { query, filters: { dateRange, minQuartile, medlineOnly, studyTypes } } });
  };

  return (
    <div>
      <p className="hint" style={{ marginBottom: 12 }}>
        Have a DOI, title, or pasted reference instead? <Link to="/smart-search">Try Smart Search</Link>
      </p>

      <div className="section" style={{ position: 'relative' }}>
        <SearchIcon
          width={18}
          height={18}
          style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }}
        />
        <input
          type="text"
          placeholder="e.g. propofol, sepsis, airway..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          autoCapitalize="none"
          style={{ paddingLeft: 40 }}
        />
      </div>

      <div className="card section">
        <p className="section-title">📅 Publication date</p>
        <div className="chips">
          {DATE_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              className={'chip' + (dateRange === f ? ' active' : '')}
              onClick={() => setDateRange(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card section">
        <p className="section-title">🏆 Minimum journal quartile</p>
        <div className="chips">
          {QUARTILE_FILTERS.map(q => (
            <button
              key={q}
              type="button"
              className={'chip' + (minQuartile === q ? ' active' : '')}
              onClick={() => setMinQuartile(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="card section switch-row">
        <div>
          <p className="section-title" style={{ marginBottom: 2 }}>✅ MEDLINE indexed only</p>
          <p className="hint">Journals meeting strict editorial standards</p>
        </div>
        <button
          type="button"
          className={'switch' + (medlineOnly ? ' on' : '')}
          onClick={() => setMedlineOnly(v => !v)}
          aria-label="MEDLINE indexed only"
        >
          <span className="switch-knob" />
        </button>
      </div>

      <div className="card section">
        <p className="section-title">🔬 Study type</p>
        {STUDY_TYPES.map(type => (
          <div key={type.id} className="checkbox-row" onClick={() => toggleStudyType(type.id)}>
            <span className={'checkbox-box' + (studyTypes.includes(type.id) ? ' checked' : '')}>
              {studyTypes.includes(type.id) && '✓'}
            </span>
            <span>{type.label}</span>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-primary" onClick={handleSearch} disabled={!query.trim()}>
        Search Trials
      </button>
    </div>
  );
}
