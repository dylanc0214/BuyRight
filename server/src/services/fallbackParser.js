/**
 * fallbackParser.js — regex/keyword fallback when the DeepSeek API is
 * unavailable. Keeps the demo alive offline. Returns the same shape as
 * deepseekService.extractCarIntent().
 */

const BRANDS = [
  'Perodua', 'Proton', 'Toyota', 'Honda', 'Nissan', 'Mazda', 'Mitsubishi',
  'Suzuki', 'Isuzu', 'Ford', 'Hyundai', 'Kia', 'Chery', 'BYD', 'Tesla',
  'Volkswagen', 'BMW', 'Mercedes-Benz', 'Audi', 'Volvo', 'Lexus', 'Subaru',
  'Peugeot', 'MINI',
];

const MODELS = [
  'Myvi', 'Axia', 'Bezza', 'Alza', 'Ativa', 'Saga', 'X50', 'X70', 'Persona',
  'Iriz', 'Exora', 'Vios', 'Yaris', 'Hilux', 'Corolla Cross', 'Camry',
  'Alphard', 'Fortuner', 'City', 'Civic', 'HR-V', 'CR-V', 'Jazz', 'Almera',
  'X-Trail', 'Serena', 'Navara', 'CX-5', 'CX-30', 'Xpander', 'Triton', 'ASX',
  'Swift', 'D-Max', 'Ranger', 'Elantra', 'Kona', 'Tucson', 'Picanto',
  'Sportage', 'Carnival', 'Omoda 5', 'Tiggo 8 Pro', 'Atto 3', 'Dolphin',
  'Model 3', 'Model Y', 'Golf', 'Passat', 'Tiguan',
];

const STATES = [
  ['kuala lumpur|\\bkl\\b', 'Kuala Lumpur', null],
  ['petaling jaya|\\bpj\\b', 'Selangor', 'Petaling Jaya'],
  ['subang jaya|subang', 'Selangor', 'Subang Jaya'],
  ['shah alam', 'Selangor', 'Shah Alam'],
  ['klang(?!\\s+valley)', 'Selangor', 'Klang'],
  ['kajang', 'Selangor', 'Kajang'],
  ['cyberjaya', 'Selangor', 'Cyberjaya'],
  ['selangor', 'Selangor', null],
  ['penang|pulau pinang|george ?town|bayan lepas', 'Penang', null],
  ['johor bahru|\\bjb\\b', 'Johor', 'Johor Bahru'],
  ['skudai', 'Johor', 'Skudai'],
  ['johor', 'Johor', null],
  ['ipoh', 'Perak', 'Ipoh'],
  ['taiping', 'Perak', 'Taiping'],
  ['perak', 'Perak', null],
  ['melaka|malacca', 'Melaka', null],
  ['seremban|negeri sembilan', 'Negeri Sembilan', null],
  ['kuantan|bentong|pahang', 'Pahang', null],
  ['terengganu', 'Terengganu', null],
  ['kota bharu|kelantan', 'Kelantan', null],
  ['alor setar|kedah', 'Kedah', null],
  ['kangar|perlis', 'Perlis', null],
  ['kota kinabalu|\\bkk\\b|sandakan|sabah', 'Sabah', null],
  ['kuching|miri|sarawak', 'Sarawak', null],
  ['putrajaya', 'Putrajaya', null],
  ['labuan', 'Labuan', null],
];

/** Parse "50k", "50 ribu", "50,000", "1.2 juta" → RM number. */
function toRM(raw) {
  const s = String(raw).toLowerCase().replace(/,/g, '');
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  if (/juta|million|mil\b/.test(s)) return n * 1000000;
  if (/k\b|ribu/.test(s) || n < 1000) return n * 1000;
  return n;
}

