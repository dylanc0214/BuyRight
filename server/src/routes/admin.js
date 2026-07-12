const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAdmin } = require('../middleware/auth');
const { formatCarCard, formatCarCards } = require('../services/carFormatter');
const { searchCars } = require('../services/carSearchService');

router.use(requireAdmin);

router.get('/overview', async (req, res) => {
  try {
    const [subCount, invCount, buyerCount, pendingOffers] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS n FROM car_submissions WHERE status NOT IN ('withdrawn')"),
      pool.query("SELECT COUNT(*)::int AS n FROM cars WHERE status='available'"),
      pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role='user'"),
      pool.query("SELECT COUNT(*)::int AS n FROM offers WHERE status='pending'"),
    ]);
    res.json({
      submissions: subCount.rows[0].n,
      inventory: invCount.rows[0].n,
      buyers: buyerCount.rows[0].n,
      pending_offers: pendingOffers.rows[0].n,
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/submissions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT cs.*, u.name AS seller_name, u.phone AS seller_phone, u.email AS seller_email,
         (SELECT row_to_json(i) FROM inspections i WHERE i.submission_id=cs.id ORDER BY i.created_at DESC LIMIT 1) AS inspection,
         (SELECT row_to_json(o) FROM offers o WHERE o.submission_id=cs.id ORDER BY o.created_at DESC LIMIT 1) AS latest_offer
       FROM car_submissions cs LEFT JOIN users u ON u.id=cs.user_id
       ORDER BY cs.created_at DESC`
    );
    res.json({ submissions: rows });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.patch('/submissions/:id', async (req, res) => {
  const { status, notes } = req.body || {};
  const allowed = ['submitted','inspection_scheduled','under_review','offer_sent','accepted','rejected','withdrawn'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  try {
    const sets = [];
    const vals = [];
    if (status) { vals.push(status); sets.push(`status=$${vals.length}::submission_status`); }
    if (notes !== undefined) { vals.push(notes); sets.push(`description=$${vals.length}`); }
    sets.push('updated_at=NOW()');
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE car_submissions SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ submission: rows[0] });
  } catch (e) {
    console.error('[admin/submissions patch]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/inspections', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, cs.brand, cs.model, cs.year,
         u.name AS seller_name, u.phone AS seller_phone
       FROM inspections i
       JOIN car_submissions cs ON cs.id=i.submission_id
       LEFT JOIN users u ON u.id=cs.user_id
       ORDER BY i.scheduled_at ASC`
    );
    res.json({ inspections: rows });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.patch('/inspections/:id', async (req, res) => {
  const { notes, completed } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE inspections SET
         notes=COALESCE($1, notes),
         completed=COALESCE($2, completed)
       WHERE id=$3 RETURNING *`,
      [notes ?? null, completed ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ inspection: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/offers', async (req, res) => {
  const { submission_id, offer_price, notes, expires_at } = req.body || {};
  if (!submission_id || !offer_price) {
    return res.status(400).json({ error: 'submission_id and offer_price required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO offers (submission_id, offer_price, notes, expires_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [submission_id, offer_price, notes || null, expires_at || null]
    );
    await pool.query(
      "UPDATE car_submissions SET status='offer_sent', updated_at=NOW() WHERE id=$1",
      [submission_id]
    );
    res.status(201).json({ offer: rows[0] });
  } catch (e) {
    console.error('[admin/offers]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/buyers', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*, COUNT(e.id)::int AS enquiry_count
       FROM users u LEFT JOIN enquiries e ON e.user_id=u.id
       WHERE u.role='user'
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.json({ buyers: rows });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/enquiries', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, c.title AS car_title FROM enquiries e
       LEFT JOIN cars c ON c.id=e.car_id
       ORDER BY e.created_at DESC`
    );
    res.json({ enquiries: rows });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.patch('/enquiries/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!['new','replied'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  try {
    const { rows } = await pool.query(
      'UPDATE enquiries SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json({ enquiry: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/cars', async (req, res) => {
  try {
    const rows = await searchCars({}, 100);
    res.json({ cars: formatCarCards(rows) });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/cars', async (req, res) => {
  const { title, brand, model, variant, year, price, market_value_min, market_value_max,
          mileage_km, transmission, fuel_type, body_type, color, engine_cc, seats,
          dealscore, ai_summary, city, state, image_url } = req.body || {};
  if (!title || !brand || !model || !year || !price || !mileage_km || !body_type || !city || !state || !dealscore) {
    return res.status(400).json({ error: 'missing required fields' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO cars (title,brand,model,variant,year,price,market_value_min,market_value_max,
         mileage_km,transmission,fuel_type,body_type,color,engine_cc,seats,dealscore,
         ai_summary,city,state,image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [title,brand,model,variant||null,year,price,market_value_min||price,market_value_max||price,
       mileage_km,transmission||'Automatic',fuel_type||'Petrol',body_type,color||null,
       engine_cc||null,seats||5,dealscore,ai_summary||null,city,state,image_url||null]
    );
    res.status(201).json({ car: formatCarCard(rows[0]) });
  } catch (e) {
    console.error('[admin/cars post]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.patch('/cars/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!['available','reserved','sold'].includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE cars SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ car: formatCarCard(rows[0]) });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
