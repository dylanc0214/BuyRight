// client/src/pages/CarBrowse.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CarCard from '../components/CarCard';
import { getCars } from '../utils/api';

const BODY_TYPES = ['Sedan', 'SUV', 'Hatchback', 'MPV', 'Pickup', 'Coupe', 'Wagon'];
const PRICE_OPTIONS = [
  { label: 'Any price', value: '' },
  { label: 'Under RM 50k', value: '50000' },
  { label: 'Under RM 80k', value: '80000' },
  { label: 'Under RM 120k', value: '120000' },
  { label: 'Under RM 200k', value: '200000' },
];
const SORT_OPTIONS = [
  { label: 'Best deal', value: 'dealscore' },
  { label: 'Price: low', value: 'price_asc' },
  { label: 'Price: high', value: 'price_desc' },
  { label: 'Newest', value: 'newest' },
];

export default function CarBrowse() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    brand: params.get('brand') || '',
    bodyType: params.get('bodyType') || '',
    priceMax: params.get('priceMax') || '',
    sortBy: params.get('sortBy') || 'dealscore',
  });

  useEffect(() => {
    setLoading(true);
    const q = {};
    if (filters.brand)    q.brand    = filters.brand;
    if (filters.bodyType) q.bodyType = filters.bodyType;
    if (filters.priceMax) q.priceMax = filters.priceMax;
    if (filters.sortBy)   q.sortBy   = filters.sortBy;
    q.limit = 24;
    getCars(q)
      .then((d) => setCars(d.cars || []))
      .catch(() => setCars([]))
      .finally(() => setLoading(false));
  }, [filters]);

  function update(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  function clear() {
    setFilters({ brand: '', bodyType: '', priceMax: '', sortBy: 'dealscore' });
  }

  return (
    <div className="page browse-layout" style={{ display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
        padding: '32px 20px', height: 'calc(100vh - 60px)', overflowY: 'auto',
        position: 'sticky', top: 60, background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Filters</span>
          <button onClick={clear} style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}>Clear</button>
        </div>

        <FilterBlock label="Brand">
          <input
            className="input-field"
            placeholder="e.g. Toyota"
            value={filters.brand}
            onChange={(e) => update('brand', e.target.value)}
          />
        </FilterBlock>

        <FilterBlock label="Body type">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="radio" name="bodyType" value="" checked={!filters.bodyType} onChange={() => update('bodyType', '')} />
              Any
            </label>
            {BODY_TYPES.map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="radio" name="bodyType" value={t} checked={filters.bodyType === t} onChange={() => update('bodyType', t)} />
                {t}
              </label>
            ))}
          </div>
        </FilterBlock>

        <FilterBlock label="Max price">
          <select
            className="input-field"
            value={filters.priceMax}
            onChange={(e) => update('priceMax', e.target.value)}
            style={{ background: 'var(--bg-muted)' }}
          >
            {PRICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterBlock>

        <FilterBlock label="Sort by">
          <select
            className="input-field"
            value={filters.sortBy}
            onChange={(e) => update('sortBy', e.target.value)}
            style={{ background: 'var(--bg-muted)' }}
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterBlock>
      </aside>

      {/* Grid */}
      <main style={{ flex: 1, padding: '32px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>BuyRight Inventory</h1>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{cars.length} cars</span>
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 15 }}>Loading…</div>
        ) : cars.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>No cars match your filters. Try clearing some.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
            {cars.map((car) => <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterBlock({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}
