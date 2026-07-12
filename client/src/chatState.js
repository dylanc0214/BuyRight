import { useState, useCallback, useEffect } from 'react';
import { postChat } from './utils/api';
import { loadJSON, saveJSON, removeKeys } from './utils/storage';

const KEY_MESSAGES = 'keretaai_messages';
const KEY_CONV_ID = 'keretaai_conversation_id';
const MAX_PERSISTED = 50;

export function getWelcomeMessage(lang) {
  const content = {
    en: "Hi! I'm **KeretaAI** 🚗 — your AI for second-hand cars in Malaysia.\n\n**Buying?** Tell me your budget, brand, or body type.\n**Selling?** Describe your car and I'll suggest a fair price from live comparable listings.",
    ms: 'Hai! Saya **KeretaAI** 🚗 — AI untuk kereta terpakai di Malaysia.\n\n**Nak beli?** Beritahu bajet, jenama, atau jenis kereta.\n**Nak jual?** Terangkan kereta anda dan saya cadangkan harga berpatutan berdasarkan senarai sebenar.',
    zh: '您好！我是 **KeretaAI** 🚗 — 马来西亚二手车AI助手。\n\n**想买车？**告诉我您的预算、品牌或车型。\n**想卖车？**描述您的车，我会根据在售的同款车建议一个合理价格。',
  };
  const suggestedOptions = {
    en: ['SUV under RM100k', 'Cheapest Perodua Myvi', 'Family MPV in Selangor', 'I want to sell my car'],
    ms: ['SUV bawah RM100k', 'Perodua Myvi paling murah', 'MPV keluarga di Selangor', 'Saya nak jual kereta'],
    zh: ['10万以下的SUV', '最便宜的 Perodua Myvi', '雪兰莪的家庭MPV', '我想卖车'],
  };
  return {
    id: 'welcome',
    role: 'assistant',
    content: content[lang] || content.en,
    type: 'text',
    timestamp: new Date().toISOString(),
    cars: [],
    suggestedOptions: suggestedOptions[lang] || suggestedOptions.en,
  };
}

export function useChat(language = 'en') {
  const [messages, setMessages] = useState(() => {
    const saved = loadJSON(KEY_MESSAGES);
    return Array.isArray(saved) && saved.length > 0 ? saved : [getWelcomeMessage(language)];
  });
  const [conversationId, setConversationId] = useState(() => loadJSON(KEY_CONV_ID));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    saveJSON(KEY_MESSAGES, messages.slice(-MAX_PERSISTED));
  }, [messages]);

  useEffect(() => {
    if (conversationId) saveJSON(KEY_CONV_ID, conversationId);
  }, [conversationId]);

  // Swap the welcome message when the language changes (only on an untouched chat)
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].id === 'welcome' ? [getWelcomeMessage(language)] : prev
    );
  }, [language]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [...prev, {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      type: 'text',
      timestamp: new Date().toISOString(),
      cars: [],
      suggestedOptions: [],
    }]);
    setIsLoading(true);

    try {
      const data = await postChat({ message: trimmed, conversationId, language });
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.message || '…',
        type: data.type || 'text',
        timestamp: new Date().toISOString(),
        cars: data.cars || [],
        suggestedOptions: data.suggestedOptions || [],
        totalResults: data.totalResults,
        relaxedNotes: data.relaxedNotes || [],
        estimate: data.estimate || null,
        aiStatus: data.aiStatus,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't reach the server. Make sure the backend is running, then try again.",
        type: 'error',
        timestamp: new Date().toISOString(),
        cars: [],
        suggestedOptions: [],
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, language, isLoading]);

  const newChat = useCallback(() => {
    setMessages([getWelcomeMessage(language)]);
    setConversationId(null);
    removeKeys([KEY_MESSAGES, KEY_CONV_ID]);
  }, [language]);

  return { messages, isLoading, sendMessage, newChat };
}
