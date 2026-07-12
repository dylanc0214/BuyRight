export default function SuggestedButtons({ options, onSelect }) {
  if (!options?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 16px' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary-border)',
            color: 'var(--primary)',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >{opt}</button>
      ))}
    </div>
  );
}
