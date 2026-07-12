// client/src/pages/Chat.jsx
import { useState, useRef, useEffect } from 'react';
import { useChat } from '../chatState';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ms', label: 'BM' },
  { code: 'zh', label: '中' },
];

export default function Chat() {
  const [language, setLanguage] = useState(() => localStorage.getItem('br_lang') || 'en');
  const { messages, isLoading, sendMessage, newChat } = useChat(language);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function switchLang(lang) {
    setLanguage(lang);
    localStorage.setItem('br_lang', lang);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: 'var(--bg-chat)' }}>
      {/* Chat header bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>BuyRight AI</span>
          <span style={{ color: 'var(--green)', fontSize: 12, marginLeft: 8 }}>● Online</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Language switcher */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-muted)', borderRadius: 'var(--radius-pill)', padding: 3 }}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                style={{
                  background: language === l.code ? 'var(--surface)' : 'transparent',
                  color: language === l.code ? 'var(--text)' : 'var(--text-secondary)',
                  fontWeight: language === l.code ? 700 : 500,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: language === l.code ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.12s',
                }}
              >{l.label}</button>
            ))}
          </div>
          <button
            onClick={newChat}
            style={{ color: 'var(--text-secondary)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px' }}
          >
            New chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <ChatMessages messages={messages} isLoading={isLoading} onSuggestion={sendMessage} />
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
