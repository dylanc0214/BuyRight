// client/src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerApi, loginApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await registerApi(form);
      const { token, user } = await loginApi({ email: form.email, password: form.password });
      login(token, user);
      navigate('/account');
    } catch (err) {
      setError(err.message === 'email_taken' ? 'That email is already registered.' : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Create an account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Join BuyRight to buy or sell cars</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: 'name',     label: 'Full name',    type: 'text',     ph: 'Ahmad Razali', req: true },
              { key: 'email',    label: 'Email',         type: 'email',    ph: 'you@example.com', req: true },
              { key: 'phone',    label: 'Phone (optional)', type: 'tel', ph: '01X-XXXXXXX', req: false },
              { key: 'password', label: 'Password',      type: 'password', ph: 'Min. 8 characters', req: true },
            ].map(({ key, label, type, ph, req }) => (
              <div key={key}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>{label}</label>
                <input className="input-field" type={type} required={req} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={ph} />
              </div>
            ))}
            {error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{error}</div>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: 13, marginTop: 4 }} disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 20 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
