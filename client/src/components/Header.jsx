import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleLogout() { logout(); navigate('/'); }

  const navLink = (to, label) => (
    <Link
      to={to}
      style={{
        color: pathname === to ? 'var(--primary)' : 'var(--text-dim)',
        fontSize: 14,
        fontWeight: pathname === to ? 600 : 500,
        transition: 'color 0.12s',
      }}
    >
      {label}
    </Link>
  );

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      height: 60,
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 32 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            background: 'var(--primary)', color: '#fff',
            fontWeight: 800, fontSize: 14, letterSpacing: '-0.5px',
            width: 32, height: 32, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>BR</span>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>BuyRight</span>
        </Link>

        <nav style={{ display: 'flex', gap: 24, flex: 1 }}>
          {navLink('/cars', 'Browse')}
          {navLink('/chat', 'AI Chat')}
          {navLink('/sell', 'Sell My Car')}
        </nav>

        {user ? (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {user.role === 'admin' && (
              <Link to="/admin" style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>Admin</Link>
            )}
            <Link to="/account" style={{ color: 'var(--text-dim)', fontSize: 14 }}>{user.name}</Link>
            <button onClick={handleLogout} style={{ color: 'var(--red)', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none' }}>
              Sign out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login">
              <button className="btn-outline" style={{ padding: '8px 18px', fontSize: 14 }}>Log in</button>
            </Link>
            <Link to="/register">
              <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>Register</button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
