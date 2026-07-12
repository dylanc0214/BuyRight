const express = require('express');
const router = express.Router();

const pool = require('../services/db');
const { searchCars, getCarById } = require('../services/carSearchService');
const { formatCarCard, formatCarCards } = require('../services/carFormatter');

// GET /api/cars — paginated list, optional simple filters
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const filters = {
      brand: req.query.brand || null,
      bodyType: req.query.bodyType || null,
      state: req.query.state || null,
      priceMax: req.query.priceMax ? Number(req.query.priceMax) : null,
      sortBy: req.query.sortBy || 'dealscore',
    };
    const rows = await searchCars(filters, limit);
    res.json({ success: true, cars: formatCarCards(rows) });
  } catch (err) {
    console.error('GET /cars error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load cars.' });
  }
});

// GET /api/cars/brands — distinct brands with listing counts
router.get('/brands', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT brand, COUNT(*)::int AS count FROM cars WHERE status = 'available' GROUP BY brand ORDER BY count DESC, brand ASC"
    );
    res.json({ success: true, brands: rows });
  } catch (err) {
    console.error('GET /cars/brands error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load brands.' });
  }
});

// GET /api/cars/:id — single car with seller info
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid car id.' });
    const row = await getCarById(id);
    if (!row) return res.status(404).json({ success: false, error: 'Car not found.' });
    res.json({ success: true, car: formatCarCard(row) });
  } catch (err) {
    console.error('GET /cars/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load car.' });
  }
});

module.exports = router;
