const QUARTILE_VAR = { Q1: 'var(--q1)', Q2: 'var(--q2)', Q3: 'var(--q3)', Q4: 'var(--q4)' };

export default function ResultCard({ item, onClick }) {
  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="hint">{item.pubdate}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {item.quartile && (
            <span
              className="badge"
              style={{ color: QUARTILE_VAR[item.quartile], borderColor: QUARTILE_VAR[item.quartile] }}
            >
              {item.quartile}
            </span>
          )}
          {item.notInPubmed && (
            <span className="badge" style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}>
              Not in PubMed
            </span>
          )}
        </div>
      </div>
      <p style={{ fontWeight: 600, margin: '0 0 4px', lineHeight: 1.4 }}>{item.title}</p>
      <p className="hint" style={{ fontStyle: 'italic', margin: '0 0 8px' }}>{item.journal}</p>
      {item.keywords?.length > 0 && (
        <div className="chips">
          {item.keywords.slice(0, 4).map((kw, i) => (
            <span key={i} className="keyword">{kw}</span>
          ))}
        </div>
      )}
    </div>
  );
}
