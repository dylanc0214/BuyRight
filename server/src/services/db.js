// Shared Postgres connection pool for all services.
// pg reads the standard PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD
// variables from the environment (loaded from .env — see .env.example).
const { Pool } = require('pg');

const pool = new Pool();

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err.message);
});

module.exports = pool;
