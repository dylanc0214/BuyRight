import { useState } from 'react';
import Header from './components/Header.jsx';
import ChatMessages from './components/ChatMessages.jsx';
import ChatInput from './components/ChatInput.jsx';
import { useChat } from './chatState.js';

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('keretaai_lang') || 'en');
  const { messages, isLoading, sendMessage, newChat } = useChat(language);

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('keretaai_lang', lang);
  };

  return (
    <div className="app">
      <Header language={language} onLanguageChange={changeLanguage} onNewChat={newChat} />
      <ChatMessages messages={messages} isLoading={isLoading} onSuggestion={sendMessage} />
      <ChatInput onSend={sendMessage} disabled={isLoading} language={language} />
    </div>
  );
}
