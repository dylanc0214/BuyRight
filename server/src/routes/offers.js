const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAuth } = require('../middleware/auth');

// PATCH /api/offers/:id/respond
router.patch('/:id/respond', requireAuth, async (req, res) => {
  const { decision } = req.body || {};
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be accepted or rejected' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT o.*, cs.user_id FROM offers o
       JOIN car_submissions cs ON cs.id = o.submission_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    const offer = rows[0];
    if (!offer) return res.status(404).json({ error: 'not_found' });
    if (offer.user_id !== req.user.sub) return res.status(403).json({ error: 'forbidden' });
    if (offer.status !== 'pending') return res.status(409).json({ error: 'already_responded' });

    await pool.query(
      'UPDATE offers SET status=$1, responded_at=NOW() WHERE id=$2',
      [decision, req.params.id]
    );
    await pool.query(
      'UPDATE car_submissions SET status=$1, updated_at=NOW() WHERE id=$2',
      [decision, offer.submission_id]
    );
    res.json({ ok: true, decision });
  } catch (e) {
    console.error('[offers/respond]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
