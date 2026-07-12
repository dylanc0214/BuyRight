// client/src/pages/admin/Buyers.jsx
import { useEffect, useState } from 'react';
import { adminGetBuyers } from '../../utils/api';

export default function Buyers() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { adminGetBuyers().then((d) => setBuyers(d.buyers || [])).finally(() => setLoading(false)); }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Buyers</h1>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Name','Email','Phone','Enquiries','Joined'].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{b.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{b.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{b.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{b.enquiry_count}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(b.created_at).toLocaleDateString('en-MY')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
