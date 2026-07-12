import { useState } from 'react';

export default function ChatInput({ onSend, disabled, placeholder = 'Ask about cars, or say "I want to sell my car"…' }) {
  const [value, setValue] = useState('');

  function handleSend() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    onSend(text);
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '12px 16px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-end',
    }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--bg-muted)',
          border: '1.5px solid transparent',
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 15,
          color: 'var(--text)',
          lineHeight: 1.5,
          transition: 'border-color 0.15s',
          maxHeight: 120,
          overflowY: 'auto',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'var(--bg-muted)'; }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="btn-primary"
        style={{ padding: '10px 20px', fontSize: 14, flexShrink: 0 }}
      >
        Send
      </button>
    </div>
  );
}
