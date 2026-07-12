const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res) => {
  const { car_id, message } = req.body || {};
  if (!car_id) return res.status(400).json({ error: 'car_id required' });
  try {
    const userRow = await pool.query('SELECT name, phone FROM users WHERE id=$1', [req.user.sub]);
    const u = userRow.rows[0] || {};
    const { rows } = await pool.query(
      'INSERT INTO enquiries (user_id, car_id, name, phone, message) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.sub, car_id, u.name, u.phone, message || null]
    );
    res.status(201).json({ enquiry: rows[0] });
  } catch (e) {
    console.error('[enquiries]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, c.title AS car_title, c.price AS car_price
       FROM enquiries e LEFT JOIN cars c ON c.id = e.car_id
       WHERE e.user_id=$1 ORDER BY e.created_at DESC`,
      [req.user.sub]
    );
    res.json({ enquiries: rows });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
