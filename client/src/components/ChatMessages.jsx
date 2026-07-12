import CarCard from './CarCard';
import TypingIndicator from './TypingIndicator';
import { useNavigate } from 'react-router-dom';

export default function ChatMessages({ messages, isLoading, onSuggestion }) {
  const navigate = useNavigate();
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
      {messages.map((msg, i) => (
        <div key={i} style={{ marginBottom: 16, padding: '0 16px' }}>
          {msg.role === 'user' ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                background: 'var(--primary)', color: '#fff',
                borderRadius: '18px 18px 4px 18px',
                padding: '10px 16px', maxWidth: '75%', fontSize: 15, lineHeight: 1.5,
              }}>{msg.content}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '85%' }}>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '18px 18px 18px 4px',
                padding: '10px 16px', fontSize: 15, lineHeight: 1.6, color: 'var(--text)',
                whiteSpace: 'pre-wrap',
              }}>{msg.content}</div>
              {msg.cars?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                  {msg.cars.map((car) => (
                    <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} />
                  ))}
                </div>
              )}
              {msg.suggestedOptions?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {msg.suggestedOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onSuggestion(opt)}
                      style={{
                        background: 'var(--primary-soft)',
                        border: '1px solid var(--primary-border)',
                        color: 'var(--primary)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#ffe8d9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-soft)'}
                    >{opt}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {isLoading && <div style={{ padding: '0 16px' }}><TypingIndicator /></div>}
    </div>
  );
}
