/**
 * carFormatter.js — DB row → frontend car card object.
 * Includes the KeretaAI loan estimate: typical Malaysian used-car hire
 * purchase terms (10% down payment, 3.5% flat interest, 9-year tenure).
 */

const LOAN_DOWN_PAYMENT = 0.10;
const LOAN_FLAT_RATE = 0.035;
const LOAN_YEARS = 9;

function formatRM(value) {
  if (value == null) return '—';
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '—';
  if (n >= 1000000) return `RM ${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `RM ${Math.round(n).toLocaleString('en-MY')}`;
  return `RM ${n.toFixed(0)}`;
}

/** Monthly installment under Malaysian flat-rate hire purchase. */
function monthlyInstallment(price) {
  const principal = price * (1 - LOAN_DOWN_PAYMENT);
  const totalInterest = principal * LOAN_FLAT_RATE * LOAN_YEARS;
  return Math.round((principal + totalInterest) / (LOAN_YEARS * 12));
}

function formatCarCard(row) {
  const price = parseFloat(row.price);
  const monthly = monthlyInstallment(price);
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    model: row.model,
    variant: row.variant || null,
    year: row.year,
    price,
    priceFormatted: formatRM(price),
    marketValueMin: parseFloat(row.market_value_min),
    marketValueMax: parseFloat(row.market_value_max),
    marketValueFormatted: `${formatRM(row.market_value_min)} – ${formatRM(row.market_value_max)}`,
    belowMarket: price < parseFloat(row.market_value_min),
    mileageKm: row.mileage_km,
    mileageFormatted: `${Number(row.mileage_km).toLocaleString('en-MY')} km`,
    transmission: row.transmission,
    fuelType: row.fuel_type,
    bodyType: row.body_type,
    color: row.color || null,
    engineCc: row.engine_cc || null,
    seats: row.seats,
    dealscore: row.dealscore,
    aiSummary: row.ai_summary,
    city: row.city,
    state: row.state,
    imageUrl: row.image_url || null,
    status: row.status,
    monthlyEstimate: monthly,
    monthlyEstimateFormatted: `RM ${monthly.toLocaleString('en-MY')}/mo`,
    seller: row.seller_name
      ? {
          id: row.seller_id,
          name: row.seller_name,
          phone: row.seller_phone || null,
          type: row.seller_type || null,
          dealershipName: row.dealership_name || null,
          city: row.seller_city || null,
          state: row.seller_state || null,
          rating: row.seller_rating != null ? parseFloat(row.seller_rating) : null,
          verified: Boolean(row.seller_verified),
          photoUrl: row.seller_photo_url || null,
        }
      : null,
  };
}

function formatCarCards(rows) {
  return rows.map(formatCarCard);
}

module.exports = { formatCarCard, formatCarCards, formatRM, monthlyInstallment };
