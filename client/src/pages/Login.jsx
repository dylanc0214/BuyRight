// client/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await loginApi(form);
      login(token, user);
      navigate(user.role === 'admin' ? '/admin' : '/account');
    } catch (err) {
      setError(err.message === 'invalid_credentials' ? 'Incorrect email or password.' : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Log in to your BuyRight account</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Email</label>
              <input className="input-field" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Password</label>
              <input className="input-field" type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{error}</div>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: 13, marginTop: 4 }} disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 20 }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