function parseFallback(userMessage) {
  const msg = userMessage.toLowerCase();
  const filters = {
    brand: null, model: null, priceMin: null, priceMax: null,
    yearMin: null, yearMax: null, mileageMax: null, transmission: null,
    fuelType: null, bodyType: null, minSeats: null, state: null, city: null, sortBy: null,
  };
  const sellDetails = { brand: null, model: null, variant: null, year: null, mileageKm: null, condition: null };

  // --- Intent: sell ---
  const isSell = /\b(sell|selling|jual|trade[- ]?in|what('| i)?s my car worth|how much can i get)\b/.test(msg);

  // --- Brand & model ---
  for (const b of BRANDS) {
    const alias = b === 'Mercedes-Benz' ? 'mercedes|merc\\b|benz' : b === 'Volkswagen' ? 'volkswagen|\\bvw\\b' : b.toLowerCase();
    if (new RegExp(`\\b(${alias})`, 'i').test(msg)) { filters.brand = b; break; }
  }
  for (const m of MODELS) {
    if (new RegExp(`\\b${m.toLowerCase().replace(/[-\s]/g, '[-\\s]?')}\\b`, 'i').test(msg)) { filters.model = m; break; }
  }

  // --- Body type ---
  if (/suv|crossover/.test(msg)) filters.bodyType = 'SUV';
  else if (/mpv|7[- ]?seater|family van|minivan/.test(msg)) filters.bodyType = 'MPV';
  else if (/pickup|pick[- ]up|truck|4x4/.test(msg)) filters.bodyType = 'Pickup';
  else if (/sedan|saloon/.test(msg)) filters.bodyType = 'Sedan';
  else if (/hatchback|hatch\b/.test(msg)) filters.bodyType = 'Hatchback';
  if (/7[- ]?seater|seven seater/.test(msg)) filters.minSeats = 7;

  // --- Fuel / transmission ---
  if (/\bev\b|electric/.test(msg)) filters.fuelType = 'EV';
  else if (/hybrid/.test(msg)) filters.fuelType = 'Hybrid';
  else if (/diesel/.test(msg)) filters.fuelType = 'Diesel';
  else if (/petrol/.test(msg)) filters.fuelType = 'Petrol';
  if (/\bauto(matic)?\b/.test(msg)) filters.transmission = 'Automatic';
  else if (/\bmanual\b/.test(msg)) filters.transmission = 'Manual';

  // --- Location ---
  for (const [pattern, state, city] of STATES) {
    if (new RegExp(pattern, 'i').test(msg)) { filters.state = state; filters.city = city; break; }
  }

  // --- Year ---
  const yearRange = msg.match(/(20[0-2]\d)\s*(?:-|to|until)\s*(20[0-2]\d)/);
  const yearMinM = msg.match(/(?:from|after|newer than|atleast|at least)\s*(20[0-2]\d)/);
  const bareYear = msg.match(/\b(20[12]\d)\b/);
  if (yearRange) { filters.yearMin = parseInt(yearRange[1]); filters.yearMax = parseInt(yearRange[2]); }
  else if (yearMinM) filters.yearMin = parseInt(yearMinM[1]);
  else if (bareYear && isSell) sellDetails.year = parseInt(bareYear[1]);
  else if (bareYear) filters.yearMin = parseInt(bareYear[1]);

  // --- Mileage ---
  const mileageM = msg.match(/(?:under|below|less than|max)\s*(\d+(?:[.,]\d+)?)\s*k?\s*(?:km|kilometer|mileage)/);
  if (mileageM) filters.mileageMax = toRM(mileageM[1]);
  else if (/low mileage/.test(msg)) filters.mileageMax = 60000;
  const sellMileage = msg.match(/(\d+(?:[.,]\d+)?)\s*k?\s*km/);
  if (isSell && sellMileage) sellDetails.mileageKm = toRM(sellMileage[1]);

  // --- Price ---
  let isBareBudget = false;
  const rangeM = msg.match(/rm?\s*(\d+(?:[.,]\d+)?\s*k?)\s*(?:-|–|to)\s*rm?\s*(\d+(?:[.,]\d+)?\s*k?)/);
  // "rm" optional here — the under/over keyword already disambiguates a price
  const underM = msg.match(/(?:under|below|bawah|less than|max)\s*(?:rm)?\s*(\d+(?:[.,]\d+)?\s*(?:k|ribu|juta|million)?)/);
  const aboveM = msg.match(/(?:above|over|more than|at least)\s*(?:rm)?\s*(\d+(?:[.,]\d+)?\s*(?:k|ribu|juta|million)?)/);
  const bareM = msg.match(/(?:budget|bajet).{0,12}?rm?\s*(\d+(?:[.,]\d+)?\s*(?:k|ribu|juta|million)?)/)
    || msg.match(/\brm\s*(\d+(?:[.,]\d+)?\s*(?:k|ribu|juta|million)?)/);

  if (rangeM) { filters.priceMin = toRM(rangeM[1]); filters.priceMax = toRM(rangeM[2]); }
  else if (underM) filters.priceMax = toRM(underM[1]);
  else if (aboveM) filters.priceMin = toRM(aboveM[1]);
  else if (bareM && !isSell) {
    const v = toRM(bareM[1]);
    if (v) { filters.priceMin = Math.round(v * 0.6); filters.priceMax = v; filters.sortBy = 'price_desc'; isBareBudget = true; }
  }

  // --- Sort ---
  if (/cheap|lowest|murah/.test(msg)) filters.sortBy = 'price_asc';
  else if (/best deal/.test(msg)) filters.sortBy = 'dealscore';
  else if (/newest|latest/.test(msg)) filters.sortBy = 'newest';

  // --- Sell details reuse buy extraction ---
  if (isSell) {
    sellDetails.brand = filters.brand;
    sellDetails.model = filters.model;
  }

  const wantsAll = /\b(show all|anything|any car|no preference|apa[- ]apa)\b/.test(msg);
  const buyEnough = wantsAll || isBareBudget
    || [filters.brand, filters.priceMax, filters.bodyType, filters.state].filter(Boolean).length >= 2;
  const sellEnough = Boolean(sellDetails.brand && sellDetails.model && sellDetails.year);

  let nextQuestion = null;
  let suggestedOptions = [];
  if (isSell && !sellEnough) {
    nextQuestion = 'To estimate a fair price, tell me the brand, model, year and rough mileage — e.g. "2019 Perodua Myvi, 60,000 km".';
    suggestedOptions = [];
  } else if (!isSell && !buyEnough) {
    if (!filters.priceMax) {
      nextQuestion = 'What budget should I work with?';
      suggestedOptions = ['Under RM 30K', 'RM 30K - 60K', 'RM 60K - 100K', 'Above RM 100K'];
    } else {
      nextQuestion = 'Any preferred body type or brand?';
      suggestedOptions = ['SUV', 'Sedan', 'Hatchback', 'Show all types'];
    }
  }

  return {
    intent: isSell ? 'sell' : 'buy',
    hasEnoughInfo: isSell ? sellEnough : buyEnough,
    filters,
    sellDetails,
    detailQuery: null,
    compareQueries: [],
    nextQuestion,
    suggestedOptions,
    searchSummary: null,
    isFallback: true,
  };
}

module.exports = { parseFallback };
