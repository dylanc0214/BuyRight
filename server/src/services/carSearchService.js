/**
 * carSearchService.js — parameterized SQL search over the cars table,
 * with progressive filter relaxation so a search never dead-ends at zero.
 */
const pool = require('./db');

const SELLER_JOIN = `
  SELECT c.*,
         s.name  AS seller_name,
         s.phone AS seller_phone,
         s.seller_type,
         s.dealership_name,
         s.city  AS seller_city,
         s.state AS seller_state,
         s.rating AS seller_rating,
         s.verified AS seller_verified,
         s.photo_url AS seller_photo_url
  FROM cars c
  LEFT JOIN sellers s ON s.id = c.seller_id
`;

const SORT_SQL = {
  price_asc: 'c.price ASC',
  price_desc: 'c.price DESC',
  newest: 'c.year DESC, c.mileage_km ASC',
  mileage_asc: 'c.mileage_km ASC',
  dealscore: 'c.dealscore DESC',
};

/**
 * Build WHERE clauses + params from a filter object.
 * Brand/model/state/city use ILIKE so AI free-form values still match.
 */
function buildWhere(filters) {
  const clauses = ["c.status = 'available'"];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  };

  if (filters.brand) add('c.brand ILIKE ?', `%${filters.brand}%`);
  if (filters.model) add('c.model ILIKE ?', `%${filters.model}%`);
  if (filters.priceMin) add('c.price >= ?', filters.priceMin);
  if (filters.priceMax) add('c.price <= ?', filters.priceMax);
  if (filters.yearMin) add('c.year >= ?', filters.yearMin);
  if (filters.yearMax) add('c.year <= ?', filters.yearMax);
  if (filters.mileageMax) add('c.mileage_km <= ?', filters.mileageMax);
  // Enum columns do exact matches — only pass through known-good values so an
  // AI-invented value ("No preference") can't silently zero out every result.
  if (['Automatic', 'Manual'].includes(filters.transmission)) add('c.transmission = ?', filters.transmission);
  if (['Petrol', 'Diesel', 'Hybrid', 'EV'].includes(filters.fuelType)) add('c.fuel_type = ?', filters.fuelType);
  if (['Hatchback', 'Sedan', 'SUV', 'MPV', 'Pickup', 'Coupe', 'Wagon'].includes(filters.bodyType)) add('c.body_type = ?', filters.bodyType);
  if (filters.minSeats) add('c.seats >= ?', filters.minSeats);
  if (filters.state) add('c.state ILIKE ?', `%${filters.state}%`);
  if (filters.city) add('c.city ILIKE ?', `%${filters.city}%`);

  return { where: clauses.join(' AND '), params };
}

