export default function CarCard({ car, onClick }) {
  const score = car.dealscore;
  const scoreColor = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)';

  return (
    <div
      onClick={onClick}
      className="card"
      style={{ overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ position: 'relative', height: 180, background: 'var(--bg-muted)' }}>
        {car.imageUrl ? (
          <img src={car.imageUrl} alt={car.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 48, opacity: 0.3 }}>🚗</div>
        )}
        {score != null && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: scoreColor, color: '#fff',
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-pill)',
          }}>
            {score} Deal
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>
          {car.title}
        </div>
        <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>
          {car.priceFormatted}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {[car.year, car.mileageFormatted, car.transmission, car.fuelType].filter(Boolean).map((chip, i) => (
            <span key={i} style={{
              background: 'var(--bg-muted)', color: 'var(--text-dim)',
              fontSize: 12, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
            }}>{chip}</span>
          ))}
        </div>
        {car.monthlyEstimateFormatted && (
          <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            Est. {car.monthlyEstimateFormatted}/mo · 9yr loan
          </div>
        )}
        {car.city && (
          <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 4 }}>
            📍 {car.city}, {car.state}
          </div>
        )}
      </div>
    </div>
  );
}
