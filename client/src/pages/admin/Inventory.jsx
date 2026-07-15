// client/src/pages/admin/Inventory.jsx
import { useEffect, useState } from 'react';
import { adminGetCars, adminAddCar, adminUpdateCar } from '../../utils/api';

const BODY_TYPES = ['Hatchback','Sedan','SUV','MPV','Pickup','Coupe','Wagon'];
const BLANK_FORM = { title:'', brand:'', model:'', variant:'', year:'', price:'', market_value_min:'', market_value_max:'', mileage_km:'', transmission:'Automatic', fuel_type:'Petrol', body_type:'Sedan', color:'', engine_cc:'', seats:'5', dealscore:'', ai_summary:'', city:'', state:'', image_url:'' };

export default function Inventory() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetCars().then((d) => setCars(d.cars || [])).finally(() => setLoading(false));
  }, []);

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { car } = await adminAddCar({ ...form, year: Number(form.year), price: Number(form.price), mileage_km: Number(form.mileage_km), dealscore: form.dealscore ? Number(form.dealscore) : 50, market_value_min: Number(form.market_value_min || form.price), market_value_max: Number(form.market_value_max || form.price), engine_cc: form.engine_cc ? Number(form.engine_cc) : undefined, seats: Number(form.seats || 5) });
      setCars((c) => [car, ...c]);
      setShowModal(false);
      setForm(BLANK_FORM);
    } catch { alert('Failed to add car. Please try again.'); }
    finally { setSaving(false); }
  }

  async function markSold(id) {
    try {
      await adminUpdateCar(id, { status: 'sold' });
      setCars((c) => c.map((car) => car.id === id ? { ...car, status: 'sold' } : car));
    } catch { alert('Update failed. Please try again.'); }
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Inventory</h1>
        <button className="btn-primary" style={{ padding: '9px 18px', fontSize: 14 }} onClick={() => setShowModal(true)}>+ Add car</button>
      </div>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Car','Price','Mileage','DealScore','Status',''].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{car.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{car.priceFormatted}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{car.mileageFormatted}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{car.dealscore}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${car.status === 'available' ? 'badge-green' : car.status === 'reserved' ? 'badge-amber' : 'badge-muted'}`}>{car.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {car.status === 'available' && (
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => markSold(car.id)}>Mark sold</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, overflowY: 'auto', padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, padding: 28 }}>
            <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Add car to inventory</h3>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {[['title','Title *','text'],['brand','Brand *','text'],['model','Model *','text'],['variant','Variant','text'],['year','Year *','number'],['price','Price (RM) *','number'],['mileage_km','Mileage (km) *','number'],['dealscore','DealScore *','number'],['city','City *','text'],['state','State *','text'],['color','Colour','text'],['engine_cc','Engine (cc)','number'],['image_url','Image URL','url']].map(([k,l,t]) => (
                  <div key={k} style={{ gridColumn: ['title','image_url'].includes(k) ? '1/-1' : undefined }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{l}</label>
                    <input className="input-field" type={t} value={form[k]} onChange={(e) => setF(k, e.target.value)} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Body type *</label>
                  <select className="input-field" value={form.body_type} onChange={(e) => setF('body_type', e.target.value)} style={{ background: 'var(--bg-muted)' }}>
                    {BODY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Transmission</label>
                  <select className="input-field" value={form.transmission} onChange={(e) => setF('transmission', e.target.value)} style={{ background: 'var(--bg-muted)' }}>
                    <option>Automatic</option><option>Manual</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add car'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
