const express = require('express');
const router = express.Router();
const { register, login, getUserById } = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  try {
    const user = await register({ name, email, password, phone });
    res.status(201).json({ user });
  } catch (e) {
    if (e.message === 'email_taken') return res.status(409).json({ error: 'email_taken' });
    console.error('[auth/register]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const result = await login({ email, password });
    res.json(result);
  } catch (e) {
    if (e.message === 'invalid_credentials') {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    console.error('[auth/login]', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user });
});

module.exports = router;
