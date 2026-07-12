/**
 * conversationService.js — conversation persistence in Postgres.
 * All per-conversation memory (messages, accumulated filters, sell draft,
 * last results) lives in the session_context JSONB column.
 */
const pool = require('./db');

async function getConversation(conversationId) {
  if (!conversationId) return null;
  const { rows } = await pool.query(
    'SELECT * FROM conversations WHERE conversation_id = $1',
    [conversationId]
  );
  return rows[0] || null;
}

async function createConversation(context = {}) {
  const { rows } = await pool.query(
    'INSERT INTO conversations (session_context) VALUES ($1) RETURNING *',
    [JSON.stringify({ messages: [], ...context })]
  );
  return rows[0];
}

/**
 * Merge a context patch into session_context (shallow) and optionally set state.
 */
async function updateConversation(conversationId, { state, context } = {}) {
  const conv = await getConversation(conversationId);
  if (!conv) return null;
  const merged = { ...(conv.session_context || {}), ...(context || {}) };
  const { rows } = await pool.query(
    'UPDATE conversations SET session_context = $1, state = COALESCE($2, state) WHERE conversation_id = $3 RETURNING *',
    [JSON.stringify(merged), state || null, conversationId]
  );
  return rows[0];
}

async function appendMessage(conversationId, role, content, extra = {}) {
  const conv = await getConversation(conversationId);
  if (!conv) return null;
  const ctx = conv.session_context || {};
  const messages = ctx.messages || [];
  messages.push({ role, content, timestamp: new Date().toISOString(), ...extra });
  // Keep the stored transcript bounded.
  ctx.messages = messages.slice(-60);
  const { rows } = await pool.query(
    'UPDATE conversations SET session_context = $1 WHERE conversation_id = $2 RETURNING *',
    [JSON.stringify(ctx), conversationId]
  );
  return rows[0];
}

function getChatHistory(conv) {
  return conv?.session_context?.messages || [];
}

function getAccumulated(conv) {
  const ctx = conv?.session_context || {};
  return {
    filters: ctx.accumulatedFilters || {},
    sellDetails: ctx.sellDraft || {},
  };
}

module.exports = {
  getConversation,
  createConversation,
  updateConversation,
  appendMessage,
  getChatHistory,
  getAccumulated,
};
