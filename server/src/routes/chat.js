/**
 * POST /api/chat — the KeretaAI chat orchestrator.
 *
 * One DeepSeek call classifies intent (buy/sell/detail/compare/general) and
 * extracts filters; the branch handlers below run the SQL work and a second
 * call writes the narrative. A regex fallback keeps everything functional
 * when the AI API is unreachable.
 */
const express = require('express');
const router = express.Router();

const {
  extractCarIntent,
  generateResultsAnswer,
  generateSellAnswer,
  generateDetailAnswer,
  generateCompareAnswer,
  generateGeneralAnswer,
} = require('../services/deepseekService');
const { parseFallback } = require('../services/fallbackParser');
const {
  searchCarsRelaxed,
  searchCarsByText,
  findComparables,
  countCars,
} = require('../services/carSearchService');
const { formatCarCard, formatCarCards } = require('../services/carFormatter');
const { estimatePrice, buildSellMessage } = require('../services/sellFlowService');
const {
  getConversation,
  createConversation,
  updateConversation,
  appendMessage,
  getChatHistory,
  getAccumulated,
} = require('../services/conversationService');

const T = {
  noResults: {
    en: "I couldn't find any cars matching that, even after widening the search. Try a different budget, brand, or state.",
    ms: 'Saya tidak jumpa kereta yang sepadan, walaupun selepas meluaskan carian. Cuba bajet, jenama, atau negeri lain.',
    zh: '即使扩大了搜索范围，我也找不到符合条件的车。请尝试不同的预算、品牌或州属。',
  },
  found: {
    en: (n) => `Found ${n} matching car${n > 1 ? 's' : ''} — here are the best ones by DealScore.`,
    ms: (n) => `Jumpa ${n} kereta yang sepadan — ini yang terbaik mengikut DealScore.`,
    zh: (n) => `找到 ${n} 辆符合条件的车 — 以下是 DealScore 最高的几辆。`,
  },
  clarifyBudget: {
    en: 'What budget should I work with?',
    ms: 'Berapakah bajet anda?',
    zh: '您的预算是多少？',
  },
  sellMissing: {
    en: 'To estimate a fair price, tell me the brand, model, year and rough mileage — e.g. "2019 Perodua Myvi, 60,000 km".',
    ms: 'Untuk anggaran harga, beritahu saya jenama, model, tahun dan perbatuan — cth. "Perodua Myvi 2019, 60,000 km".',
    zh: '要估算合理价格，请告诉我品牌、型号、年份和大概里程 — 例如 "2019 Perodua Myvi，60,000 公里"。',
  },
  detailNotFound: {
    en: "I couldn't find that exact car in our listings. Try the full name, e.g. \"2019 Honda Civic\".",
    ms: 'Saya tidak jumpa kereta itu dalam senarai kami. Cuba nama penuh, cth. "Honda Civic 2019".',
    zh: '在我们的列表中找不到那辆车。请尝试完整名称，例如 "2019 Honda Civic"。',
  },
  compareNeedTwo: {
    en: 'Tell me which two cars to compare — e.g. "compare the Myvi and the City".',
    ms: 'Beritahu saya dua kereta untuk dibandingkan — cth. "bandingkan Myvi dengan City".',
    zh: '请告诉我要比较哪两辆车 — 例如 "比较 Myvi 和 City"。',
  },
  welcome: {
    en: "I'm KeretaAI — I help you buy and sell second-hand cars across Malaysia. Tell me your budget or the car you want, or say \"I want to sell my car\".",
    ms: 'Saya KeretaAI — saya bantu anda beli dan jual kereta terpakai di seluruh Malaysia. Beritahu bajet atau kereta yang anda mahu, atau kata "saya nak jual kereta".',
    zh: '我是 KeretaAI — 帮您在马来西亚买卖二手车。告诉我您的预算或想要的车，或者说"我想卖车"。',
  },
};

function t(key, lang) {
  const entry = T[key];
  return entry[lang] || entry.en;
}

/** Merge new non-null filter values over accumulated ones. */
function mergeDefined(base = {}, patch = {}) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  }
  return out;
}

const DEFAULT_OPTIONS = {
  en: ['SUV under RM100k', 'Cheapest Perodua Myvi', 'Family MPV in Selangor', 'I want to sell my car'],
  ms: ['SUV bawah RM100k', 'Perodua Myvi paling murah', 'MPV keluarga di Selangor', 'Saya nak jual kereta'],
  zh: ['10万以下的SUV', '最便宜的 Perodua Myvi', '雪兰莪的家庭MPV', '我想卖车'],
};

