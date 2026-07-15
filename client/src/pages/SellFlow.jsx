// client/src/pages/SellFlow.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSellEstimate, createSubmission, bookInspection } from '../utils/api';

const CENTRES = ['KL HQ', 'Petaling Jaya', 'Johor Bahru', 'Penang', 'Kota Kinabalu'];
const CONDITIONS = [
  { value: 'excellent', label: 'Excellent', desc: 'Like new, minimal wear' },
  { value: 'good',      label: 'Good',      desc: 'Normal wear, well-maintained' },
  { value: 'fair',      label: 'Fair',      desc: 'Visible wear, needs minor work' },
];

function nextWeekdays(n) {
  const days = [];
  const d = new Date();
  while (days.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(new Date(d));
    }
  }
  return days;
}

function genRef() { return 'BR-' + Math.random().toString(36).slice(2,10).toUpperCase(); }

export default function SellFlow() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [ref, setRef] = useState('');

  // Step 1 state
  const [form, setForm] = useState({
    brand: params.get('brand') || '',
    model: params.get('model') || '',
    variant: '',
    year: params.get('year') || '',
    mileage_km: '',
    condition: 'good',
    color: '',
    description: '',
  });
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [step1Error, setStep1Error] = useState('');
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2 state
  const [inspection, setInspection] = useState({ location: '', date: '', time: 'Morning 9–12', phone: user?.phone || '' });
  const [step2Error, setStep2Error] = useState('');
  const [step2Loading, setStep2Loading] = useState(false);

  const weekdays = nextWeekdays(14);

  // Live price estimate when brand/model/year filled
  useEffect(() => {
    if (!form.brand || !form.model || !form.year) return;
    const t = setTimeout(() => {
      setEstimateLoading(true);
      getSellEstimate({ brand: form.brand, model: form.model, year: form.year, mileage_km: form.mileage_km || undefined })
        .then((d) => setEstimate(d.estimate))
        .catch(() => setEstimate(null))
        .finally(() => setEstimateLoading(false));
    }, 600);
    return () => clearTimeout(t);
  }, [form.brand, form.model, form.year, form.mileage_km]);

  function setF(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleStep1Submit(e) {
    e.preventDefault();
    if (!form.brand || !form.model || !form.year || !form.mileage_km) {
      setStep1Error('Please fill in all required fields.'); return;
    }
    if (!user) { navigate('/login'); return; }
    setStep1Loading(true);
    setStep1Error('');
    try {
      const { submission } = await createSubmission({ ...form, year: Number(form.year), mileage_km: Number(form.mileage_km) });
      setSubmissionId(submission.id);
      setStep(2);
    } catch { setStep1Error('Submission failed. Please try again.'); }
    finally { setStep1Loading(false); }
  }

  async function handleStep2Submit(e) {
    e.preventDefault();
    if (!inspection.location || !inspection.date || !inspection.time) {
      setStep2Error('Please choose a centre, date and time slot.'); return;
    }
    setStep2Loading(true);
    setStep2Error('');
    try {
      const scheduled_at = `${inspection.date}T${inspection.time === 'Morning 9–12' ? '09:00' : '14:00'}:00`;
      await bookInspection(submissionId, { scheduled_at, location: inspection.location, phone: inspection.phone });
      setRef(genRef());
      setStep(3);
    } catch { setStep2Error('Booking failed. Please try again.'); }
    finally { setStep2Loading(false); }
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 900 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          {['Car details', 'Book inspection', 'Confirmation'].map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--green)' : active ? 'var(--primary)' : 'var(--bg-muted)',
                  color: done || active ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: 13,
                }}>{done ? '✓' : n}</div>
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 400, color: active ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</span>
                {i < 2 && <div style={{ width: 32, height: 1, background: 'var(--border)' }} />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="responsive-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'start' }}>
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Tell us about your car</h2>
              <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Brand *"><input className="input-field" required value={form.brand} onChange={(e) => setF('brand', e.target.value)} placeholder="e.g. Toyota" /></Field>
                  <Field label="Model *"><input className="input-field" required value={form.model} onChange={(e) => setF('model', e.target.value)} placeholder="e.g. Vios" /></Field>
                  <Field label="Variant"><input className="input-field" value={form.variant} onChange={(e) => setF('variant', e.target.value)} placeholder="e.g. 1.5G" /></Field>
                  <Field label="Year *"><input className="input-field" type="number" required min={1990} max={2026} value={form.year} onChange={(e) => setF('year', e.target.value)} placeholder="e.g. 2020" /></Field>
                  <Field label="Mileage (km) *"><input className="input-field" type="number" required min={0} value={form.mileage_km} onChange={(e) => setF('mileage_km', e.target.value)} placeholder="e.g. 60000" /></Field>
                  <Field label="Colour"><input className="input-field" value={form.color} onChange={(e) => setF('color', e.target.value)} placeholder="e.g. Silver" /></Field>
                </div>

                <Field label="Condition *">
                  <div style={{ display: 'flex', gap: 10 }}>
                    {CONDITIONS.map((c) => (
                      <label key={c.value} style={{
                        flex: 1, padding: '10px 14px', border: '1.5px solid',
                        borderColor: form.condition === c.value ? 'var(--primary)' : 'var(--border)',
                        background: form.condition === c.value ? 'var(--primary-soft)' : 'var(--surface)',
                        borderRadius: 'var(--radius-input)', cursor: 'pointer', textAlign: 'center',
                      }}>
                        <input type="radio" name="condition" value={c.value} checked={form.condition === c.value} onChange={() => setF('condition', c.value)} style={{ display: 'none' }} />
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{c.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.desc}</div>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Description (optional)">
                  <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setF('description', e.target.value)} placeholder="Service history, recent repairs, extras…" style={{ resize: 'none' }} />
                </Field>

                {step1Error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{step1Error}</div>}
                <button type="submit" className="btn-primary" style={{ padding: 14 }} disabled={step1Loading}>
                  {step1Loading ? 'Saving…' : 'Next — Book inspection'}
                </button>
              </form>
            </div>

            {/* Price estimate sidebar */}
            <div className="card" style={{ padding: 22, position: 'sticky', top: 80 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Live price estimate</div>
              {!form.brand || !form.model || !form.year ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Fill in brand, model and year to see an estimate.</p>
              ) : estimateLoading ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Calculating…</p>
              ) : estimate ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>BuyRight offer range</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 24, marginBottom: 4 }}>
                    RM {estimate.low?.toLocaleString()} – {estimate.high?.toLocaleString()}
                  </div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Based on {estimate.comparable_count} similar cars in our inventory</div>
                  <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 8 }}>
                    Final offer confirmed after physical inspection.
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>No comparable cars found. We'll assess at inspection.</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ maxWidth: 560 }}>
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Book your inspection</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Choose a BuyRight inspection centre and time slot.</p>
              <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Inspection centre *">
                  <select className="input-field" required value={inspection.location} onChange={(e) => setInspection((i) => ({ ...i, location: e.target.value }))} style={{ background: 'var(--bg-muted)' }}>
                    <option value="">Select a centre</option>
                    {CENTRES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="Date * (next 14 weekdays)">
                  <select className="input-field" required value={inspection.date} onChange={(e) => setInspection((i) => ({ ...i, date: e.target.value }))} style={{ background: 'var(--bg-muted)' }}>
                    <option value="">Select a date</option>
                    {weekdays.map((d) => {
                      const iso = d.toISOString().slice(0,10);
                      const label = d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
                      return <option key={iso} value={iso}>{label}</option>;
                    })}
                  </select>
                </Field>

                <Field label="Time slot *">
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['Morning 9–12', 'Afternoon 2–5'].map((slot) => (
                      <label key={slot} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid', borderColor: inspection.time === slot ? 'var(--primary)' : 'var(--border)', background: inspection.time === slot ? 'var(--primary-soft)' : 'var(--surface)', borderRadius: 'var(--radius-input)', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: inspection.time === slot ? 700 : 400 }}>
                        <input type="radio" name="time" value={slot} checked={inspection.time === slot} onChange={() => setInspection((i) => ({ ...i, time: slot }))} style={{ display: 'none' }} />
                        {slot}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Contact phone *">
                  <input className="input-field" type="tel" required value={inspection.phone} onChange={(e) => setInspection((i) => ({ ...i, phone: e.target.value }))} placeholder="01X-XXXXXXX" />
                </Field>

                <div style={{ padding: '12px 14px', background: 'var(--primary-soft)', borderRadius: 10, border: '1px solid var(--primary-border)', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  <strong>What to bring:</strong> IC (MyKad), car grant/geran, service records, spare key.
                </div>

                {step2Error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{step2Error}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn-outline" style={{ flex: 1, padding: 13 }} onClick={() => setStep(1)}>Back</button>
                  <button type="submit" className="btn-primary" style={{ flex: 2, padding: 13 }} disabled={step2Loading}>
                    {step2Loading ? 'Booking…' : 'Confirm appointment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ maxWidth: 520 }}>
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff', fontSize: 24 }}>✓</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>You're booked!</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                Reference: <strong style={{ color: 'var(--text)', letterSpacing: '0.05em' }}>{ref}</strong>
              </div>

              {/* Status timeline */}
              <div style={{ textAlign: 'left', marginBottom: 28 }}>
                {[
                  { label: 'Submitted', done: true },
                  { label: 'Inspection', done: true },
                  { label: 'BuyRight Reviews', done: false },
                  { label: 'Offer Sent', done: false },
                  { label: 'You Decide', done: false },
                ].map((s, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.done ? 'var(--green)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{s.done ? '✓' : ''}</div>
                      {i < arr.length - 1 && <div style={{ width: 2, height: 20, background: 'var(--border)', marginTop: 2 }} />}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: s.done ? 600 : 400, color: s.done ? 'var(--green)' : 'var(--text-secondary)', paddingTop: 1 }}>{s.label}</span>
                  </div>
                ))}
              </div>

              <Link to="/account" className="btn-primary" style={{ display: 'block', padding: 14, textAlign: 'center', textDecoration: 'none' }}>
                Track my submission
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
