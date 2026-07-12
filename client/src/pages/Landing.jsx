import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CarCard from '../components/CarCard';
import { getCars } from '../utils/api';

const HOW_IT_WORKS_BUY = [
  { n: '01', title: 'Browse inventory', desc: "Search BuyRight's certified used cars or chat with our AI to find your match." },
  { n: '02', title: 'Enquire with us', desc: 'Found your car? Submit an enquiry and our team will contact you to arrange a test drive.' },
  { n: '03', title: 'Drive it home', desc: 'Complete the purchase with BuyRight — fully documented, no hidden fees.' },
];
const HOW_IT_WORKS_SELL = [
  { n: '01', title: 'Submit your car', desc: 'Fill in your car details and book a free physical inspection at one of our centres.' },
  { n: '02', title: 'Get an offer', desc: 'BuyRight reviews your car and sends you a cash offer — no obligation.' },
  { n: '03', title: 'Get paid', desc: 'Accept the offer and we handle all the paperwork. Cash in days, not weeks.' },
];

function HowItWorksStep({ n, title, desc }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 28, marginBottom: 8 }}>{n}</div>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [featuredCars, setFeaturedCars] = useState([]);

  useEffect(() => {
    getCars({ sortBy: 'dealscore', limit: 3 })
      .then((d) => setFeaturedCars(d.cars || []))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <section style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '80px 0 72px' }}>
        <div className="container" style={{ maxWidth: 720, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 600, fontSize: 13, padding: '5px 14px', borderRadius: 'var(--radius-pill)', marginBottom: 20, border: '1px solid var(--primary-border)' }}>
            Certified Used Cars · Malaysia
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.15, color: 'var(--text)', marginBottom: 18, letterSpacing: '-1px' }}>
            Buy smart.<br />Sell right.
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 36 }}>
            BuyRight buys, reconditions, and sells certified used cars across Malaysia. No private sellers. No surprises.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/cars"><button className="btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>Browse cars</button></Link>
            <Link to="/chat"><button className="btn-outline" style={{ padding: '14px 32px', fontSize: 16 }}>Chat with AI</button></Link>
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>How buying works</h2>
          </div>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {HOW_IT_WORKS_BUY.map((s) => <HowItWorksStep key={s.n} {...s} />)}
          </div>
        </div>
      </section>

      {featuredCars.length > 0 && (
        <section style={{ padding: '0 0 64px', background: 'var(--bg)' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>Top picks today</h2>
              <Link to="/cars" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>View all →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
              {featuredCars.map((car) => (
                <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ background: 'var(--primary)', padding: '64px 0' }}>
        <div className="container" style={{ maxWidth: 680, textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
            Want to sell your car?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, lineHeight: 1.65, marginBottom: 32 }}>
            Get a free valuation and a no-obligation cash offer from BuyRight. We handle the paperwork.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/sell">
              <button style={{
                background: '#fff', color: 'var(--primary)',
                fontWeight: 700, fontSize: 16, padding: '14px 32px',
                borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
              }}>
                Start selling
              </button>
            </Link>
            <Link to="/chat">
              <button style={{
                background: 'transparent', color: '#fff',
                fontWeight: 600, fontSize: 16, padding: '14px 32px',
                borderRadius: 'var(--radius-pill)', border: '2px solid rgba(255,255,255,0.6)', cursor: 'pointer',
              }}>
                Estimate my car
              </button>
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: '64px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>How selling works</h2>
          </div>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {HOW_IT_WORKS_SELL.map((s) => <HowItWorksStep key={s.n} {...s} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
