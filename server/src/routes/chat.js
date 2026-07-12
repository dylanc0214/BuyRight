const express = require('express');
const router = express.Router();
const { callDeepSeekWithTools } = require('../services/deepseekService');
const { parseFallback } = require('../services/fallbackParser');
const { buildSystemPrompt } = require('../services/buyRightSystemPrompt');
const { TOOL_DEFINITIONS, executeTool } = require('../services/aiTools');
const {
  getConversation,
  createConversation,
  appendMessage,
  getChatHistory,
} = require('../services/conversationService');

const MAX_ITERATIONS = 5;

function parseOptions(text) {
  const match = text.match(/\[OPTIONS\](.*?)\[\/OPTIONS\]/s);
  if (!match) return { message: text, suggestedOptions: [] };
  const suggestedOptions = match[1].split('|').map((s) => s.trim()).filter(Boolean);
  const message = text.replace(/\[OPTIONS\].*?\[\/OPTIONS\]/s, '').trim();
  return { message, suggestedOptions };
}

function extractCarsFromResults(toolResults) {
  const cars = [];
  for (const r of toolResults) {
    if (r.cars) cars.push(...r.cars);
    if (r.car) cars.push(r.car);
  }
  const seen = new Set();
  return cars.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
}

router.post('/', async (req, res) => {
  const { message: rawMsg, conversationId, language = 'en' } = req.body || {};
  const message = (rawMsg || '').trim();
  const lang = ['en', 'ms', 'zh'].includes(language) ? language : 'en';

  if (!message) return res.status(400).json({ success: false, error: 'Message is required.' });
  if (message.length > 2000) return res.status(400).json({ success: false, error: 'Message too long.' });

  try {
    let conv = conversationId ? await getConversation(conversationId) : null;
    if (!conv) conv = await createConversation();
    const convId = conv.conversation_id;

    const storedMessages = getChatHistory(conv).slice(-40);
    const llmHistory = storedMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const systemPrompt = buildSystemPrompt({ language: lang });
    let currentMessages = [
      { role: 'system', content: systemPrompt },
      ...llmHistory,
      { role: 'user', content: message },
    ];

    let finalText = null;
    const toolResultsThisTurn = [];
    let aiStatus = 'live';

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const aiMsg = await callDeepSeekWithTools(currentMessages, TOOL_DEFINITIONS);
        currentMessages.push(aiMsg);

        if (!aiMsg.tool_calls || aiMsg.tool_calls.length === 0) {
          finalText = aiMsg.content;
          break;
        }

        for (const tc of aiMsg.tool_calls) {
          let args;
          try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
          const result = await executeTool(tc.function.name, args);
          toolResultsThisTurn.push(result);
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      }
    } catch (err) {
      console.warn('[chat] AI agent error, using fallback:', err.message);
      aiStatus = 'fallback';
      const parsed = parseFallback(message);
      finalText = parsed?.response || "Sorry, I'm having trouble right now. Please try again.";
    }

    if (!finalText) finalText = "I couldn't complete that request. Please try again.";

    const { message: cleanMessage, suggestedOptions } = parseOptions(finalText);
    const cars = extractCarsFromResults(toolResultsThisTurn);

    await appendMessage(convId, 'user', message);
    await appendMessage(convId, 'assistant', cleanMessage, { cars, suggestedOptions });

    return res.json({
      success: true,
      conversationId: convId,
      message: cleanMessage,
      cars,
      suggestedOptions,
      aiStatus,
    });
  } catch (err) {
    console.error('[chat] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