async function searchCars(filters = {}, limit = 6) {
  const { where, params } = buildWhere(filters);
  const orderBy = SORT_SQL[filters.sortBy] || SORT_SQL.dealscore;
  params.push(limit);
  const sql = `${SELLER_JOIN} WHERE ${where} ORDER BY ${orderBy} LIMIT $${params.length}`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function countCars(filters = {}) {
  const { where, params } = buildWhere(filters);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM cars c WHERE ${where}`, params);
  return rows[0].n;
}

// ponytail: fixed priority order, first-match-wins — cheap relaxations first,
// budget bumps once at the end and never compounds. Upgrade to scored ranking
// only if demo users complain the first relaxed match feels off.
const BUDGET_RELAX_FACTOR = 1.15;

function buildRelaxationSteps(working) {
  return [
    {
      applies: () => working.city,
      apply: () => {
        const city = working.city;
        working.city = null;
        return working.state
          ? `no match in ${city}, widened to the rest of ${working.state}`
          : `no match in ${city}, widened the area`;
      },
    },
    {
      applies: () => working.transmission,
      apply: () => { const t = working.transmission; working.transmission = null; return `included both transmissions, not just ${t.toLowerCase()}`; },
    },
    {
      applies: () => working.fuelType,
      apply: () => { const f = working.fuelType; working.fuelType = null; return `included all fuel types, not just ${f}`; },
    },
    {
      applies: () => working.mileageMax,
      apply: () => { working.mileageMax = null; return 'dropped the mileage cap'; },
    },
    {
      applies: () => working.yearMin,
      apply: () => {
        const old = working.yearMin;
        working.yearMin = old - 2;
        return `included cars from ${working.yearMin} (was ${old})`;
      },
    },
    {
      applies: () => working.bodyType,
      apply: () => { const b = working.bodyType; working.bodyType = null; return `included other body types too, not just ${b}`; },
    },
    {
      applies: () => working.state,
      apply: () => { const s = working.state; working.state = null; return `searched nationwide instead of only ${s}`; },
    },
    {
      applies: () => working.priceMax,
      apply: () => {
        const oldMax = working.priceMax;
        working.priceMax = Math.round(oldMax * BUDGET_RELAX_FACTOR);
        return `stretched the budget slightly to RM${working.priceMax.toLocaleString()} (from RM${oldMax.toLocaleString()})`;
      },
    },
  ];
}

/**
 * searchCars, but progressively relaxes one filter at a time on zero results.
 * @returns {{rows, filters, relaxedNotes}}
 */
async function searchCarsRelaxed(filters = {}, limit = 6) {
  let rows = await searchCars(filters, limit);
  if (rows.length > 0) return { rows, filters, relaxedNotes: [] };

  const working = { ...filters };
  const notes = [];
  for (const step of buildRelaxationSteps(working)) {
    if (!step.applies()) continue;
    notes.push(step.apply());
    rows = await searchCars(working, limit);
    if (rows.length > 0) return { rows, filters: { ...working }, relaxedNotes: notes };
  }
  return { rows: [], filters: { ...working }, relaxedNotes: [] };
}

/** Free-text match against brand/model/variant/title — "tell me more about the Civic RS". */
async function searchCarsByText(text, limit = 5) {
  const cleaned = String(text || '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const terms = cleaned.split(' ').slice(0, 6);
  const clauses = [];
  const params = [];
  terms.forEach((t) => {
    params.push(`%${t}%`);
    clauses.push(`(c.title ILIKE $${params.length} OR c.brand ILIKE $${params.length} OR c.model ILIKE $${params.length} OR COALESCE(c.variant,'') ILIKE $${params.length})`);
  });
  params.push(limit);
  const sql = `${SELLER_JOIN} WHERE c.status = 'available' AND ${clauses.join(' AND ')} ORDER BY c.dealscore DESC LIMIT $${params.length}`;
  const { rows } = await pool.query(sql, params);
  if (rows.length > 0) return rows;

  // AND was too strict — fall back to matching any term.
  const orParams = terms.map((t) => `%${t}%`);
  orParams.push(limit);
  const orSql = `${SELLER_JOIN} WHERE c.status = 'available' AND (${terms
    .map((_, i) => `c.title ILIKE $${i + 1} OR c.brand ILIKE $${i + 1} OR c.model ILIKE $${i + 1}`)
    .join(' OR ')}) ORDER BY c.dealscore DESC LIMIT $${orParams.length}`;
  const { rows: orRows } = await pool.query(orSql, orParams);
  return orRows;
}

async function getCarById(id) {
  const { rows } = await pool.query(`${SELLER_JOIN} WHERE c.id = $1`, [id]);
  return rows[0] || null;
}

/** Comparable listings for the sell flow: same brand+model, year ±2. */
async function findComparables({ brand, model, year }, limit = 8) {
  const params = [`%${brand}%`, `%${model}%`];
  let sql = `${SELLER_JOIN} WHERE c.status = 'available' AND c.brand ILIKE $1 AND c.model ILIKE $2`;
  if (year) {
    params.push(year - 2, Number(year) + 2);
    sql += ` AND c.year BETWEEN $3 AND $4`;
  }
  params.push(limit);
  sql += ` ORDER BY c.year DESC LIMIT $${params.length}`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

module.exports = {
  searchCars,
  searchCarsRelaxed,
  searchCarsByText,
  getCarById,
  findComparables,
  countCars,
};
