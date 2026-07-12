// client/src/pages/Account.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMySubmissions, getMyEnquiries, respondToOffer } from '../utils/api';

const STATUS_BADGES = {
  submitted:             { label: 'Submitted',           cls: 'badge-muted'    },
  inspection_scheduled:  { label: 'Inspection Booked',   cls: 'badge-amber'    },
  under_review:          { label: 'Under Review',         cls: 'badge-blue'     },
  offer_sent:            { label: 'Offer Sent',           cls: 'badge-primary'  },
  accepted:              { label: 'Accepted',             cls: 'badge-green'    },
  rejected:              { label: 'Rejected',             cls: 'badge-red'      },
  withdrawn:             { label: 'Withdrawn',            cls: 'badge-muted'    },
};

const ENQUIRY_BADGES = {
  new:     { label: 'Awaiting reply', cls: 'badge-amber' },
  replied: { label: 'Replied',        cls: 'badge-green'  },
};

export default function Account() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    Promise.all([getMySubmissions().catch(() => ({ submissions: [] })), getMyEnquiries().catch(() => ({ enquiries: [] }))])
      .then(([s, e]) => { setSubmissions(s.submissions || []); setEnquiries(e.enquiries || []); })
      .finally(() => setLoading(false));
  }, []);

  async function handleOfferResponse(offerId, decision) {
    setResponding(offerId);
    try {
      await respondToOffer(offerId, decision);
      setSubmissions((prev) => prev.map((s) => {
        if (s.latest_offer?.id === offerId) {
          return { ...s, status: decision, latest_offer: { ...s.latest_offer, status: decision } };
        }
        return s;
      }));
    } catch { /* non-fatal */ }
    finally { setResponding(null); }
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>{user?.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{user?.email}</p>
          </div>
          <Link to="/sell" className="btn-primary" style={{ padding: '9px 18px', fontSize: 14, textDecoration: 'none' }}>Sell a car</Link>
        </div>

        {loading ? <div style={{ color: 'var(--text-faint)' }}>Loading…</div> : (
          <>
            {/* Sell submissions */}
            <Section title="My Submissions" count={submissions.length}>
              {submissions.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '16px 0' }}>
                  No submissions yet. <Link to="/sell" style={{ color: 'var(--primary)', fontWeight: 600 }}>Start selling</Link>
                </div>
              ) : submissions.map((s) => {
                const badge = STATUS_BADGES[s.status] || { label: s.status, cls: 'badge-muted' };
                const hasOffer = s.status === 'offer_sent' && s.latest_offer?.status === 'pending';
                return (
                  <div key={s.id} className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: hasOffer ? 12 : 0 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{s.year} {s.brand} {s.model}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                          {Number(s.mileage_km).toLocaleString()} km · {s.condition}
                          {s.inspection && ` · ${new Date(s.inspection.scheduled_at).toLocaleDateString('en-MY', { day:'numeric',month:'short',year:'numeric' })} @ ${s.inspection.location}`}
                        </div>
                      </div>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                    {hasOffer && (
                      <div style={{ padding: '14px 16px', background: 'var(--primary-soft)', borderRadius: 10, border: '1px solid var(--primary-border)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          BuyRight offer: <span style={{ color: 'var(--primary)' }}>RM {Number(s.latest_offer.offer_price).toLocaleString()}</span>
                        </div>
                        {s.latest_offer.notes && <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>{s.latest_offer.notes}</p>}
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }} onClick={() => handleOfferResponse(s.latest_offer.id, 'accepted')} disabled={responding === s.latest_offer.id}>Accept</button>
                          <button className="btn-outline" style={{ padding: '8px 20px', fontSize: 14, borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => handleOfferResponse(s.latest_offer.id, 'rejected')} disabled={responding === s.latest_offer.id}>Reject</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>

            {/* Enquiries */}
            <Section title="My Enquiries" count={enquiries.length}>
              {enquiries.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '16px 0' }}>
                  No enquiries yet. <Link to="/cars" style={{ color: 'var(--primary)', fontWeight: 600 }}>Browse cars</Link>
                </div>
              ) : enquiries.map((e) => {
                const badge = ENQUIRY_BADGES[e.status] || { label: e.status, cls: 'badge-muted' };
                return (
                  <div key={e.id} className="card" style={{ padding: '14px 18px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{e.car_title || `Car #${e.car_id}`}</div>
                      <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>{new Date(e.created_at).toLocaleDateString('en-MY')}</div>
                    </div>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                );
              })}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{count} total</span>
      </div>
      {children}
    </div>
  );
}
