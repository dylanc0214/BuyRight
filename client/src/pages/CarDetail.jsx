// client/src/pages/CarDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCar, createEnquiry } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <tr>
      <td style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '8px 0', paddingRight: 24, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ fontSize: 14, fontWeight: 500, padding: '8px 0' }}>{value}</td>
    </tr>
  );
}

export default function CarDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [enquiryMsg, setEnquiryMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enquiryError, setEnquiryError] = useState('');

  useEffect(() => {
    getCar(id)
      .then((d) => setCar(d.car))
      .catch(() => setCar(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleEnquiry() {
    if (!user) { navigate('/login'); return; }
    setSubmitting(true);
    try {
      await createEnquiry({ car_id: Number(id), message: enquiryMsg });
      setSubmitted(true);
    } catch {
      setEnquiryError('Failed to send. Please try again.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="page container" style={{ paddingTop: 60, color: 'var(--text-faint)' }}>Loading…</div>;
  if (!car) return <div className="page container" style={{ paddingTop: 60 }}>Car not found. <Link to="/cars" style={{ color: 'var(--primary)' }}>Browse inventory</Link></div>;

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <Link to="/cars" style={{ color: 'var(--text-secondary)', fontSize: 14, display: 'inline-block', marginBottom: 24 }}>← Back to browse</Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40, alignItems: 'start' }}>
          {/* Left */}
          <div>
            {/* Main image */}
            <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--bg-muted)', height: 360, marginBottom: 24 }}>
              {car.imageUrl
                ? <img src={car.imageUrl} alt={car.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 64, opacity: 0.2 }}>🚗</div>
              }
            </div>

            {/* AI summary */}
            {car.aiSummary && (
              <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>BuyRight Summary</div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{car.aiSummary}</p>
              </div>
            )}

            {/* Specs */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Specifications</div>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  <SpecRow label="Brand"        value={car.brand} />
                  <SpecRow label="Model"        value={car.model} />
                  <SpecRow label="Variant"      value={car.variant} />
                  <SpecRow label="Year"         value={car.year} />
                  <SpecRow label="Mileage"      value={car.mileageFormatted} />
                  <SpecRow label="Transmission" value={car.transmission} />
                  <SpecRow label="Fuel type"    value={car.fuelType} />
                  <SpecRow label="Body type"    value={car.bodyType} />
                  <SpecRow label="Engine"       value={car.engineCc ? `${car.engineCc} cc` : null} />
                  <SpecRow label="Seats"        value={car.seats} />
                  <SpecRow label="Colour"       value={car.color} />
                  <SpecRow label="Location"     value={car.city ? `${car.city}, ${car.state}` : null} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Right sticky panel */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 4 }}>BuyRight Certified</div>
              <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>{car.title}</h1>
              <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 30, marginBottom: 4 }}>{car.priceFormatted}</div>
              {car.monthlyEstimateFormatted && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                  Est. {car.monthlyEstimateFormatted}/mo (90% loan, 9yr)
                </div>
              )}

              {car.dealscore && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: 'var(--primary-soft)', borderRadius: 10, border: '1px solid var(--primary-border)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 22 }}>{car.dealscore}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>DealScore — higher means better value vs. market</span>
                </div>
              )}

              <button
                className="btn-primary"
                style={{ width: '100%', marginBottom: 10, padding: 14, fontSize: 15 }}
                onClick={() => { if (!user) { navigate('/login'); return; } setShowModal(true); }}
              >
                Contact BuyRight to buy
              </button>
              <Link to="/chat" className="btn-outline" style={{ display: 'block', width: '100%', padding: 14, fontSize: 15, textAlign: 'center', boxSizing: 'border-box', textDecoration: 'none' }}>
                Ask AI about this car
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contact modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 420, padding: 28 }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Enquiry sent!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Our team will contact you within 1 business day.</p>
                <button className="btn-primary" onClick={() => { setShowModal(false); setSubmitted(false); }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Contact BuyRight</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{car.title}</div>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Optional message — e.g. preferred time to call, questions about the car…"
                  value={enquiryMsg}
                  onChange={(e) => setEnquiryMsg(e.target.value)}
                  style={{ resize: 'none', marginBottom: 12 }}
                />
                {enquiryError && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{enquiryError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleEnquiry} disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send enquiry'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
