/**
 * deepseekService.js — all DeepSeek API interaction for KeretaAI.
 *
 * Improvement over BidNow: ONE extraction call per turn returns intent
 * (buy / sell / detail / compare / general) + filters + next question,
 * instead of separate classification and extraction round trips.
 */
const axios = require('axios');

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getKey() {
  return process.env.DEEPSEEK_API_KEY || '';
}

const LANG_INSTRUCTIONS = {
  en: 'Respond in English.',
  ms: 'Balas dalam Bahasa Melayu.',
  zh: '请用中文（简体）回复。',
};

function getLangInstruction(language) {
  return LANG_INSTRUCTIONS[(language || 'en').toLowerCase()] || LANG_INSTRUCTIONS.en;
}

/**
 * Strip markdown fences / stray prose so JSON.parse always gets clean JSON.
 */
function cleanJson(raw) {
  let cleaned = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1);
  return cleaned;
}

/** Low-level DeepSeek chat completion. Returns the message content string. */
async function callDeepSeek({ messages, temperature = 0.7, maxTokens = 800, jsonMode = false, language = 'en' }) {
  const key = getKey();
  if (!key || key === 'your_deepseek_api_key_here') {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const langInstruction = getLangInstruction(language);
  const augmented = messages.map((m) =>
    m.role === 'system' ? { ...m, content: `${m.content}\n\n${langInstruction}` } : m
  );

  // Reasoning models consume completion tokens while thinking — scale up so
  // JSON never truncates mid-object.
  const isReasoning = /flash|reasoner|r1/i.test(String(DEEPSEEK_MODEL));
  const body = {
    model: DEEPSEEK_MODEL,
    messages: augmented,
    temperature,
    max_tokens: isReasoning ? Math.max(maxTokens * 3, 1500) : maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const config = {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    timeout: 20000,
  };

  // ponytail: one retry on transient failure so a single flaky call doesn't
  // dump the user to the regex fallback; escalate to a retry loop if needed.
  let response;
  try {
    response = await axios.post(`${DEEPSEEK_API_URL}/chat/completions`, body, config);
  } catch (err) {
    const status = err.response?.status;
    const isTransient = !status || status >= 500 || err.code === 'ECONNABORTED';
    if (!isTransient) throw err;
    await sleep(500);
    response = await axios.post(`${DEEPSEEK_API_URL}/chat/completions`, body, config);
  }
  return response.data.choices[0].message.content;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT + FILTER EXTRACTION (single call per turn)
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_SYSTEM = `You are the intent and filter extraction engine for KeretaAI, a Malaysian second-hand car marketplace chatbot that serves BOTH buyers and sellers.

Classify the user's intent and extract structured data from the message plus conversation history.

INTENTS:
- "buy": user is searching for a car to buy (budget, brand, type, location...)
- "sell": user wants to sell their own car or asks what their car is worth
- "detail": user asks about one specific listing already shown or named ("tell me more about the Civic")
- "compare": user wants to compare two or more specific cars
- "general": greetings, questions about KeretaAI, car-buying advice, anything else

BUY FILTER FIELDS (null when absent):
- brand: canonical brand name, one of: Perodua, Proton, Toyota, Honda, Nissan, Mazda, Mitsubishi, Suzuki, Isuzu, Ford, Hyundai, Kia, Chery, BYD, Tesla, Volkswagen, BMW, Mercedes-Benz, Audi, Volvo, Lexus, Subaru, Peugeot, MINI
  * Aliases: "Merc"/"Benz"→"Mercedes-Benz", "VW"→"Volkswagen", "Beemer"→"BMW"
- model: model name (e.g. "Myvi", "Civic", "Hilux") or null
- priceMin / priceMax: numbers in RM or null
- yearMin / yearMax: integers or null ("2020 or newer" → yearMin 2020; "not older than 5 years" → yearMin = current year - 5)
- mileageMax: km or null ("low mileage" → 60000)
- transmission: "Automatic" | "Manual" | null
- fuelType: "Petrol" | "Diesel" | "Hybrid" | "EV" | null ("electric car" → "EV")
- bodyType: "Hatchback" | "Sedan" | "SUV" | "MPV" | "Pickup" | "Coupe" | "Wagon" | null ("family car with 7 seats" → "MPV"; "truck" → "Pickup")
- minSeats: integer or null ("7 seater" → 7)
- state: Malaysian state or FT: Kuala Lumpur, Selangor, Penang, Johor, Perak, Melaka, Negeri Sembilan, Pahang, Terengganu, Kelantan, Kedah, Perlis, Sabah, Sarawak, Putrajaya, Labuan
  * Aliases: "KL"→"Kuala Lumpur", "JB"→state "Johor" + city "Johor Bahru", "KK"→state "Sabah" + city "Kota Kinabalu", "PJ"→state "Selangor" + city "Petaling Jaya", "Penang"/"Pulau Pinang"→"Penang"
- city: Malaysian city or null
- sortBy: "price_asc" | "price_desc" | "newest" | "mileage_asc" | "dealscore" | null ("cheapest"→price_asc, "best deal"→dealscore, "newest"→newest)

PRICE RULES:
- "under RM50k" → priceMax 50000 (no priceMin)
- "RM30k-60k" → priceMin 30000, priceMax 60000
- "my budget is RM80k" (bare budget) → priceMin ~60% of budget, priceMax = budget, sortBy "price_desc"
- "ribu" = thousand; "50 ribu" → 50000

SELL FIELDS (when intent is "sell", extract what's given, null otherwise):
- sellDetails: { brand, model, variant, year, mileageKm, condition }

DETAIL / COMPARE:
- detailQuery: the car name the user is asking about, or null
- compareQueries: array of car names to compare (empty if user means "compare the ones you showed")

hasEnoughInfo (buy intent): true when at least 2 of [brand, priceMax, bodyType, state] are set in the COMBINED (previous + current) filters, OR a bare budget was given, OR the user says "show all"/"anything"/"no preference". Count previously extracted filters — if budget was already known and the user just added a state, that IS enough.

hasEnoughInfo (sell intent): true when brand, model AND year are all known (combined with previous sellDetails).

When refining, include ALL previously extracted filters plus the new ones. If the user changes a value, the new value wins.

QUESTION PRIORITY when info is missing (ask ONLY the most important one):
buy: 1. budget 2. body type or brand 3. state/location
sell: whichever of brand/model/year/mileage is missing

Return JSON only:
{
  "intent": "buy|sell|detail|compare|general",
  "hasEnoughInfo": true/false,
  "filters": { ...all buy filter fields... },
  "sellDetails": { "brand": null, "model": null, "variant": null, "year": null, "mileageKm": null, "condition": null },
  "detailQuery": "string or null",
  "compareQueries": [],
  "nextQuestion": "string or null — in the user's language",
  "suggestedOptions": ["up to 4 short clickable answers, in the user's language"],
  "searchSummary": "one-line description e.g. 'SUVs under RM100k in Selangor'"
}`;

async function extractCarIntent(userMessage, conversationHistory = [], accumulated = {}, language = 'en') {
  const hasCtx = Object.keys(accumulated.filters || {}).length > 0 || Object.keys(accumulated.sellDetails || {}).length > 0;
  const context = hasCtx
    ? `Previously extracted: ${JSON.stringify(accumulated)}\n\nUser: ${userMessage}`
    : userMessage;
  const recent = conversationHistory.slice(-6).map((m) => ({ role: m.role, content: m.content }));

  const content = await callDeepSeek({
    messages: [
      { role: 'system', content: INTENT_SYSTEM },
      ...recent,
      { role: 'user', content: context },
    ],
    temperature: 0.1,
    maxTokens: 600,
    jsonMode: true,
    language,
  });
  return JSON.parse(cleanJson(content));
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS NARRATIVE
// ─────────────────────────────────────────────────────────────────────────────
const RESULTS_SYSTEM = `You are KeretaAI, a friendly Malaysian second-hand car expert.

You will be given matched car listings from a live database plus the user's search.
Write a natural, helpful response that:
1. Acknowledges the search and result count
2. Highlights the top 1-2 standout cars (best DealScore, below-market price, or lowest mileage)
3. Mentions a useful pattern ("all are automatics", "monthly installments start from RM4xx")
4. If relaxation notes are provided, briefly explain what was widened and why
5. Invites follow-up ("Want to compare any two?", "Ask for details on any of these")

Keep it to 3-5 sentences. Be warm and practical. Do NOT list every car — cards are shown separately. Do NOT fabricate data.

When the user's language is NOT English, also translate each car's aiSummary.
Return clean JSON:
{
  "narrative": "your response",
  "translatedSummaries": ["one per car, same order; for English copy the originals verbatim"]
}
The translatedSummaries array MUST match the number of cars provided.`;

async function generateResultsAnswer(userMessage, cars, conversationHistory = [], language = 'en', relaxedNotes = []) {
  const carLines = cars.slice(0, 6).map((c, i) =>
    `${i + 1}. ${c.title} (${c.city}, ${c.state}) — ${c.priceFormatted}, ${c.mileageFormatted}, DealScore ${c.dealscore}, ${c.monthlyEstimateFormatted}`
  ).join('\n');
  const relaxNote = relaxedNotes.length > 0
    ? `\n\nSearch relaxations applied (explain briefly): ${relaxedNotes.join('; ')}`
    : '';
  const recent = conversationHistory.slice(-4).map((m) => ({ role: m.role, content: m.content }));

  const content = await callDeepSeek({
    messages: [
      { role: 'system', content: RESULTS_SYSTEM },
      ...recent,
      { role: 'user', content: `User searched: "${userMessage}"${relaxNote}\n\nMatched cars (${cars.length} shown):\n${carLines}\n\nReturn JSON with "narrative" and "translatedSummaries".` },
    ],
    temperature: 0.6,
    maxTokens: 600,
    jsonMode: true,
    language,
  });

  try {
    const parsed = JSON.parse(cleanJson(content));
    return {
      narrative: parsed.narrative || content,
      translatedSummaries: parsed.translatedSummaries || cars.map((c) => c.aiSummary || ''),
    };
  } catch {
    return { narrative: content, translatedSummaries: cars.map((c) => c.aiSummary || '') };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SELL-FLOW NARRATIVE (KeretaAI improvement — BidNow had no seller mode)
// ─────────────────────────────────────────────────────────────────────────────
const SELL_SYSTEM = `You are KeretaAI, helping a Malaysian car owner sell their second-hand car.

You are given the seller's car details, comparable live listings from the KeretaAI database, and a computed price estimate.
Write a response that:
1. States the suggested asking price and the fair range, referencing how many comparable listings it's based on
2. Notes how their mileage/year compares to those listings (only from provided data)
3. Gives 2-3 practical, Malaysia-specific selling tips (service records, Puspakom B5 inspection for ownership transfer, good photos)
4. Ends with a short ready-to-post listing draft (2-3 lines) they can copy

Be encouraging and concrete. Do NOT fabricate market data beyond what is provided. Use RM formatting like RM 45,000.`;

async function generateSellAnswer(sellDetails, comparables, estimate, language = 'en') {
  const compLines = comparables.slice(0, 6).map((c, i) =>
    `${i + 1}. ${c.title} — RM ${Number(c.price).toLocaleString()}, ${Number(c.mileage_km).toLocaleString()} km (${c.state})`
  ).join('\n');

  return callDeepSeek({
    messages: [
      { role: 'system', content: SELL_SYSTEM },
      {
        role: 'user',
        content: `Seller's car: ${JSON.stringify(sellDetails)}\n\nPrice estimate: suggested RM ${estimate.suggested.toLocaleString()}, fair range RM ${estimate.low.toLocaleString()} – RM ${estimate.high.toLocaleString()} (based on ${estimate.sampleSize} comparable listings)\n\nComparable listings:\n${compLines || '(none found)'}\n\nWrite the seller response.`,
      },
    ],
    temperature: 0.6,
    maxTokens: 500,
    language,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL / COMPARE / GENERAL
// ─────────────────────────────────────────────────────────────────────────────
const DETAIL_SYSTEM = `You are KeretaAI, a Malaysian second-hand car expert. The user asked about one specific listing. Using ONLY the provided data, give a helpful 3-4 sentence rundown: value for money (price vs market range), mileage for its age, monthly installment, and who it suits. End by offering the seller's contact or a comparison. Do not fabricate.`;

async function generateDetailAnswer(car, userMessage, language = 'en') {
  return callDeepSeek({
    messages: [
      { role: 'system', content: DETAIL_SYSTEM },
      { role: 'user', content: `Listing: ${JSON.stringify(car)}\n\nUser asked: "${userMessage}"` },
    ],
    temperature: 0.5,
    maxTokens: 400,
    language,
  });
}

const COMPARE_SYSTEM = `You are KeretaAI, a Malaysian second-hand car expert. Compare the provided listings using ONLY the given data. Cover: price & value vs market, mileage & age, running costs (fuel type, monthly installment), practicality (body type, seats), and DealScore. Finish with a clear one-sentence recommendation for a typical buyer. 5-7 sentences max.`;

async function generateCompareAnswer(cars, userMessage, language = 'en') {
  return callDeepSeek({
    messages: [
      { role: 'system', content: COMPARE_SYSTEM },
      { role: 'user', content: `Listings to compare: ${JSON.stringify(cars)}\n\nUser asked: "${userMessage}"` },
    ],
    temperature: 0.5,
    maxTokens: 500,
    language,
  });
}

const GENERAL_SYSTEM = `You are KeretaAI, a friendly AI assistant for buying and selling second-hand cars in Malaysia. You can: search 100+ live listings across every state, score deals (DealScore), estimate monthly installments, compare cars, and help sellers price their car from comparable listings.

Answer the user's message helpfully in 2-4 sentences. If they seem unsure, suggest what to try (e.g. "SUV under RM100k in Selangor" or "I want to sell my 2019 Myvi"). Never invent specific listings — invite them to search instead.`;

async function generateGeneralAnswer(userMessage, conversationHistory = [], language = 'en') {
  const recent = conversationHistory.slice(-6).map((m) => ({ role: m.role, content: m.content }));
  return callDeepSeek({
    messages: [
      { role: 'system', content: GENERAL_SYSTEM },
      ...recent,
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    maxTokens: 300,
    language,
  });
}

module.exports = {
  callDeepSeek,
  extractCarIntent,
  generateResultsAnswer,
  generateSellAnswer,
  generateDetailAnswer,
  generateCompareAnswer,
  generateGeneralAnswer,
  getLangInstruction,
};
