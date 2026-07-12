const { searchCarsRelaxed, getCarById, findComparables } = require('./carSearchService');
const { formatCarCard, formatCarCards } = require('./carFormatter');
const { estimatePrice } = require('./sellFlowService');

// ponytail: BuyRight buys at ~80% of market; estimate reflects C2B offer, not resale price
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_cars',
      description: "Search BuyRight's live inventory. Call when the buyer has given budget OR location.",
      parameters: {
        type: 'object',
        properties: {
          brand:      { type: 'string',  description: 'Car brand, e.g. Toyota, Honda, Perodua' },
          model:      { type: 'string',  description: 'Car model, e.g. Vios, Civic, Myvi' },
          priceMin:   { type: 'number',  description: 'Minimum price in MYR' },
          priceMax:   { type: 'number',  description: 'Maximum price in MYR' },
          yearMin:    { type: 'integer', description: 'Minimum manufacture year' },
          yearMax:    { type: 'integer', description: 'Maximum manufacture year' },
          mileageMax: { type: 'integer', description: 'Maximum mileage in km' },
          state:      { type: 'string',  description: 'Malaysian state, e.g. Selangor, KL' },
          bodyType:   { type: 'string',  description: 'Body type: Sedan, SUV, Hatchback, MPV, Pickup, Coupe, Wagon' },
          limit:      { type: 'integer', description: 'Max results (default 3, max 6)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_car_detail',
      description: 'Get full details for a specific car by ID already shown in the conversation.',
      parameters: {
        type: 'object',
        properties: {
          car_id: { type: 'integer', description: 'Car ID from previous search results' }
        },
        required: ['car_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compare_cars',
      description: 'Compare two specific cars side by side. Requires both IDs from previous results.',
      parameters: {
        type: 'object',
        properties: {
          car_id_1: { type: 'integer', description: 'First car ID' },
          car_id_2: { type: 'integer', description: 'Second car ID' }
        },
        required: ['car_id_1', 'car_id_2']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_sell_estimate',
      description: "Estimate how much BuyRight might offer for a seller's car based on comparable inventory.",
      parameters: {
        type: 'object',
        properties: {
          brand:      { type: 'string',  description: 'Car brand' },
          model:      { type: 'string',  description: 'Car model' },
          year:       { type: 'integer', description: 'Manufacture year' },
          mileage_km: { type: 'integer', description: 'Current mileage in km (optional)' }
        },
        required: ['brand', 'model', 'year']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'start_sell_flow',
      description: 'Return a deep-link URL to begin the sell submission form, pre-filled with car details.',
      parameters: {
        type: 'object',
        properties: {
          brand: { type: 'string' },
          model: { type: 'string' },
          year:  { type: 'integer' }
        }
      }
    }
  }
];

async function executeTool(name, args) {
  switch (name) {
    case 'search_cars': {
      const { brand, model, priceMin, priceMax, yearMin, yearMax, mileageMax, state, bodyType, limit = 3 } = args;
      const filters = { brand, model, priceMin, priceMax, yearMin, yearMax, mileageMax, state, bodyType };
      const { rows, relaxedNotes } = await searchCarsRelaxed(filters, Math.min(limit, 6));
      return { cars: formatCarCards(rows), totalResults: rows.length, relaxedNotes };
    }

    case 'get_car_detail': {
      const car = await getCarById(args.car_id);
      if (!car) return { error: 'car_not_found' };
      return { car: formatCarCard(car) };
    }

    case 'compare_cars': {
      const [c1, c2] = await Promise.all([getCarById(args.car_id_1), getCarById(args.car_id_2)]);
      if (!c1 || !c2) return { error: 'one_or_both_cars_not_found' };
      return { cars: [formatCarCard(c1), formatCarCard(c2)] };
    }

    case 'get_sell_estimate': {
      const { brand, model, year, mileage_km } = args;
      const comparables = await findComparables({ brand, model, year }, 8);
      if (!comparables.length) {
        return { estimate: null, message: 'No comparable cars found in current BuyRight inventory.' };
      }
      const marketEstimate = estimatePrice({ brand, model, year, mileageKm: mileage_km }, comparables);
      if (!marketEstimate) return { estimate: null, message: 'Could not compute estimate.' };
      // BuyRight buys at ~78-85% of market median (C2B model)
      const offerLow  = Math.round((marketEstimate.low  * 0.78) / 500) * 500;
      const offerHigh = Math.round((marketEstimate.high * 0.85) / 500) * 500;
      return {
        estimate: { low: offerLow, high: offerHigh, comparable_count: marketEstimate.sampleSize },
        market_median: marketEstimate.suggested,
      };
    }

    case 'start_sell_flow': {
      const params = new URLSearchParams();
      if (args.brand) params.set('brand', args.brand);
      if (args.model) params.set('model', args.model);
      if (args.year)  params.set('year',  String(args.year));
      return { url: `/sell?${params.toString()}` };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool };
