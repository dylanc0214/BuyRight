const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAuth } = require('../middleware/auth');
const { findComparables } = require('../services/carSearchService');
const { estimatePrice } = require('../services/sellFlowService');

// GET /api/submissions/estimate?brand=X&model=Y&year=Z&mileage_km=N
router.get('/estimate', async (req, res) => {
  const { brand, model, year, mileage_km } = req.query;
  if (!brand || !model || !year) {
    return res.status(400).json({ error: 'brand, model and year are required' });
  }
  try {
    const comparables = await findComparables({ brand, model, year: Number(year) }, 8);
    const estimate = estimatePrice({ brand, model, year: Number(year), mileageKm: mileage_km ? Number(mileage_km) : null }, comparables);
    res.json({ estimate, comparable_count: comparables.length });
  } catch (e) {
    console.error('[sell-estimate]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/submissions
router.post('/', requireAuth, async (req, res) => {
  const { brand, model, variant, year, mileage_km, condition, color, description, photos } = req.body || {};
  if (!brand || !model || !year || !mileage_km || !condition) {
    return res.status(400).json({ error: 'brand, model, year, mileage_km and condition are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO car_submissions
         (user_id, brand, model, variant, year, mileage_km, condition, color, description, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.sub, brand, model, variant || null, year, mileage_km, condition,
       color || null, description || null, JSON.stringify(photos || [])]
    );
    res.status(201).json({ submission: rows[0] });
  } catch (e) {
    console.error('[submissions/post]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/submissions/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cs.*,
         (SELECT row_to_json(i) FROM inspections i
          WHERE i.submission_id = cs.id ORDER BY i.created_at DESC LIMIT 1) AS inspection,
         (SELECT row_to_json(o) FROM offers o
          WHERE o.submission_id = cs.id ORDER BY o.created_at DESC LIMIT 1) AS latest_offer
       FROM car_submissions cs
       WHERE cs.user_id = $1
       ORDER BY cs.created_at DESC`,
      [req.user.sub]
    );
    res.json({ submissions: rows });
  } catch (e) {
    console.error('[submissions/mine]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/submissions/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM car_submissions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ submission: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/submissions/:id/inspection
router.post('/:id/inspection', requireAuth, async (req, res) => {
  const { scheduled_at, location, phone } = req.body || {};
  if (!scheduled_at || !location) {
    return res.status(400).json({ error: 'scheduled_at and location are required' });
  }
  try {
    const { rows: sub } = await pool.query(
      "SELECT id FROM car_submissions WHERE id=$1 AND user_id=$2 AND status='submitted'",
      [req.params.id, req.user.sub]
    );
    if (!sub[0]) return res.status(404).json({ error: 'not_found' });

    const { rows } = await pool.query(
      'INSERT INTO inspections (submission_id, scheduled_at, location) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, scheduled_at, location]
    );
    await pool.query(
      "UPDATE car_submissions SET status='inspection_scheduled', updated_at=NOW() WHERE id=$1",
      [req.params.id]
    );
    if (phone) {
      await pool.query('UPDATE users SET phone=$1 WHERE id=$2', [phone, req.user.sub]);
    }
    res.status(201).json({ inspection: rows[0] });
  } catch (e) {
    console.error('[submissions/inspection]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
