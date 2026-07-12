// client/src/pages/admin/Moderation.jsx
import { useEffect, useState } from 'react';
import { adminGetEnquiries, adminUpdateEnquiry } from '../../utils/api';

export default function Moderation() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { adminGetEnquiries().then((d) => setItems(d.enquiries || [])).finally(() => setLoading(false)); }, []);

  async function markReplied(id) {
    try {
      await adminUpdateEnquiry(id, { status: 'replied' });
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'replied' } : i));
    } catch { alert('Update failed. Please try again.'); }
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Inbox Moderation</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Buyer "Contact to buy" enquiries. Follow up by phone or WhatsApp.</p>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No enquiries yet.</p>}
          {items.map((e) => (
            <div key={e.id} className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{e.car_title || `Car #${e.car_id}`}</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{e.name} · {e.phone}</div>
                {e.message && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{e.message}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{new Date(e.created_at).toLocaleString('en-MY')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${e.status === 'new' ? 'badge-amber' : 'badge-green'}`}>{e.status === 'new' ? 'New' : 'Replied'}</span>
                {e.status === 'new' && (
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => markReplied(e.id)}>Mark replied</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
