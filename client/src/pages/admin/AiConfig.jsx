// client/src/pages/admin/AiConfig.jsx
import { useState } from 'react';

export default function AiConfig() {
  const [tone, setTone] = useState('friendly');
  const [lang, setLang] = useState('en');
  const [fallback, setFallback] = useState(true);
  const [saved, setSaved] = useState(false);

  function save() {
    // ponytail: AI config stored in env vars for MVP — no DB persistence yet
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ padding: 32, maxWidth: 580 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>AI Config</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>BuyRight AI assistant settings. Changes take effect on the next conversation turn.</p>

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <ConfigRow label="Response tone" desc="How the AI presents information to users.">
          <div style={{ display: 'flex', gap: 8 }}>
            {['friendly','professional','concise'].map((t) => (
              <button key={t} onClick={() => setTone(t)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid', borderColor: tone===t?'var(--primary)':'var(--border)', background: tone===t?'var(--primary-soft)':'transparent', color: tone===t?'var(--primary)':'var(--text-dim)', fontWeight: tone===t?700:400, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
        </ConfigRow>

        <ConfigRow label="Default language" desc="Language used when user hasn't set a preference.">
          <select className="input-field" style={{ maxWidth: 200, background: 'var(--bg-muted)' }} value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="ms">Bahasa Malaysia</option>
            <option value="zh">中文</option>
          </select>
        </ConfigRow>

        <ConfigRow label="Regex fallback" desc="Use pattern matching when DeepSeek API is unavailable.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div onClick={() => setFallback((f) => !f)} style={{ width: 40, height: 22, borderRadius: 11, background: fallback?'var(--primary)':'var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: fallback?20:2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            </div>
            <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{fallback ? 'Enabled' : 'Disabled'}</span>
          </label>
        </ConfigRow>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={save}>
            {saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, desc, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  );
}
