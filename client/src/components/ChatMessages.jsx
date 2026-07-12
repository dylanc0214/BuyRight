import { useEffect, useRef } from 'react';
import CarCard from './CarCard.jsx';
import SuggestedButtons from './SuggestedButtons.jsx';
import TypingIndicator from './TypingIndicator.jsx';

/**
 * Minimal markdown-lite renderer: **bold** and line breaks only.
 * ponytail: full markdown lib not needed for chatbot bubbles — add
 * react-markdown only if AI responses start using richer formatting.
 */
function renderContent(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function Bubble({ message, isLast, onSuggestion }) {
  const lines = String(message.content || '').split('\n');
  return (
    <div className={`message ${message.role}${message.type === 'error' ? ' error' : ''}`}>
      <div className="bubble">
        {lines.map((line, i) => (
          <p key={i} className="bubble-line">{renderContent(line)}</p>
        ))}
        {message.aiStatus === 'fallback' && (
          <div className="fallback-note">offline mode — AI narratives unavailable</div>
        )}
      </div>

      {message.cars && message.cars.length > 0 && (
        <div className="cards-grid">
          {message.cars.map((car) => (
            <CarCard key={car.id} car={car} onAction={isLast ? onSuggestion : null} />
          ))}
        </div>
      )}

      {isLast && message.role === 'assistant' && (
        <SuggestedButtons options={message.suggestedOptions} onSelect={onSuggestion} />
      )}
    </div>
  );
}

export default function ChatMessages({ messages, isLoading, onSuggestion }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <main className="chat">
      {messages.map((m, i) => (
        <Bubble key={m.id} message={m} isLast={i === messages.length - 1 && !isLoading} onSuggestion={onSuggestion} />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={endRef} />
    </main>
  );
}
