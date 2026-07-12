const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'buyright_dev_secret_change_in_prod';

async function register({ name, email, password, phone }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, role)
     VALUES ($1, $2, $3, $4, 'user')
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email, phone, role`,
    [name, email, hash, phone || null]
  );
  if (!rows[0]) throw new Error('email_taken');
  return rows[0];
}

async function login({ email, password }) {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user || !user.password_hash) throw new Error('invalid_credentials');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('invalid_credentials');
  const { password_hash, ...safe } = user;
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: safe };
}

async function getUserById(id) {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone, role FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

module.exports = { register, login, getUserById, JWT_SECRET };
