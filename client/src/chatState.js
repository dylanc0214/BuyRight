// client/src/chatState.js
import { useState, useEffect } from 'react';
import { postChat } from './utils/api';

const STORAGE_KEY = 'br_conv';

const WELCOME = {
  en: { role: 'assistant', content: "Hi! I'm BuyRight AI. I can help you find the perfect certified used car from our inventory, or guide you through selling your car to us. What are you looking for?\n\n[OPTIONS]Browse SUVs|Cars under RM 80k|Sell my car|What can you do?[/OPTIONS]", cars: [], suggestedOptions: ['Browse SUVs', 'Cars under RM 80k', 'Sell my car', 'What can you do?'] },
  ms: { role: 'assistant', content: "Hai! Saya BuyRight AI. Saya boleh bantu cari kereta terpakai atau panduan untuk jual kereta anda kepada kami. Apa yang anda cari?\n\n[OPTIONS]SUV bawah RM 80k|Kereta murah|Jual kereta saya[/OPTIONS]", cars: [], suggestedOptions: ['SUV bawah RM 80k', 'Kereta murah', 'Jual kereta saya'] },
  zh: { role: 'assistant', content: "你好！我是 BuyRight AI。我可以帮您找到合适的认证二手车，或指导您将车卖给我们。您在寻找什么？\n\n[OPTIONS]10万以下SUV|便宜的车|我想卖车[/OPTIONS]", cars: [], suggestedOptions: ['10万以下SUV', '便宜的车', '我想卖车'] },
};

function stripOptions(content) {
  return content.replace(/\[OPTIONS\].*?\[\/OPTIONS\]/gs, '').trim();
}

export function useChat(language = 'en') {
  const stored = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } })();
  const welcome = WELCOME[language] || WELCOME.en;

  const [messages, setMessages] = useState(() => stored.messages?.length ? stored.messages : [{ ...welcome, content: stripOptions(welcome.content) }]);
  const [conversationId, setConversationId] = useState(() => stored.conversationId || null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, conversationId }));
  }, [messages, conversationId]);

  async function sendMessage(text) {
    const userMsg = { role: 'user', content: text, cars: [], suggestedOptions: [] };
    setMessages((m) => [...m, userMsg]);
    setIsLoading(true);
    try {
      const data = await postChat({ message: text, conversationId, language });
      setConversationId(data.conversationId);
      setMessages((m) => [...m, {
        role: 'assistant',
        content: data.message,
        cars: data.cars || [],
        suggestedOptions: data.suggestedOptions || [],
      }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: "Sorry, I'm having trouble right now. Please try again.", cars: [], suggestedOptions: [] }]);
    } finally {
      setIsLoading(false);
    }
  }

  function newChat() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([{ ...welcome, content: stripOptions(welcome.content) }]);
    setConversationId(null);
  }

  return { messages, isLoading, sendMessage, newChat, conversationId };
}
