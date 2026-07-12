/**
 * sellFlowService.js — KeretaAI's seller mode (improvement over BidNow).
 * Estimates a fair asking price from comparable live listings.
 */

/**
 * @param {Object} sellDetails - { brand, model, year, mileageKm }
 * @param {Array} comparables - raw car rows (same brand/model, year ±2)
 * @returns {{ suggested, low, high, sampleSize } | null}
 */
function estimatePrice(sellDetails, comparables) {
  if (!comparables || comparables.length === 0) return null;

  const prices = comparables.map((c) => parseFloat(c.price)).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];

  // Adjust for mileage vs the comparable average: ±2% per 10,000 km, capped ±10%.
  let adjusted = median;
  if (sellDetails.mileageKm) {
    const avgMileage = comparables.reduce((s, c) => s + Number(c.mileage_km), 0) / comparables.length;
    const diffUnits = (sellDetails.mileageKm - avgMileage) / 10000;
    const factor = Math.max(-0.10, Math.min(0.10, -0.02 * diffUnits));
    adjusted = median * (1 + factor);
  }

  const suggested = Math.round(adjusted / 500) * 500;
  return {
    suggested,
    low: Math.round((suggested * 0.95) / 500) * 500,
    high: Math.round((suggested * 1.05) / 500) * 500,
    sampleSize: comparables.length,
  };
}

/** Offline/template fallback when DeepSeek can't write the narrative. */
function buildSellMessage(sellDetails, estimate) {
  const carName = [sellDetails.year, sellDetails.brand, sellDetails.model].filter(Boolean).join(' ');
  if (!estimate) {
    return `I couldn't find comparable listings for your ${carName} in our database, so I can't compute a data-backed price. As a rule of thumb, check recent listings for the same model and year, and price within 5% of the median. Clean service records and a Puspakom inspection report will help you sell faster.`;
  }
  return [
    `Based on ${estimate.sampleSize} comparable listing${estimate.sampleSize > 1 ? 's' : ''}, a fair asking price for your ${carName} is around **RM ${estimate.suggested.toLocaleString()}** (range RM ${estimate.low.toLocaleString()} – RM ${estimate.high.toLocaleString()}).`,
    '',
    'Tips to sell faster: keep your full service records ready, complete the Puspakom B5 inspection early, and take clear photos in daylight.',
    '',
    `**Listing draft:** ${carName}${sellDetails.mileageKm ? `, ${Number(sellDetails.mileageKm).toLocaleString()} km` : ''} — well maintained, serious buyers only. Asking RM ${estimate.suggested.toLocaleString()}, slightly negotiable.`,
  ].join('\n');
}

module.exports = { estimatePrice, buildSellMessage };
