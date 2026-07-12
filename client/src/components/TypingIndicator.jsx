export default function TypingIndicator() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '18px 18px 18px 4px',
      padding: '10px 16px',
    }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--text-faint)',
            animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing-dot {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40%            { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
