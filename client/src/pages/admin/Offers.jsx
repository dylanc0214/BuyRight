// client/src/pages/admin/Offers.jsx
import { useEffect, useState } from 'react';
import { adminGetSubmissions, adminSendOffer } from '../../utils/api';

export default function Offers() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({});
  const [notes, setNotes] = useState({});
  const [sending, setSending] = useState(null);

  useEffect(() => {
    adminGetSubmissions()
      .then((d) => setQueue((d.submissions || []).filter((s) => s.status === 'under_review')))
      .finally(() => setLoading(false));
  }, []);

  async function send(sub) {
    const price = Number(prices[sub.id]);
    if (!prices[sub.id] || isNaN(price)) return;
    setSending(sub.id);
    try {
      await adminSendOffer({ submission_id: sub.id, offer_price: price, notes: notes[sub.id] });
      setQueue((q) => q.filter((s) => s.id !== sub.id));
    } catch { alert('Failed to send offer. Please try again.'); }
    finally { setSending(null); }
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Make Offers</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>Submissions with status "Under Review" — enter a price and send the offer to the seller.</p>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : queue.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No submissions under review.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {queue.map((s) => (
            <div key={s.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, alignItems: 'end' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.year} {s.brand} {s.model}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{Number(s.mileage_km).toLocaleString()} km · {s.condition}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 4 }}>{s.seller_name} · {s.seller_phone}</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NOTE (optional)</label>
                  <input className="input-field" placeholder="Reason or condition…" value={notes[s.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>OFFER PRICE (RM) *</label>
                  <input className="input-field" type="number" placeholder="e.g. 52000" value={prices[s.id] || ''} onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))} />
                </div>
                <button className="btn-primary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }} onClick={() => send(s)} disabled={!prices[s.id] || sending === s.id}>
                  {sending === s.id ? 'Sending…' : 'Send offer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