router.post('/', async (req, res) => {
  const { message: rawMsg, conversationId, language } = req.body || {};
  const message = (rawMsg || '').trim();
  const lang = ['en', 'ms', 'zh'].includes(language) ? language : 'en';

  try {
    if (!message) return res.status(400).json({ success: false, error: 'Message is required.' });
    if (message.length > 2000) return res.status(400).json({ success: false, error: 'Message too long.' });

    // ── 1. Load or create conversation ──────────────────────────────────
    let conv = conversationId ? await getConversation(conversationId) : null;
    if (!conv) conv = await createConversation();
    const convId = conv.conversation_id;
    const history = getChatHistory(conv);
    const accumulated = getAccumulated(conv);
    const ctx = conv.session_context || {};

    await appendMessage(convId, 'user', message);

    // ── 2. Extract intent + filters (AI, falling back to regex) ─────────
    let ai;
    let aiStatus = 'live';
    try {
      ai = await extractCarIntent(message, history, accumulated, lang);
    } catch (err) {
      console.warn('[chat] DeepSeek extraction failed, using fallback:', err.message);
      ai = parseFallback(message);
      aiStatus = 'fallback';
    }
    ai.filters = ai.filters || {};
    ai.sellDetails = ai.sellDetails || {};

    // ── 3. Branch on intent ──────────────────────────────────────────────
    let result;
    switch (ai.intent) {
      case 'sell':
        result = await handleSell(ai, accumulated, convId, lang, aiStatus);
        break;
      case 'detail':
        result = await handleDetail(ai, message, ctx, convId, lang, aiStatus);
        break;
      case 'compare':
        result = await handleCompare(ai, message, ctx, convId, lang, aiStatus);
        break;
      case 'general':
        result = await handleGeneral(message, history, lang, aiStatus);
        break;
      case 'buy':
      default:
        result = await handleBuy(ai, message, accumulated, history, convId, lang, aiStatus);
        break;
    }

    // ── 4. Persist assistant reply ───────────────────────────────────────
    await appendMessage(convId, 'assistant', result.message, {
      type: result.type,
      cars: result.cars || [],
      suggestedOptions: result.suggestedOptions || [],
    });

    // ── 5. Respond ───────────────────────────────────────────────────────
    return res.json({
      success: true,
      conversationId: convId,
      type: result.type,
      message: result.message,
      cars: result.cars || [],
      suggestedOptions: result.suggestedOptions || [],
      totalResults: result.totalResults || (result.cars ? result.cars.length : 0),
      appliedFilters: result.appliedFilters || null,
      relaxedNotes: result.relaxedNotes || [],
      estimate: result.estimate || null,
      aiStatus,
    });
  } catch (err) {
    console.error('[chat] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Intent handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleBuy(ai, message, accumulated, history, convId, lang, aiStatus) {
  const merged = mergeDefined(accumulated.filters, ai.filters);

  if (!ai.hasEnoughInfo) {
    await updateConversation(convId, {
      state: 'gathering_info',
      context: { accumulatedFilters: merged },
    });
    return {
      type: 'clarification',
      message: ai.nextQuestion || t('clarifyBudget', lang),
      suggestedOptions: ai.suggestedOptions?.length ? ai.suggestedOptions : ['Under RM 30K', 'RM 30K - 60K', 'RM 60K - 100K', 'Above RM 100K'],
      appliedFilters: merged,
    };
  }

  const { rows, filters: applied, relaxedNotes } = await searchCarsRelaxed(merged, 6);
  const cars = formatCarCards(rows);

  if (cars.length === 0) {
    await updateConversation(convId, {
      state: 'gathering_info',
      context: { accumulatedFilters: merged },
    });
    return {
      type: 'no_results',
      message: t('noResults', lang),
      suggestedOptions: DEFAULT_OPTIONS[lang] || DEFAULT_OPTIONS.en,
      appliedFilters: merged,
    };
  }

  let narrative = T.found[lang] ? T.found[lang](cars.length) : T.found.en(cars.length);
  if (relaxedNotes.length > 0) narrative += ` (Note: ${relaxedNotes.join('; ')}.)`;
  if (aiStatus === 'live') {
    try {
      const gen = await generateResultsAnswer(message, cars, history, lang, relaxedNotes);
      narrative = gen.narrative;
      if (Array.isArray(gen.translatedSummaries)) {
        gen.translatedSummaries.forEach((s, i) => {
          if (s && cars[i]) cars[i].aiSummary = s;
        });
      }
    } catch (err) {
      console.warn('[chat] Results narrative failed, using template:', err.message);
    }
  }

  let totalResults = cars.length;
  try {
    totalResults = await countCars(applied);
  } catch { /* non-fatal */ }

  await updateConversation(convId, {
    state: 'results_shown',
    context: { accumulatedFilters: applied, lastCars: cars },
  });

  return {
    type: 'results',
    message: narrative,
    cars,
    suggestedOptions: [],
    totalResults,
    appliedFilters: applied,
    relaxedNotes,
  };
}

async function handleSell(ai, accumulated, convId, lang, aiStatus) {
  const draft = mergeDefined(accumulated.sellDetails, ai.sellDetails);
  const ready = draft.brand && draft.model && draft.year;

  if (!ready) {
    await updateConversation(convId, { state: 'selling', context: { sellDraft: draft } });
    return {
      type: 'clarification',
      message: ai.nextQuestion || t('sellMissing', lang),
      suggestedOptions: [],
    };
  }

  const comparables = await findComparables(draft, 8);
  const estimate = estimatePrice(draft, comparables);

  let narrative;
  if (aiStatus === 'live' && estimate) {
    try {
      narrative = await generateSellAnswer(draft, comparables, estimate, lang);
    } catch (err) {
      console.warn('[chat] Sell narrative failed, using template:', err.message);
      narrative = buildSellMessage(draft, estimate);
    }
  } else {
    narrative = buildSellMessage(draft, estimate);
  }

  const cars = formatCarCards(comparables.slice(0, 3));
  await updateConversation(convId, { state: 'selling', context: { sellDraft: draft } });

  return {
    type: 'sell_estimate',
    message: narrative,
    cars,
    estimate,
    suggestedOptions: [],
  };
}

async function handleDetail(ai, message, ctx, convId, lang, aiStatus) {
  const query = ai.detailQuery || message;
  const rows = await searchCarsByText(query, 3);
  let card = rows.length > 0 ? formatCarCard(rows[0]) : null;

  // If text search misses, fall back to the first previously shown card.
  if (!card && Array.isArray(ctx.lastCars) && ctx.lastCars.length > 0) {
    card = ctx.lastCars[0];
  }
  if (!card) {
    return { type: 'text', message: t('detailNotFound', lang), suggestedOptions: [] };
  }

  let narrative = card.aiSummary || card.title;
  if (aiStatus === 'live') {
    try {
      narrative = await generateDetailAnswer(card, message, lang);
    } catch (err) {
      console.warn('[chat] Detail narrative failed:', err.message);
    }
  }

  await updateConversation(convId, { state: 'details_viewing', context: { selectedCarId: card.id } });
  return { type: 'car_detail', message: narrative, cars: [card], suggestedOptions: [] };
}

async function handleCompare(ai, message, ctx, convId, lang, aiStatus) {
  const cards = [];
  for (const q of (ai.compareQueries || []).slice(0, 3)) {
    const rows = await searchCarsByText(q, 1);
    if (rows.length > 0) cards.push(formatCarCard(rows[0]));
  }
  if (cards.length < 2 && Array.isArray(ctx.lastCars) && ctx.lastCars.length >= 2) {
    ctx.lastCars.slice(0, 2).forEach((c) => {
      if (!cards.some((x) => x.id === c.id)) cards.push(c);
    });
  }
  if (cards.length < 2) {
    return { type: 'text', message: t('compareNeedTwo', lang), suggestedOptions: [] };
  }

  const pair = cards.slice(0, 2);
  let narrative;
  if (aiStatus === 'live') {
    try {
      narrative = await generateCompareAnswer(pair, message, lang);
    } catch (err) {
      console.warn('[chat] Compare narrative failed:', err.message);
    }
  }
  if (!narrative) {
    const [a, b] = pair;
    narrative = `${a.title} (${a.priceFormatted}, ${a.mileageFormatted}, DealScore ${a.dealscore}) vs ${b.title} (${b.priceFormatted}, ${b.mileageFormatted}, DealScore ${b.dealscore}). The higher DealScore is the better overall value.`;
  }

  await updateConversation(convId, { state: 'comparing', context: {} });
  return { type: 'comparison', message: narrative, cars: pair, suggestedOptions: [] };
}

async function handleGeneral(message, history, lang, aiStatus) {
  let narrative = t('welcome', lang);
  if (aiStatus === 'live') {
    try {
      narrative = await generateGeneralAnswer(message, history, lang);
    } catch (err) {
      console.warn('[chat] General narrative failed:', err.message);
    }
  }
  return {
    type: 'text',
    message: narrative,
    suggestedOptions: DEFAULT_OPTIONS[lang] || DEFAULT_OPTIONS.en,
  };
}

module.exports = router;
