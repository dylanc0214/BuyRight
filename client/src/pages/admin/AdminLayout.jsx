// client/src/pages/admin/AdminLayout.jsx
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/admin',              label: 'Overview',     exact: true },
  { to: '/admin/submissions',  label: 'Submissions'               },
  { to: '/admin/inspections',  label: 'Inspections'               },
  { to: '/admin/offers',       label: 'Make Offers'               },
  { to: '/admin/inventory',    label: 'Inventory'                 },
  { to: '/admin/buyers',       label: 'Buyers'                    },
  { to: '/admin/moderation',   label: 'Moderation'                },
  { to: '/admin/ai',           label: 'AI Config'                 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() { logout(); navigate('/'); }

  return (
    <div className="admin-shell" style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Mobile top bar */}
      <div className="admin-mobile-bar">
        <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>☰</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>BuyRight Admin</span>
      </div>

      {sidebarOpen && <div className="admin-backdrop open" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Brand */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 13, width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>BR</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>BuyRight</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }} onClick={() => setSidebarOpen(false)}>
          {NAV.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'block',
                padding: '9px 12px',
                borderRadius: 8,
                marginBottom: 2,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--primary)' : 'var(--text-dim)',
                background: isActive ? 'var(--primary-soft)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.12s',
              })}
            >{label}</NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{user?.name}</div>
          <button onClick={handleLogout} style={{ color: 'var(--red)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
