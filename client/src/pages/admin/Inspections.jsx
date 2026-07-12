// client/src/pages/admin/Inspections.jsx
import { useEffect, useState } from 'react';
import { adminGetInspections, adminUpdateInspection } from '../../utils/api';

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetInspections().then((d) => setItems(d.inspections || [])).finally(() => setLoading(false));
  }, []);

  async function toggleComplete(id, completed) {
    await adminUpdateInspection(id, { completed: !completed });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, completed: !completed } : i));
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Inspections</h1>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Date & time','Centre','Car','Seller','Status',''].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((ins) => (
                <tr key={ins.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    {new Date(ins.scheduled_at).toLocaleDateString('en-MY', { weekday:'short', day:'numeric', month:'short' })}
                    <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>{new Date(ins.scheduled_at).toLocaleTimeString('en-MY', { hour:'2-digit', minute:'2-digit' })}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{ins.location}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{ins.year} {ins.brand} {ins.model}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div>{ins.seller_name || '—'}</div>
                    <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>{ins.seller_phone}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${ins.completed ? 'badge-green' : 'badge-amber'}`}>{ins.completed ? 'Completed' : 'Upcoming'}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => toggleComplete(ins.id, ins.completed)}>
                      {ins.completed ? 'Undo' : 'Mark complete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
