// client/src/pages/admin/Overview.jsx
import { useEffect, useState } from 'react';
import { adminOverview } from '../../utils/api';

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  useEffect(() => { adminOverview().then(setData).catch(() => {}); }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 28 }}>Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total submissions"  value={data?.submissions}    sub="all time" />
        <StatCard label="Live inventory"     value={data?.inventory}      sub="available cars" />
        <StatCard label="Registered buyers"  value={data?.buyers}         sub="user accounts" />
        <StatCard label="Pending offers"     value={data?.pending_offers} sub="awaiting seller response" />
      </div>
      <div className="card" style={{ padding: '20px 24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Charts and deeper analytics — add after MVP.</p>
      </div>
    </div>
  );
}
