import { useState } from 'react';

const PLACEHOLDERS = {
  en: 'e.g. "Honda SUV under RM100k in Penang" or "sell my 2019 Myvi, 60k km"',
  ms: 'cth. "SUV Honda bawah RM100k di Penang" atau "jual Myvi 2019 saya, 60k km"',
  zh: '例如 "槟城10万以下的Honda SUV" 或 "卖掉我的2019 Myvi，6万公里"',
};

export default function ChatInput({ onSend, disabled, language }) {
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };

  return (
    <footer className="input-bar">
      <textarea
        className="input-field"
        rows={1}
        value={text}
        placeholder={PLACEHOLDERS[language] || PLACEHOLDERS.en}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button className="btn-send" onClick={submit} disabled={disabled || !text.trim()}>
        Send
      </button>
    </footer>
  );
}
