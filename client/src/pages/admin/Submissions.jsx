// client/src/pages/admin/Submissions.jsx
import { useEffect, useState } from 'react';
import { adminGetSubmissions, adminUpdateSubmission, adminSendOffer } from '../../utils/api';

export default function Submissions() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offerModal, setOfferModal] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    adminGetSubmissions().then((d) => setSubs(d.submissions || [])).finally(() => setLoading(false));
  }, []);

  async function updateStatus(id, status) {
    try {
      await adminUpdateSubmission(id, { status });
      setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
    } catch { alert('Status update failed. Please try again.'); }
  }

  async function sendOffer() {
    const price = Number(offerPrice);
    if (!offerPrice || isNaN(price)) return;
    setSending(true);
    try {
      await adminSendOffer({ submission_id: offerModal.id, offer_price: price, notes: offerNote || undefined });
      setSubs((prev) => prev.map((s) => s.id === offerModal.id ? { ...s, status: 'offer_sent' } : s));
      setOfferModal(null); setOfferPrice(''); setOfferNote('');
    } catch { alert('Failed to send offer. Please try again.'); }
    finally { setSending(false); }
  }

  const STATUS_COLOR = { submitted:'badge-muted', inspection_scheduled:'badge-amber', under_review:'badge-blue', offer_sent:'badge-primary', accepted:'badge-green', rejected:'badge-red', withdrawn:'badge-muted' };

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Submissions</h1>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Car','Seller','Mileage','Condition','Status','Actions'].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>{s.year} {s.brand} {s.model}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div>{s.seller_name || '—'}</div>
                    <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>{s.seller_phone}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{Number(s.mileage_km).toLocaleString()} km</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{s.condition}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${STATUS_COLOR[s.status] || 'badge-muted'}`}>{s.status.replace(/_/g,' ')}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.status === 'inspection_scheduled' && (
                        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => updateStatus(s.id, 'under_review')}>→ Under review</button>
                      )}
                      {s.status === 'under_review' && (
                        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={() => setOfferModal(s)}>Send offer</button>
                      )}
                      {!['accepted','rejected','withdrawn'].includes(s.status) && (
                        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px', color: 'var(--red)' }} onClick={() => updateStatus(s.id, 'withdrawn')}>Withdraw</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {offerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 400, padding: 28 }}>
            <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Send offer</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{offerModal.year} {offerModal.brand} {offerModal.model}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Offer price (RM) *</label>
              <input className="input-field" type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="e.g. 55000" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Note to seller (optional)</label>
              <textarea className="input-field" rows={3} value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder="Reason for offer, conditions…" style={{ resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setOfferModal(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={sendOffer} disabled={!offerPrice || sending}>{sending ? 'Sending…' : 'Send offer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
