require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pool = require('./services/db');
const chatRouter = require('./routes/chat');
const carsRouter = require('./routes/cars');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/chat', chatRouter);
app.use('/api/cars', carsRouter);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ success: false, status: 'error', db: 'disconnected' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`KeretaAI API running on http://localhost:${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
