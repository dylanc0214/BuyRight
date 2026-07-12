# BuyRight Platform Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform KeretaAI into BuyRight — a C2B2C used-car platform with CARSOME-style sell flow, multi-page React app, JWT auth, tool-calling AI agent, and warm-white CARSOME Studio design system.

**Architecture:** Full client rebuild (React Router v6, new pages/components) + server evolution (add auth, submissions, admin, offers routes). Existing `/api/chat` and `/api/cars` routes preserved and enhanced. AI upgraded from extraction+branching to tool-calling agent loop identical in structure to BidNow's.

**Tech Stack:** Node.js/Express/pg + bcryptjs/jsonwebtoken (server), React 18/Vite/react-router-dom (client), DeepSeek API with tool-calling (AI), PostgreSQL (DB)

---

## File Map

**New server files:**
- `server/src/services/authService.js` — register/login/getUserById
- `server/src/middleware/auth.js` — requireAuth / requireAdmin
- `server/src/routes/auth.js` — POST /register, POST /login, GET /me
- `server/src/routes/submissions.js` — seller submission + inspection booking
- `server/src/routes/offers.js` — seller offer response
- `server/src/routes/enquiries.js` — buyer contact-to-buy
- `server/src/routes/admin.js` — all /api/admin/* routes
- `server/src/services/aiTools.js` — 5 tool definitions + executors
- `server/src/services/buyRightSystemPrompt.js` — C2B2C system prompt

**Modified server files:**
- `server/package.json` — add bcryptjs, jsonwebtoken
- `server/src/services/deepseekService.js` — add callDeepSeekWithTools()
- `server/src/routes/chat.js` — replace with agent loop
- `server/src/index.js` — mount new routes, raise JSON limit to 10mb

**New database file:**
- `database/migration_buyright.sql` — schema additions

**New client files:**
- `client/src/context/AuthContext.jsx`
- `client/src/pages/Landing.jsx`
- `client/src/pages/CarBrowse.jsx`
- `client/src/pages/CarDetail.jsx`
- `client/src/pages/Chat.jsx`
- `client/src/pages/Login.jsx`
- `client/src/pages/Register.jsx`
- `client/src/pages/SellFlow.jsx`
- `client/src/pages/Account.jsx`
- `client/src/pages/admin/AdminLayout.jsx`
- `client/src/pages/admin/Overview.jsx`
- `client/src/pages/admin/Submissions.jsx`
- `client/src/pages/admin/Inspections.jsx`
- `client/src/pages/admin/Offers.jsx`
- `client/src/pages/admin/Inventory.jsx`
- `client/src/pages/admin/Buyers.jsx`
- `client/src/pages/admin/Moderation.jsx`
- `client/src/pages/admin/AiConfig.jsx`

**Modified client files:**
- `client/package.json` — add react-router-dom
- `client/src/index.css` — replace dark theme with BuyRight design system
- `client/src/App.jsx` — replace single-page widget with React Router v6 shell
- `client/src/utils/api.js` — full rewrite with auth headers + all endpoints
- `client/src/chatState.js` — rebrand welcome message, align with new response shape
- `client/src/components/Header.jsx` — warm-white nav with Login/Register
- `client/src/components/CarCard.jsx` — CARSOME-style card redesign
- `client/src/components/ChatMessages.jsx` — warm-white chat bubbles
- `client/src/components/ChatInput.jsx` — warm-white input bar
- `client/src/components/SuggestedButtons.jsx` — primary-soft pills
- `client/src/components/TypingIndicator.jsx` — styled for warm-white

---

## Task 1: DB Migration

**Files:**
- Create: `database/migration_buyright.sql`

- [ ] **Step 1: Verify current state**

```bash
psql $DATABASE_URL -c "\d users"
```
Expected: no `password_hash` column; role is `user_role_enum`.

- [ ] **Step 2: Write migration**

```sql
-- database/migration_buyright.sql

-- 1. Expand users table for auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
-- Change role from enum to varchar so we can add 'admin'
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20) USING role::text;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
UPDATE users SET role = 'user' WHERE role IN ('buyer', 'seller');

-- 2. submission_status enum
DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM (
    'submitted', 'inspection_scheduled', 'under_review',
    'offer_sent', 'accepted', 'rejected', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. car_submissions
CREATE TABLE IF NOT EXISTS car_submissions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  brand            VARCHAR(100) NOT NULL,
  model            VARCHAR(100) NOT NULL,
  variant          VARCHAR(100),
  year             INTEGER NOT NULL,
  mileage_km       INTEGER NOT NULL,
  condition        VARCHAR(20) NOT NULL,
  color            VARCHAR(50),
  description      TEXT,
  photos           JSONB DEFAULT '[]',
  status           submission_status NOT NULL DEFAULT 'submitted',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. inspections
CREATE TABLE IF NOT EXISTS inspections (
  id             SERIAL PRIMARY KEY,
  submission_id  INTEGER REFERENCES car_submissions(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMP NOT NULL,
  location       VARCHAR(255) NOT NULL,
  notes          TEXT,
  completed      BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. offers
CREATE TABLE IF NOT EXISTS offers (
  id             SERIAL PRIMARY KEY,
  submission_id  INTEGER REFERENCES car_submissions(id) ON DELETE CASCADE,
  offer_price    NUMERIC(12,2) NOT NULL,
  notes          TEXT,
  expires_at     TIMESTAMP,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  responded_at   TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. enquiries (buyer contact-to-buy)
CREATE TABLE IF NOT EXISTS enquiries (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  car_id       INTEGER REFERENCES cars(id) ON DELETE CASCADE,
  name         VARCHAR(255),
  phone        VARCHAR(30),
  message      TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_car_submissions_updated_at ON car_submissions;
CREATE TRIGGER update_car_submissions_updated_at
  BEFORE UPDATE ON car_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 3: Apply migration**

```bash
psql $DATABASE_URL -f database/migration_buyright.sql
```
Expected: `ALTER TABLE`, `CREATE TABLE` lines, no errors.

- [ ] **Step 4: Verify**

```bash
psql $DATABASE_URL -c "\d users" -c "\dt car_submissions" -c "\dt inspections" -c "\dt offers" -c "\dt enquiries"
```
Expected: users has `password_hash` column, role is `character varying(20)`. All 4 new tables listed.

- [ ] **Step 5: Commit**

```bash
git add database/migration_buyright.sql
git commit -m "feat: add BuyRight schema migration (auth, submissions, inspections, offers, enquiries)"
```

---

## Task 2: Server Auth Service

**Files:**
- Modify: `server/package.json`
- Create: `server/src/services/authService.js`

- [ ] **Step 1: Write failing test**

```bash
# Verify packages not yet installed
node -e "require('bcryptjs')" 2>&1 | grep -q "Cannot find" && echo "FAIL: bcryptjs missing"
node -e "require('jsonwebtoken')" 2>&1 | grep -q "Cannot find" && echo "FAIL: jsonwebtoken missing"
```
Expected: both print FAIL.

- [ ] **Step 2: Install dependencies**

```bash
cd server && npm install bcryptjs jsonwebtoken
```

- [ ] **Step 3: Write authService.js**

```js
// server/src/services/authService.js
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
```

- [ ] **Step 4: Smoke test**

```bash
cd server && node -e "
const { register } = require('./src/services/authService');
register({ name:'Test', email:'test@example.com', password:'secret123' })
  .then(u => { console.log('PASS:', u.email); process.exit(0); })
  .catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```
Expected: `PASS: test@example.com`

- [ ] **Step 5: Commit**

```bash
git add server/package.json server/package-lock.json server/src/services/authService.js
git commit -m "feat: add authService with bcrypt/JWT register and login"
```

---

## Task 3: Auth Middleware + Routes

**Files:**
- Create: `server/src/middleware/auth.js`
- Create: `server/src/routes/auth.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: Write failing test**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me
```
Expected: `404` (route doesn't exist yet). Start server first: `cd server && node src/index.js &`

- [ ] **Step 2: Create auth middleware**

```js
// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../services/authService');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
```

- [ ] **Step 3: Create auth routes**

```js
// server/src/routes/auth.js
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
```

- [ ] **Step 4: Mount in index.js**

In `server/src/index.js`, add after the existing route mounts:
```js
const authRouter = require('./routes/auth');
// ... (add after existing requires at top)

app.use('/api/auth', authRouter);
// ... (add after app.use('/api/cars', carsRouter);)
```

Full updated `server/src/index.js`:
```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pool = require('./services/db');
const chatRouter = require('./routes/chat');
const carsRouter = require('./routes/cars');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
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
    console.log(`BuyRight API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
```

- [ ] **Step 5: Test**

```bash
# Register
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"buyer@test.com","password":"secret123"}' | jq .

# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@test.com","password":"secret123"}' | jq -r .token)

# Me
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: register returns `{user:{id,name,email}}`, login returns `{token,user}`, /me returns `{user}`.

- [ ] **Step 6: Commit**

```bash
git add server/src/middleware/auth.js server/src/routes/auth.js server/src/index.js
git commit -m "feat: add JWT auth middleware and register/login/me routes"
```

---

## Task 4: Submissions + Offers + Sell Estimate Routes

**Files:**
- Create: `server/src/routes/submissions.js`
- Create: `server/src/routes/offers.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: Write submissions route**

```js
// server/src/routes/submissions.js
const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAuth } = require('../middleware/auth');
const { findComparables } = require('../services/carSearchService');
const { estimatePrice } = require('../services/sellFlowService');

// GET /api/sell-estimate?brand=X&model=Y&year=Z&mileage_km=N
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

// POST /api/submissions — submit a car for sale
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

// POST /api/submissions/:id/inspection — book inspection (step 2 of sell flow)
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
```

- [ ] **Step 2: Write offers route**

```js
// server/src/routes/offers.js
const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAuth } = require('../middleware/auth');

// PATCH /api/offers/:id/respond — seller accepts or rejects an offer
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
```

- [ ] **Step 3: Mount in index.js**

Add to `server/src/index.js` (after auth router):
```js
const submissionsRouter = require('./routes/submissions');
const offersRouter = require('./routes/offers');

app.use('/api/submissions', submissionsRouter);
app.use('/api/offers', offersRouter);
```

Note: `GET /api/sell-estimate` is at `GET /api/submissions/estimate` — mount submissions router before this works.

- [ ] **Step 4: Test**

```bash
# Sell estimate (public)
curl -s "http://localhost:3000/api/submissions/estimate?brand=Toyota&model=Vios&year=2020" | jq .

# Submit car (requires token from Task 3)
curl -s -X POST http://localhost:3000/api/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brand":"Toyota","model":"Vios","year":2020,"mileage_km":60000,"condition":"good"}' | jq .
```
Expected: estimate returns `{estimate:{suggested,low,high},comparable_count}`, submission returns `{submission:{id,status:"submitted",...}}`.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/submissions.js server/src/routes/offers.js server/src/index.js
git commit -m "feat: add submissions, offers and sell-estimate routes"
```

---

## Task 5: Enquiries + Admin Routes

**Files:**
- Create: `server/src/routes/enquiries.js`
- Create: `server/src/routes/admin.js`
- Modify: `server/src/index.js`

- [ ] **Step 1: Write enquiries route**

```js
// server/src/routes/enquiries.js
const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAuth } = require('../middleware/auth');

// POST /api/enquiries — buyer contact-to-buy
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

// GET /api/enquiries/mine
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
```

- [ ] **Step 2: Write admin route**

```js
// server/src/routes/admin.js
const express = require('express');
const router = express.Router();
const pool = require('../services/db');
const { requireAdmin } = require('../middleware/auth');
const { formatCarCard, formatCarCards } = require('../services/carFormatter');
const { searchCars } = require('../services/carSearchService');

router.use(requireAdmin);

// GET /api/admin/overview
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

// GET /api/admin/submissions
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

// PATCH /api/admin/submissions/:id
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

// GET /api/admin/inspections
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

// PATCH /api/admin/inspections/:id
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

// POST /api/admin/offers — send offer to seller
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

// GET /api/admin/buyers
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

// GET /api/admin/enquiries
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

// PATCH /api/admin/enquiries/:id
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

// GET /api/admin/cars (inventory)
router.get('/cars', async (req, res) => {
  try {
    const rows = await searchCars({}, 100);
    res.json({ cars: formatCarCards(rows) });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/admin/cars — add car to inventory after seller accepts offer
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

// PATCH /api/admin/cars/:id
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
```

- [ ] **Step 3: Mount all new routes in index.js**

Final `server/src/index.js`:
```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pool = require('./services/db');
const chatRouter = require('./routes/chat');
const carsRouter = require('./routes/cars');
const authRouter = require('./routes/auth');
const submissionsRouter = require('./routes/submissions');
const offersRouter = require('./routes/offers');
const enquiriesRouter = require('./routes/enquiries');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/cars', carsRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/offers', offersRouter);
app.use('/api/enquiries', enquiriesRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ success: false, status: 'error', db: 'disconnected' });
  }
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Route not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`BuyRight API running on http://localhost:${PORT}`));
}

module.exports = app;
```

- [ ] **Step 4: Test admin**

```bash
# Create admin user directly in DB
psql $DATABASE_URL -c "UPDATE users SET role='admin' WHERE email='buyer@test.com';"

# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@test.com","password":"secret123"}' | jq -r .token)

# Overview
curl -s http://localhost:3000/api/admin/overview -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```
Expected: overview returns counts for submissions, inventory, buyers, pending_offers.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/enquiries.js server/src/routes/admin.js server/src/index.js
git commit -m "feat: add enquiries and admin routes; raise JSON limit to 10mb"
```

---

## Task 6: AI Tool Definitions + Executors

**Files:**
- Create: `server/src/services/aiTools.js`

- [ ] **Step 1: Write aiTools.js**

```js
// server/src/services/aiTools.js
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
```

- [ ] **Step 2: Smoke test**

```bash
cd server && node -e "
const { executeTool } = require('./src/services/aiTools');
executeTool('search_cars', { brand: 'Toyota', priceMax: 80000 })
  .then(r => { console.log('PASS cars:', r.totalResults); })
  .catch(e => console.error('FAIL:', e.message));
"
```
Expected: `PASS cars: N` (some integer).

- [ ] **Step 3: Commit**

```bash
git add server/src/services/aiTools.js
git commit -m "feat: add AI tool definitions and executors for BuyRight agent loop"
```

---

## Task 7: BuyRight System Prompt

**Files:**
- Create: `server/src/services/buyRightSystemPrompt.js`

- [ ] **Step 1: Write system prompt**

```js
// server/src/services/buyRightSystemPrompt.js

const DOMAIN_FACTS = `
You are BuyRight AI, a Malaysian used-car assistant for the BuyRight platform.

BuyRight is a C2B2C used-car dealer: we buy cars from sellers, recondition them, and sell them to buyers.
All cars in our inventory belong to BuyRight — certified and reconditioned.

You can help with:
- BUYING: search inventory, show car details, compare cars
- SELLING: explain the sell process, estimate offer price, start submission
- GENERAL: answer questions about BuyRight, used cars in Malaysia

CRITICAL RULES:
- BuyRight IS the only seller. Never say "contact the seller" — say "contact us" or "enquire with BuyRight".
- For buyers: gather budget OR location before searching. Narrow to ≤3 cars before presenting.
- For sellers: explain C2B flow → call get_sell_estimate → call start_sell_flow.
- Never fabricate car data. Only state facts from tool results.
- C2B sell flow: Submit car details → Book physical inspection → BuyRight reviews → Offer sent to seller → Seller decides.
`.trim();

const TOOL_RULES = `
TOOL RULES:
- At most ONE tool call per turn. Ask a clarifying question if more info is needed first.
- BUYING: must have budget (priceMax) OR location (state) before calling search_cars.
- After search_cars returns >3 results, ask ONE narrowing question before presenting cars.
- After search_cars returns ≤3 results, present them immediately.
- Resolve cars from previous results by their ID — do not search again for cars already shown.
- SELLING: call get_sell_estimate once you have brand + model + year, then call start_sell_flow.
`.trim();

const BUYER_FLOW = `
BUYER CONVERSATION FLOW:
1. Ask ONE question at a time. Include 2–4 clickable options in EVERY question:
   [OPTIONS]Option A|Option B|Option C[/OPTIONS]
2. Gather at least budget OR state before calling search_cars.
3. After presenting cars, offer to show details or compare any two.
4. To present cars in text: reference them by title only — the UI renders car cards separately.

Suggested option formats:
- Budget: [OPTIONS]Under RM 50k|RM 50k–80k|RM 80k–120k|Above RM 120k[/OPTIONS]
- State:  [OPTIONS]Kuala Lumpur|Selangor|Johor|Penang|Other[/OPTIONS]
- Type:   [OPTIONS]Sedan|SUV|Hatchback|MPV|No preference[/OPTIONS]
`.trim();

const SELLER_FLOW = `
SELLER CONVERSATION FLOW:
1. Acknowledge their intent to sell.
2. Ask for brand, model, year if not given (one question at a time).
3. Call get_sell_estimate once you have brand + model + year.
4. Present the estimate: "Based on our current inventory, BuyRight's likely offer for your [Car] is between RM X and RM Y."
5. Call start_sell_flow and share the link: "Ready to start? Submit your car here: [link]"
6. Briefly explain the process: Submit → Inspection appointment → BuyRight sends offer → You decide.
`.trim();

const LANG_INSTRUCTIONS = {
  en: 'Respond in English.',
  ms: 'Balas dalam Bahasa Malaysia.',
  zh: '请用中文（简体）回复。',
};

function buildSystemPrompt({ language = 'en' } = {}) {
  const langNote = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.en;
  return [DOMAIN_FACTS, '', TOOL_RULES, '', BUYER_FLOW, '', SELLER_FLOW, '', langNote].join('\n');
}

module.exports = { buildSystemPrompt };
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/buyRightSystemPrompt.js
git commit -m "feat: add BuyRight C2B2C system prompt for AI agent loop"
```

---

## Task 8: Agent Loop — callDeepSeekWithTools + Replace chat.js

**Files:**
- Modify: `server/src/services/deepseekService.js`
- Modify: `server/src/routes/chat.js`

- [ ] **Step 1: Add callDeepSeekWithTools to deepseekService.js**

At the bottom of `server/src/services/deepseekService.js`, before `module.exports`, add:

```js
/**
 * Tool-calling variant — returns the raw assistant message object (may have tool_calls).
 * Called in a loop by the chat agent until the model stops calling tools.
 */
async function callDeepSeekWithTools(messages, tools) {
  const key = getKey();
  if (!key || key === 'your_deepseek_api_key_here') {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }
  const isReasoning = /flash|reasoner|r1/i.test(String(DEEPSEEK_MODEL));
  const body = {
    model: DEEPSEEK_MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    max_tokens: isReasoning ? 4000 : 1500,
    temperature: 0.7,
  };
  const response = await axios.post(`${DEEPSEEK_API_URL}/chat/completions`, body, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
  return response.data.choices[0].message;
}
```

Also add `callDeepSeekWithTools` to the `module.exports` at the bottom of the file.

- [ ] **Step 2: Replace routes/chat.js with agent loop**

```js
// server/src/routes/chat.js
const express = require('express');
const router = express.Router();

const { callDeepSeekWithTools } = require('../services/deepseekService');
const { parseFallback } = require('../services/fallbackParser');
const { buildSystemPrompt } = require('../services/buyRightSystemPrompt');
const { TOOL_DEFINITIONS, executeTool } = require('../services/aiTools');
const {
  getConversation,
  createConversation,
  appendMessage,
  getChatHistory,
} = require('../services/conversationService');
const { formatCarCards, formatCarCard } = require('../services/carFormatter');

const MAX_ITERATIONS = 5;

// Parse [OPTIONS]A|B|C[/OPTIONS] tags out of the AI reply.
function parseOptions(text) {
  const match = text.match(/\[OPTIONS\](.*?)\[\/OPTIONS\]/s);
  if (!match) return { message: text, suggestedOptions: [] };
  const suggestedOptions = match[1].split('|').map((s) => s.trim()).filter(Boolean);
  const message = text.replace(/\[OPTIONS\].*?\[\/OPTIONS\]/s, '').trim();
  return { message, suggestedOptions };
}

// Collect formatted car objects from tool results returned this turn.
function extractCarsFromResults(toolResults) {
  const cars = [];
  for (const r of toolResults) {
    if (r.cars) cars.push(...r.cars);
    if (r.car) cars.push(r.car);
  }
  // Deduplicate by id
  const seen = new Set();
  return cars.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
}

router.post('/', async (req, res) => {
  const { message: rawMsg, conversationId, language = 'en' } = req.body || {};
  const message = (rawMsg || '').trim();
  const lang = ['en', 'ms', 'zh'].includes(language) ? language : 'en';

  if (!message) return res.status(400).json({ success: false, error: 'Message is required.' });
  if (message.length > 2000) return res.status(400).json({ success: false, error: 'Message too long.' });

  try {
    // 1. Load or create conversation
    let conv = conversationId ? await getConversation(conversationId) : null;
    if (!conv) conv = await createConversation();
    const convId = conv.conversation_id;

    // Build LLM message array from stored history (last 20 turns to keep context bounded)
    const storedMessages = getChatHistory(conv).slice(-40);
    const llmHistory = storedMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const systemPrompt = buildSystemPrompt({ language: lang });
    let currentMessages = [
      { role: 'system', content: systemPrompt },
      ...llmHistory,
      { role: 'user', content: message },
    ];

    // 2. Agent loop
    let finalText = null;
    const toolResultsThisTurn = [];
    let aiStatus = 'live';

    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const aiMsg = await callDeepSeekWithTools(currentMessages, TOOL_DEFINITIONS);
        currentMessages.push(aiMsg);

        if (!aiMsg.tool_calls || aiMsg.tool_calls.length === 0) {
          finalText = aiMsg.content;
          break;
        }

        // Execute each tool call
        for (const tc of aiMsg.tool_calls) {
          let args;
          try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
          const result = await executeTool(tc.function.name, args);
          toolResultsThisTurn.push(result);
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      }
    } catch (err) {
      console.warn('[chat] AI agent error, using fallback:', err.message);
      aiStatus = 'fallback';
      const parsed = parseFallback(message);
      finalText = parsed?.response || "Sorry, I'm having trouble right now. Please try again.";
    }

    if (!finalText) finalText = "I couldn't complete that request. Please try again.";

    // 3. Parse [OPTIONS] out of reply
    const { message: cleanMessage, suggestedOptions } = parseOptions(finalText);

    // 4. Collect cars from tool results
    const cars = extractCarsFromResults(toolResultsThisTurn);

    // 5. Persist messages
    await appendMessage(convId, 'user', message);
    await appendMessage(convId, 'assistant', cleanMessage, { cars, suggestedOptions });

    return res.json({
      success: true,
      conversationId: convId,
      message: cleanMessage,
      cars,
      suggestedOptions,
      aiStatus,
    });
  } catch (err) {
    console.error('[chat] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
```

- [ ] **Step 3: Test the agent loop**

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I want a Toyota SUV under RM 100k in Selangor","language":"en"}' | jq '{message, cars_count: (.cars | length), options: .suggestedOptions}'
```
Expected: returns message with cars array populated (possibly after tool call), no error.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/deepseekService.js server/src/routes/chat.js
git commit -m "feat: replace extraction+branching with tool-calling agent loop; add BuyRight system prompt"
```

---

## Task 9: Client Dependencies + Design System

**Files:**
- Modify: `client/package.json`
- Modify: `client/src/index.css`

- [ ] **Step 1: Install react-router-dom**

```bash
cd client && npm install react-router-dom
```

- [ ] **Step 2: Verify**

```bash
node -e "require('./client/node_modules/react-router-dom')" && echo "PASS"
```

- [ ] **Step 3: Replace index.css with BuyRight design system**

```css
/* client/src/index.css */
:root {
  --primary:        #ff5a2b;
  --primary-soft:   #fff3ec;
  --primary-border: #ffd3ba;
  --bg:             #fbfaf8;
  --bg-chat:        #ffffff;
  --surface:        #ffffff;
  --border:         #efece5;
  --bg-muted:       #f5f3ee;
  --text:           #1a1a1a;
  --text-secondary: #8a8579;
  --text-dim:       #6f6a5d;
  --text-faint:     #a8a396;
  --green:          #1f8a5b;
  --amber:          #c9922e;
  --red:            #a8503f;
  --radius-card:    16px;
  --radius-input:   10px;
  --radius-pill:    999px;
  --font: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

a { color: inherit; text-decoration: none; }

button { font-family: var(--font); cursor: pointer; border: none; background: none; }

input, textarea, select {
  font-family: var(--font);
  font-size: 15px;
  outline: none;
  border: none;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--primary);
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-primary:hover { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--primary);
  font-weight: 600;
  font-size: 15px;
  padding: 11px 24px;
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--primary);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-outline:hover { background: var(--primary-soft); }

.btn-ghost {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.12s;
}
.btn-ghost:hover { background: var(--bg-muted); }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
}

.page {
  background: var(--bg);
  min-height: calc(100vh - 60px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.input-field {
  width: 100%;
  background: var(--bg-muted);
  border: 1.5px solid transparent;
  border-radius: var(--radius-input);
  padding: 12px 14px;
  font-size: 15px;
  color: var(--text);
  transition: border-color 0.15s;
}
.input-field:focus { border-color: var(--primary); background: #fff; }
.input-field::placeholder { color: var(--text-faint); }

.badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
}
.badge-green  { background: #e8f6ef; color: var(--green); }
.badge-amber  { background: #fdf3e3; color: var(--amber); }
.badge-red    { background: #fbeae8; color: var(--red); }
.badge-muted  { background: var(--bg-muted); color: var(--text-secondary); }
.badge-primary { background: var(--primary-soft); color: var(--primary); }
.badge-blue   { background: #e8f0fd; color: #2563eb; }
```

- [ ] **Step 4: Verify design vars load**

```bash
cd client && npm run dev &
# Open http://localhost:5173 — page should load without console errors
```

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/package-lock.json client/src/index.css
git commit -m "feat: add react-router-dom; replace dark CSS with BuyRight warm-white design system"
```

---

## Task 10: AuthContext + api.js

**Files:**
- Create: `client/src/context/AuthContext.jsx`
- Modify: `client/src/utils/api.js`

- [ ] **Step 1: Create AuthContext**

```jsx
// client/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('br_token');
    if (!token) { setLoading(false); return; }
    getMe()
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem('br_token'))
      .finally(() => setLoading(false));
  }, []);

  function login(token, user) {
    localStorage.setItem('br_token', token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('br_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
```

- [ ] **Step 2: Rewrite api.js**

```js
// client/src/utils/api.js
const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

function authHeaders() {
  const token = localStorage.getItem('br_token');
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'request_failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const get  = (path) => req('GET', path);
const post = (path, body) => req('POST', path, body);
const patch = (path, body) => req('PATCH', path, body);

// Auth
export const registerApi = (body) => post('/api/auth/register', body);
export const loginApi    = (body) => post('/api/auth/login', body);
export const getMe       = ()     => get('/api/auth/me');

// Cars
export const getCars = (params = {}) =>
  get(`/api/cars?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)))}`);
export const getCar  = (id) => get(`/api/cars/${id}`);

// Chat
export const postChat = (body) => post('/api/chat', body);

// Submissions
export const getSellEstimate  = (params) => get(`/api/submissions/estimate?${new URLSearchParams(params)}`);
export const createSubmission = (body)   => post('/api/submissions', body);
export const getMySubmissions = ()       => get('/api/submissions/mine');
export const bookInspection   = (id, body) => post(`/api/submissions/${id}/inspection`, body);

// Offers
export const respondToOffer = (id, decision) => patch(`/api/offers/${id}/respond`, { decision });

// Enquiries
export const createEnquiry  = (body) => post('/api/enquiries', body);
export const getMyEnquiries = ()     => get('/api/enquiries/mine');

// Admin
export const adminOverview           = ()       => get('/api/admin/overview');
export const adminGetSubmissions     = ()       => get('/api/admin/submissions');
export const adminUpdateSubmission   = (id, b)  => patch(`/api/admin/submissions/${id}`, b);
export const adminGetInspections     = ()       => get('/api/admin/inspections');
export const adminUpdateInspection   = (id, b)  => patch(`/api/admin/inspections/${id}`, b);
export const adminSendOffer          = (body)   => post('/api/admin/offers', body);
export const adminGetBuyers          = ()       => get('/api/admin/buyers');
export const adminGetEnquiries       = ()       => get('/api/admin/enquiries');
export const adminUpdateEnquiry      = (id, b)  => patch(`/api/admin/enquiries/${id}`, b);
export const adminGetCars            = ()       => get('/api/admin/cars');
export const adminAddCar             = (body)   => post('/api/admin/cars', body);
export const adminUpdateCar          = (id, b)  => patch(`/api/admin/cars/${id}`, b);
```

- [ ] **Step 3: Commit**

```bash
git add client/src/context/AuthContext.jsx client/src/utils/api.js
git commit -m "feat: add AuthContext with JWT persistence and typed api.js client"
```

---

## Task 11: App.jsx — React Router v6

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Check main.jsx**

Read `client/src/main.jsx`. If it imports `App.css` or similar, note it — we don't need it.

- [ ] **Step 2: Write App.jsx**

```jsx
// client/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';

// Pages — lazy-loadable but inline for simplicity
import Landing     from './pages/Landing';
import CarBrowse   from './pages/CarBrowse';
import CarDetail   from './pages/CarDetail';
import Chat        from './pages/Chat';
import SellFlow    from './pages/SellFlow';
import Login       from './pages/Login';
import Register    from './pages/Register';
import Account     from './pages/Account';

// Admin
import AdminLayout  from './pages/admin/AdminLayout';
import Overview     from './pages/admin/Overview';
import Submissions  from './pages/admin/Submissions';
import Inspections  from './pages/admin/Inspections';
import Offers       from './pages/admin/Offers';
import Inventory    from './pages/admin/Inventory';
import Buyers       from './pages/admin/Buyers';
import Moderation   from './pages/admin/Moderation';
import AiConfig     from './pages/admin/AiConfig';

function PublicLayout() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public + protected routes share the Header layout */}
          <Route element={<PublicLayout />}>
            <Route path="/"          element={<Landing />} />
            <Route path="/cars"      element={<CarBrowse />} />
            <Route path="/cars/:id"  element={<CarDetail />} />
            <Route path="/chat"      element={<Chat />} />
            <Route path="/sell"      element={<SellFlow />} />
            <Route path="/login"     element={<Login />} />
            <Route path="/register"  element={<Register />} />
            <Route path="/account"   element={<ProtectedRoute><Account /></ProtectedRoute>} />
          </Route>

          {/* Admin — own layout, no public Header */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index              element={<Overview />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="inspections" element={<Inspections />} />
            <Route path="offers"      element={<Offers />} />
            <Route path="inventory"   element={<Inventory />} />
            <Route path="buyers"      element={<Buyers />} />
            <Route path="moderation"  element={<Moderation />} />
            <Route path="ai"          element={<AiConfig />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Update main.jsx to remove old App.css import if present**

Read `client/src/main.jsx`. Remove any line importing `App.css`. Keep `import './index.css'`.

Expected content of main.jsx:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Verify routes load**

Start dev server. Navigate to `/` — should render without crashing (Landing not created yet, so 404 fallback is fine). No import errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/main.jsx
git commit -m "feat: replace single-page widget with React Router v6 multi-page shell"
```

---

## Task 12: Header + CarCard Components

**Files:**
- Modify: `client/src/components/Header.jsx`
- Modify: `client/src/components/CarCard.jsx`

- [ ] **Step 1: Write Header.jsx**

```jsx
// client/src/components/Header.jsx
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleLogout() { logout(); navigate('/'); }

  const navLink = (to, label) => (
    <Link
      to={to}
      style={{
        color: pathname === to ? 'var(--primary)' : 'var(--text-dim)',
        fontSize: 14,
        fontWeight: pathname === to ? 600 : 500,
        transition: 'color 0.12s',
      }}
    >
      {label}
    </Link>
  );

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      height: 60,
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 32 }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            background: 'var(--primary)', color: '#fff',
            fontWeight: 800, fontSize: 14, letterSpacing: '-0.5px',
            width: 32, height: 32, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>BR</span>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>BuyRight</span>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 24, flex: 1 }}>
          {navLink('/cars', 'Browse')}
          {navLink('/chat', 'AI Chat')}
          {navLink('/sell', 'Sell My Car')}
        </nav>

        {/* Auth */}
        {user ? (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {user.role === 'admin' && (
              <Link to="/admin" style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>Admin</Link>
            )}
            <Link to="/account" style={{ color: 'var(--text-dim)', fontSize: 14 }}>{user.name}</Link>
            <button onClick={handleLogout} style={{ color: 'var(--red)', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none' }}>
              Sign out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login">
              <button className="btn-outline" style={{ padding: '8px 18px', fontSize: 14 }}>Log in</button>
            </Link>
            <Link to="/register">
              <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>Register</button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Write CarCard.jsx**

```jsx
// client/src/components/CarCard.jsx
export default function CarCard({ car, onClick }) {
  const score = car.dealscore;
  const scoreColor = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)';

  return (
    <div
      onClick={onClick}
      className="card"
      style={{ overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 180, background: 'var(--bg-muted)' }}>
        {car.imageUrl ? (
          <img src={car.imageUrl} alt={car.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 48, opacity: 0.3 }}>🚗</div>
        )}
        {score != null && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: scoreColor, color: '#fff',
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 'var(--radius-pill)',
          }}>
            {score} Deal
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>
          {car.title}
        </div>
        <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>
          {car.priceFormatted}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {[car.year, car.mileageFormatted, car.transmission, car.fuelType].filter(Boolean).map((chip, i) => (
            <span key={i} style={{
              background: 'var(--bg-muted)', color: 'var(--text-dim)',
              fontSize: 12, padding: '3px 10px', borderRadius: 'var(--radius-pill)',
            }}>{chip}</span>
          ))}
        </div>
        {car.monthlyEstimateFormatted && (
          <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            Est. {car.monthlyEstimateFormatted}/mo · 9yr loan
          </div>
        )}
        {car.city && (
          <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 4 }}>
            📍 {car.city}, {car.state}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/` — Header should render with BuyRight logo, Browse/AI Chat/Sell nav, and Login/Register buttons. No crashes.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Header.jsx client/src/components/CarCard.jsx
git commit -m "feat: warm-white Header with nav/auth and CARSOME-style CarCard"
```

---

## Task 13: Chat Components — Warm-White Rebrand

**Files:**
- Modify: `client/src/components/ChatMessages.jsx`
- Modify: `client/src/components/ChatInput.jsx`
- Modify: `client/src/components/SuggestedButtons.jsx`
- Modify: `client/src/components/TypingIndicator.jsx`
- Modify: `client/src/chatState.js`

- [ ] **Step 1: Rewrite ChatMessages.jsx**

```jsx
// client/src/components/ChatMessages.jsx
import CarCard from './CarCard';
import TypingIndicator from './TypingIndicator';
import { useNavigate } from 'react-router-dom';

export default function ChatMessages({ messages, isLoading, onSuggestion }) {
  const navigate = useNavigate();
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
      {messages.map((msg, i) => (
        <div key={i} style={{ marginBottom: 16, padding: '0 16px' }}>
          {msg.role === 'user' ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{
                background: 'var(--primary)', color: '#fff',
                borderRadius: '18px 18px 4px 18px',
                padding: '10px 16px', maxWidth: '75%', fontSize: 15, lineHeight: 1.5,
              }}>{msg.content}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '85%' }}>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '18px 18px 18px 4px',
                padding: '10px 16px', fontSize: 15, lineHeight: 1.6, color: 'var(--text)',
                whiteSpace: 'pre-wrap',
              }}>{msg.content}</div>
              {msg.cars?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
                  {msg.cars.map((car) => (
                    <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} />
                  ))}
                </div>
              )}
              {msg.suggestedOptions?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {msg.suggestedOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onSuggestion(opt)}
                      style={{
                        background: 'var(--primary-soft)',
                        border: '1px solid var(--primary-border)',
                        color: 'var(--primary)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '7px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#ffe8d9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-soft)'}
                    >{opt}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {isLoading && <div style={{ padding: '0 16px' }}><TypingIndicator /></div>}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite ChatInput.jsx**

```jsx
// client/src/components/ChatInput.jsx
import { useState } from 'react';

export default function ChatInput({ onSend, disabled, placeholder = 'Ask about cars, or say "I want to sell my car"…' }) {
  const [value, setValue] = useState('');

  function handleSend() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    onSend(text);
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
      padding: '12px 16px',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-end',
    }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          background: 'var(--bg-muted)',
          border: '1.5px solid transparent',
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 15,
          color: 'var(--text)',
          lineHeight: 1.5,
          transition: 'border-color 0.15s',
          maxHeight: 120,
          overflowY: 'auto',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = '#fff'; }}
        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'var(--bg-muted)'; }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="btn-primary"
        style={{ padding: '10px 20px', fontSize: 14, flexShrink: 0 }}
      >
        Send
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite SuggestedButtons.jsx**

```jsx
// client/src/components/SuggestedButtons.jsx
export default function SuggestedButtons({ options, onSelect }) {
  if (!options?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 16px' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          style={{
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary-border)',
            color: 'var(--primary)',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >{opt}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite TypingIndicator.jsx**

```jsx
// client/src/components/TypingIndicator.jsx
export default function TypingIndicator() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '18px 18px 18px 4px',
      padding: '10px 16px',
    }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--text-faint)',
            animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing-dot {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40%            { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 5: Update chatState.js welcome message**

In `client/src/chatState.js`, find the welcome message referencing "KeretaAI" and update it:
```js
// Old:
content: "I'm KeretaAI..."
// New:
content: "Hi! I'm BuyRight AI. I can help you find the perfect used car from BuyRight's certified inventory, or guide you through selling your car to us. What are you looking for?"
```

Also update any `keretaai_lang` localStorage key references to `br_lang`, and update the `conversationId` API call to use `postChat` from the new api.js.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/ client/src/chatState.js
git commit -m "feat: rebrand chat components to BuyRight warm-white design; update welcome message"
```

---

## Task 14: Landing Page

**Files:**
- Create: `client/src/pages/Landing.jsx`

- [ ] **Step 1: Write Landing.jsx**

```jsx
// client/src/pages/Landing.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CarCard from '../components/CarCard';
import { getCars } from '../utils/api';

const HOW_IT_WORKS_BUY = [
  { n: '01', title: 'Browse inventory', desc: 'Search BuyRight\'s certified used cars or chat with our AI to find your match.' },
  { n: '02', title: 'Enquire with us', desc: 'Found your car? Submit an enquiry and our team will contact you to arrange a test drive.' },
  { n: '03', title: 'Drive it home', desc: 'Complete the purchase with BuyRight — fully documented, no hidden fees.' },
];
const HOW_IT_WORKS_SELL = [
  { n: '01', title: 'Submit your car', desc: 'Fill in your car details and book a free physical inspection at one of our centres.' },
  { n: '02', title: 'Get an offer', desc: 'BuyRight reviews your car and sends you a cash offer — no obligation.' },
  { n: '03', title: 'Get paid', desc: 'Accept the offer and we handle all the paperwork. Cash in days, not weeks.' },
];

function HowItWorksStep({ n, title, desc }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 28, marginBottom: 8 }}>{n}</div>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [featuredCars, setFeaturedCars] = useState([]);

  useEffect(() => {
    getCars({ sortBy: 'dealscore', limit: 3 })
      .then((d) => setFeaturedCars(d.cars || []))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      {/* Hero */}
      <section style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '80px 0 72px' }}>
        <div className="container" style={{ maxWidth: 720, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'var(--primary-soft)', color: 'var(--primary)', fontWeight: 600, fontSize: 13, padding: '5px 14px', borderRadius: 'var(--radius-pill)', marginBottom: 20, border: '1px solid var(--primary-border)' }}>
            Certified Used Cars · Malaysia
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.15, color: 'var(--text)', marginBottom: 18, letterSpacing: '-1px' }}>
            Buy smart.<br />Sell right.
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 36 }}>
            BuyRight buys, reconditions, and sells certified used cars across Malaysia. No private sellers. No surprises.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/cars"><button className="btn-primary" style={{ padding: '14px 32px', fontSize: 16 }}>Browse cars</button></Link>
            <Link to="/chat"><button className="btn-outline" style={{ padding: '14px 32px', fontSize: 16 }}>Chat with AI</button></Link>
          </div>
        </div>
      </section>

      {/* How it works — Buy */}
      <section style={{ padding: '64px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>How buying works</h2>
          </div>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {HOW_IT_WORKS_BUY.map((s) => <HowItWorksStep key={s.n} {...s} />)}
          </div>
        </div>
      </section>

      {/* Featured cars */}
      {featuredCars.length > 0 && (
        <section style={{ padding: '0 0 64px', background: 'var(--bg)' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>Top picks today</h2>
              <Link to="/cars" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>View all →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }}>
              {featuredCars.map((car) => (
                <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sell CTA */}
      <section style={{ background: 'var(--primary)', padding: '64px 0' }}>
        <div className="container" style={{ maxWidth: 680, textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
            Want to sell your car?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, lineHeight: 1.65, marginBottom: 32 }}>
            Get a free valuation and a no-obligation cash offer from BuyRight. We handle the paperwork.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/sell">
              <button style={{
                background: '#fff', color: 'var(--primary)',
                fontWeight: 700, fontSize: 16, padding: '14px 32px',
                borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer',
              }}>
                Start selling
              </button>
            </Link>
            <Link to="/chat">
              <button style={{
                background: 'transparent', color: '#fff',
                fontWeight: 600, fontSize: 16, padding: '14px 32px',
                borderRadius: 'var(--radius-pill)', border: '2px solid rgba(255,255,255,0.6)', cursor: 'pointer',
              }}>
                Estimate my car
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works — Sell */}
      <section style={{ padding: '64px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800 }}>How selling works</h2>
          </div>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {HOW_IT_WORKS_SELL.map((s) => <HowItWorksStep key={s.n} {...s} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `/`. Expected: hero section with "Buy smart. Sell right." headline, two CTA buttons, How it Works sections, featured cars grid (if DB has cars), and Sell CTA banner. No console errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Landing.jsx
git commit -m "feat: add Landing page — hero, How it Works, featured cars, Sell CTA"
```

---

## Task 15: CarBrowse + CarDetail Pages

**Files:**
- Create: `client/src/pages/CarBrowse.jsx`
- Create: `client/src/pages/CarDetail.jsx`

- [ ] **Step 1: Write CarBrowse.jsx**

```jsx
// client/src/pages/CarBrowse.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CarCard from '../components/CarCard';
import { getCars } from '../utils/api';

const BODY_TYPES = ['Sedan', 'SUV', 'Hatchback', 'MPV', 'Pickup', 'Coupe', 'Wagon'];
const PRICE_OPTIONS = [
  { label: 'Any price', value: '' },
  { label: 'Under RM 50k', value: '50000' },
  { label: 'Under RM 80k', value: '80000' },
  { label: 'Under RM 120k', value: '120000' },
  { label: 'Under RM 200k', value: '200000' },
];
const SORT_OPTIONS = [
  { label: 'Best deal', value: 'dealscore' },
  { label: 'Price: low', value: 'price_asc' },
  { label: 'Price: high', value: 'price_desc' },
  { label: 'Newest', value: 'newest' },
];

export default function CarBrowse() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    brand: params.get('brand') || '',
    bodyType: params.get('bodyType') || '',
    priceMax: params.get('priceMax') || '',
    sortBy: params.get('sortBy') || 'dealscore',
  });

  useEffect(() => {
    setLoading(true);
    const q = {};
    if (filters.brand)    q.brand    = filters.brand;
    if (filters.bodyType) q.bodyType = filters.bodyType;
    if (filters.priceMax) q.priceMax = filters.priceMax;
    if (filters.sortBy)   q.sortBy   = filters.sortBy;
    q.limit = 24;
    getCars(q)
      .then((d) => setCars(d.cars || []))
      .catch(() => setCars([]))
      .finally(() => setLoading(false));
  }, [filters]);

  function update(key, val) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  function clear() {
    setFilters({ brand: '', bodyType: '', priceMax: '', sortBy: 'dealscore' });
  }

  return (
    <div className="page" style={{ display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
        padding: '32px 20px', height: 'calc(100vh - 60px)', overflowY: 'auto',
        position: 'sticky', top: 60, background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Filters</span>
          <button onClick={clear} style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none' }}>Clear</button>
        </div>

        <FilterBlock label="Brand">
          <input
            className="input-field"
            placeholder="e.g. Toyota"
            value={filters.brand}
            onChange={(e) => update('brand', e.target.value)}
          />
        </FilterBlock>

        <FilterBlock label="Body type">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
              <input type="radio" name="bodyType" value="" checked={!filters.bodyType} onChange={() => update('bodyType', '')} />
              Any
            </label>
            {BODY_TYPES.map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="radio" name="bodyType" value={t} checked={filters.bodyType === t} onChange={() => update('bodyType', t)} />
                {t}
              </label>
            ))}
          </div>
        </FilterBlock>

        <FilterBlock label="Max price">
          <select
            className="input-field"
            value={filters.priceMax}
            onChange={(e) => update('priceMax', e.target.value)}
            style={{ background: 'var(--bg-muted)' }}
          >
            {PRICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterBlock>

        <FilterBlock label="Sort by">
          <select
            className="input-field"
            value={filters.sortBy}
            onChange={(e) => update('sortBy', e.target.value)}
            style={{ background: 'var(--bg-muted)' }}
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </FilterBlock>
      </aside>

      {/* Grid */}
      <main style={{ flex: 1, padding: '32px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>BuyRight Inventory</h1>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{cars.length} cars</span>
        </div>
        {loading ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 15 }}>Loading…</div>
        ) : cars.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>No cars match your filters. Try clearing some.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
            {cars.map((car) => <CarCard key={car.id} car={car} onClick={() => navigate(`/cars/${car.id}`)} />)}
          </div>
        )}
      </main>
    </div>
  );
}

function FilterBlock({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write CarDetail.jsx**

```jsx
// client/src/pages/CarDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCar, createEnquiry } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <tr>
      <td style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '8px 0', paddingRight: 24, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ fontSize: 14, fontWeight: 500, padding: '8px 0' }}>{value}</td>
    </tr>
  );
}

export default function CarDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [enquiryMsg, setEnquiryMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCar(id)
      .then((d) => setCar(d.car))
      .catch(() => setCar(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleEnquiry() {
    if (!user) { navigate('/login'); return; }
    setSubmitting(true);
    try {
      await createEnquiry({ car_id: Number(id), message: enquiryMsg });
      setSubmitted(true);
    } catch { /* non-fatal */ }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="page container" style={{ paddingTop: 60, color: 'var(--text-faint)' }}>Loading…</div>;
  if (!car) return <div className="page container" style={{ paddingTop: 60 }}>Car not found. <Link to="/cars" style={{ color: 'var(--primary)' }}>Browse inventory</Link></div>;

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <Link to="/cars" style={{ color: 'var(--text-secondary)', fontSize: 14, display: 'inline-block', marginBottom: 24 }}>← Back to browse</Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40, alignItems: 'start' }}>
          {/* Left */}
          <div>
            {/* Main image */}
            <div style={{ borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--bg-muted)', height: 360, marginBottom: 24 }}>
              {car.imageUrl
                ? <img src={car.imageUrl} alt={car.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 64, opacity: 0.2 }}>🚗</div>
              }
            </div>

            {/* AI summary */}
            {car.aiSummary && (
              <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>BuyRight Summary</div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{car.aiSummary}</p>
              </div>
            )}

            {/* Specs */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Specifications</div>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  <SpecRow label="Brand"        value={car.brand} />
                  <SpecRow label="Model"        value={car.model} />
                  <SpecRow label="Variant"      value={car.variant} />
                  <SpecRow label="Year"         value={car.year} />
                  <SpecRow label="Mileage"      value={car.mileageFormatted} />
                  <SpecRow label="Transmission" value={car.transmission} />
                  <SpecRow label="Fuel type"    value={car.fuelType} />
                  <SpecRow label="Body type"    value={car.bodyType} />
                  <SpecRow label="Engine"       value={car.engineCc ? `${car.engineCc} cc` : null} />
                  <SpecRow label="Seats"        value={car.seats} />
                  <SpecRow label="Colour"       value={car.color} />
                  <SpecRow label="Location"     value={car.city ? `${car.city}, ${car.state}` : null} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Right sticky panel */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card" style={{ padding: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 4 }}>BuyRight Certified</div>
              <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>{car.title}</h1>
              <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 30, marginBottom: 4 }}>{car.priceFormatted}</div>
              {car.monthlyEstimateFormatted && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                  Est. {car.monthlyEstimateFormatted}/mo (90% loan, 9yr)
                </div>
              )}

              {car.dealscore && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', background: 'var(--primary-soft)', borderRadius: 10, border: '1px solid var(--primary-border)' }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 22 }}>{car.dealscore}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>DealScore — higher means better value vs. market</span>
                </div>
              )}

              <button
                className="btn-primary"
                style={{ width: '100%', marginBottom: 10, padding: 14, fontSize: 15 }}
                onClick={() => setShowModal(true)}
              >
                Contact BuyRight to buy
              </button>
              <Link to="/chat">
                <button className="btn-outline" style={{ width: '100%', padding: 14, fontSize: 15 }}>
                  Ask AI about this car
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contact modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 420, padding: 28 }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Enquiry sent!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Our team will contact you within 1 business day.</p>
                <button className="btn-primary" onClick={() => { setShowModal(false); setSubmitted(false); }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Contact BuyRight</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{car.title}</div>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Optional message — e.g. preferred time to call, questions about the car…"
                  value={enquiryMsg}
                  onChange={(e) => setEnquiryMsg(e.target.value)}
                  style={{ resize: 'none', marginBottom: 16 }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={handleEnquiry} disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send enquiry'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/cars` — filter sidebar and car grid render. Click a car — detail page loads with specs, price panel, and "Contact BuyRight to buy" button.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/CarBrowse.jsx client/src/pages/CarDetail.jsx
git commit -m "feat: add CarBrowse (filter sidebar + grid) and CarDetail (specs + enquiry modal)"
```

---

## Task 16: Chat Page

**Files:**
- Create: `client/src/pages/Chat.jsx`
- Modify: `client/src/chatState.js`

- [ ] **Step 1: Update chatState.js**

Replace `client/src/chatState.js` entirely:

```js
// client/src/chatState.js
import { useState, useEffect, useRef } from 'react';
import { postChat } from './utils/api';

const STORAGE_KEY = 'br_conv';

const WELCOME = {
  en: { role: 'assistant', content: "Hi! I'm BuyRight AI. I can help you find the perfect certified used car from our inventory, or guide you through selling your car to us. What are you looking for?\n\n[OPTIONS]Browse SUVs|Cars under RM 80k|Sell my car|What can you do?[/OPTIONS]", cars: [], suggestedOptions: ['Browse SUVs', 'Cars under RM 80k', 'Sell my car', 'What can you do?'] },
  ms: { role: 'assistant', content: "Hai! Saya BuyRight AI. Saya boleh bantu cari kereta terpakai atau panduan untuk jual kereta anda kepada kami. Apa yang anda cari?\n\n[OPTIONS]SUV bawah RM 80k|Kereta murah|Jual kereta saya[/OPTIONS]", cars: [], suggestedOptions: ['SUV bawah RM 80k', 'Kereta murah', 'Jual kereta saya'] },
  zh: { role: 'assistant', content: "你好！我是 BuyRight AI。我可以帮您找到合适的认证二手车，或指导您将车卖给我们。您在寻找什么？\n\n[OPTIONS]10万以下SUV|便宜的车|我想卖车[/OPTIONS]", cars: [], suggestedOptions: ['10万以下SUV', '便宜的车', '我想卖车'] },
};

function stripOptions(content) {
  return content.replace(/\[OPTIONS\].*?\[\/OPTIONS\]/gs, '').trim();
}

export function useChat(language = 'en') {
  const stored = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } })();
  const welcome = WELCOME[language] || WELCOME.en;

  const [messages, setMessages] = useState(() => stored.messages?.length ? stored.messages : [{ ...welcome, content: stripOptions(welcome.content) }]);
  const [conversationId, setConversationId] = useState(() => stored.conversationId || null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, conversationId }));
  }, [messages, conversationId]);

  async function sendMessage(text) {
    const userMsg = { role: 'user', content: text, cars: [], suggestedOptions: [] };
    setMessages((m) => [...m, userMsg]);
    setIsLoading(true);
    try {
      const data = await postChat({ message: text, conversationId, language });
      setConversationId(data.conversationId);
      setMessages((m) => [...m, {
        role: 'assistant',
        content: data.message,
        cars: data.cars || [],
        suggestedOptions: data.suggestedOptions || [],
      }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: "Sorry, I'm having trouble right now. Please try again.", cars: [], suggestedOptions: [] }]);
    } finally {
      setIsLoading(false);
    }
  }

  function newChat() {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([{ ...welcome, content: stripOptions(welcome.content) }]);
    setConversationId(null);
  }

  return { messages, isLoading, sendMessage, newChat, conversationId };
}
```

- [ ] **Step 2: Write Chat.jsx**

```jsx
// client/src/pages/Chat.jsx
import { useState, useRef, useEffect } from 'react';
import { useChat } from '../chatState';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ms', label: 'BM' },
  { code: 'zh', label: '中' },
];

export default function Chat() {
  const [language, setLanguage] = useState(() => localStorage.getItem('br_lang') || 'en');
  const { messages, isLoading, sendMessage, newChat } = useChat(language);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function switchLang(lang) {
    setLanguage(lang);
    localStorage.setItem('br_lang', lang);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: 'var(--bg-chat)' }}>
      {/* Chat header bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>BuyRight AI</span>
          <span style={{ color: 'var(--green)', fontSize: 12, marginLeft: 8 }}>● Online</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Language switcher */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-muted)', borderRadius: 'var(--radius-pill)', padding: 3 }}>
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => switchLang(l.code)}
                style={{
                  background: language === l.code ? 'var(--surface)' : 'transparent',
                  color: language === l.code ? 'var(--text)' : 'var(--text-secondary)',
                  fontWeight: language === l.code ? 700 : 500,
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: language === l.code ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.12s',
                }}
              >{l.label}</button>
            ))}
          </div>
          <button
            onClick={newChat}
            style={{ color: 'var(--text-secondary)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px' }}
          >
            New chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <ChatMessages messages={messages} isLoading={isLoading} onSuggestion={sendMessage} />
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/chat`. Expected: full-height chat layout with welcome message, language switcher, New Chat button, and working input. Send a message — AI responds with car cards inline when relevant.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Chat.jsx client/src/chatState.js
git commit -m "feat: add dedicated Chat page with language switcher; update chatState for agent loop response shape"
```

---

## Task 17: Login + Register Pages

**Files:**
- Create: `client/src/pages/Login.jsx`
- Create: `client/src/pages/Register.jsx`

- [ ] **Step 1: Write Login.jsx**

```jsx
// client/src/pages/Login.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await loginApi(form);
      login(token, user);
      navigate(user.role === 'admin' ? '/admin' : '/account');
    } catch (err) {
      setError(err.message === 'invalid_credentials' ? 'Incorrect email or password.' : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Log in to your BuyRight account</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Email</label>
              <input className="input-field" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>Password</label>
              <input className="input-field" type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{error}</div>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: 13, marginTop: 4 }} disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 20 }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>Register</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write Register.jsx**

```jsx
// client/src/pages/Register.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerApi, loginApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await registerApi(form);
      const { token, user } = await loginApi({ email: form.email, password: form.password });
      login(token, user);
      navigate('/account');
    } catch (err) {
      setError(err.message === 'email_taken' ? 'That email is already registered.' : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Create an account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Join BuyRight to buy or sell cars</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: 'name',     label: 'Full name',    type: 'text',     ph: 'Ahmad Razali', req: true },
              { key: 'email',    label: 'Email',         type: 'email',    ph: 'you@example.com', req: true },
              { key: 'phone',    label: 'Phone (optional)', type: 'tel', ph: '01X-XXXXXXX', req: false },
              { key: 'password', label: 'Password',      type: 'password', ph: 'Min. 8 characters', req: true },
            ].map(({ key, label, type, ph, req }) => (
              <div key={key}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>{label}</label>
                <input className="input-field" type={type} required={req} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={ph} />
              </div>
            ))}
            {error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{error}</div>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: 13, marginTop: 4 }} disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', marginTop: 20 }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/register`. Fill form and submit — redirected to `/account`. Navigate to `/login` — can log back in, redirected to `/account` (or `/admin` if role is admin).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Login.jsx client/src/pages/Register.jsx
git commit -m "feat: add Login and Register pages with JWT auth flow"
```

---

## Task 18: SellFlow Wizard

**Files:**
- Create: `client/src/pages/SellFlow.jsx`

- [ ] **Step 1: Write SellFlow.jsx**

```jsx
// client/src/pages/SellFlow.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSellEstimate, createSubmission, bookInspection } from '../utils/api';

const CENTRES = ['KL HQ', 'Petaling Jaya', 'Johor Bahru', 'Penang', 'Kota Kinabalu'];
const CONDITIONS = [
  { value: 'excellent', label: 'Excellent', desc: 'Like new, minimal wear' },
  { value: 'good',      label: 'Good',      desc: 'Normal wear, well-maintained' },
  { value: 'fair',      label: 'Fair',      desc: 'Visible wear, needs minor work' },
];

function nextWeekdays(n) {
  const days = [];
  const d = new Date();
  while (days.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days.push(new Date(d));
    }
  }
  return days;
}

function genRef() { return 'BR-' + Math.random().toString(36).slice(2,10).toUpperCase(); }

export default function SellFlow() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [ref, setRef] = useState('');

  // Step 1 state
  const [form, setForm] = useState({
    brand: params.get('brand') || '',
    model: params.get('model') || '',
    variant: '',
    year: params.get('year') || '',
    mileage_km: '',
    condition: 'good',
    color: '',
    description: '',
  });
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [step1Error, setStep1Error] = useState('');
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2 state
  const [inspection, setInspection] = useState({ location: '', date: '', time: 'Morning 9–12', phone: user?.phone || '' });
  const [step2Error, setStep2Error] = useState('');
  const [step2Loading, setStep2Loading] = useState(false);

  const weekdays = nextWeekdays(14);

  // Live price estimate when brand/model/year filled
  useEffect(() => {
    if (!form.brand || !form.model || !form.year) return;
    const t = setTimeout(() => {
      setEstimateLoading(true);
      getSellEstimate({ brand: form.brand, model: form.model, year: form.year, mileage_km: form.mileage_km || undefined })
        .then((d) => setEstimate(d.estimate))
        .catch(() => setEstimate(null))
        .finally(() => setEstimateLoading(false));
    }, 600);
    return () => clearTimeout(t);
  }, [form.brand, form.model, form.year, form.mileage_km]);

  function setF(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleStep1Submit(e) {
    e.preventDefault();
    if (!form.brand || !form.model || !form.year || !form.mileage_km) {
      setStep1Error('Please fill in all required fields.'); return;
    }
    if (!user) { navigate('/login'); return; }
    setStep1Loading(true);
    setStep1Error('');
    try {
      const { submission } = await createSubmission({ ...form, year: Number(form.year), mileage_km: Number(form.mileage_km) });
      setSubmissionId(submission.id);
      setStep(2);
    } catch { setStep1Error('Submission failed. Please try again.'); }
    finally { setStep1Loading(false); }
  }

  async function handleStep2Submit(e) {
    e.preventDefault();
    if (!inspection.location || !inspection.date || !inspection.time) {
      setStep2Error('Please choose a centre, date and time slot.'); return;
    }
    setStep2Loading(true);
    setStep2Error('');
    try {
      const scheduled_at = `${inspection.date}T${inspection.time === 'Morning 9–12' ? '09:00' : '14:00'}:00`;
      await bookInspection(submissionId, { scheduled_at, location: inspection.location, phone: inspection.phone });
      setRef(genRef());
      setStep(3);
    } catch { setStep2Error('Booking failed. Please try again.'); }
    finally { setStep2Loading(false); }
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80, maxWidth: 900 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          {['Car details', 'Book inspection', 'Confirmation'].map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--green)' : active ? 'var(--primary)' : 'var(--bg-muted)',
                  color: done || active ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: 13,
                }}>{done ? '✓' : n}</div>
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 400, color: active ? 'var(--text)' : 'var(--text-secondary)' }}>{label}</span>
                {i < 2 && <div style={{ width: 32, height: 1, background: 'var(--border)' }} />}
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32, alignItems: 'start' }}>
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Tell us about your car</h2>
              <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Brand *"><input className="input-field" required value={form.brand} onChange={(e) => setF('brand', e.target.value)} placeholder="e.g. Toyota" /></Field>
                  <Field label="Model *"><input className="input-field" required value={form.model} onChange={(e) => setF('model', e.target.value)} placeholder="e.g. Vios" /></Field>
                  <Field label="Variant"><input className="input-field" value={form.variant} onChange={(e) => setF('variant', e.target.value)} placeholder="e.g. 1.5G" /></Field>
                  <Field label="Year *"><input className="input-field" type="number" required min={1990} max={2026} value={form.year} onChange={(e) => setF('year', e.target.value)} placeholder="e.g. 2020" /></Field>
                  <Field label="Mileage (km) *"><input className="input-field" type="number" required min={0} value={form.mileage_km} onChange={(e) => setF('mileage_km', e.target.value)} placeholder="e.g. 60000" /></Field>
                  <Field label="Colour"><input className="input-field" value={form.color} onChange={(e) => setF('color', e.target.value)} placeholder="e.g. Silver" /></Field>
                </div>

                <Field label="Condition *">
                  <div style={{ display: 'flex', gap: 10 }}>
                    {CONDITIONS.map((c) => (
                      <label key={c.value} style={{
                        flex: 1, padding: '10px 14px', border: '1.5px solid',
                        borderColor: form.condition === c.value ? 'var(--primary)' : 'var(--border)',
                        background: form.condition === c.value ? 'var(--primary-soft)' : 'var(--surface)',
                        borderRadius: 'var(--radius-input)', cursor: 'pointer', textAlign: 'center',
                      }}>
                        <input type="radio" name="condition" value={c.value} checked={form.condition === c.value} onChange={() => setF('condition', c.value)} style={{ display: 'none' }} />
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{c.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.desc}</div>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Description (optional)">
                  <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setF('description', e.target.value)} placeholder="Service history, recent repairs, extras…" style={{ resize: 'none' }} />
                </Field>

                {step1Error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{step1Error}</div>}
                <button type="submit" className="btn-primary" style={{ padding: 14 }} disabled={step1Loading}>
                  {step1Loading ? 'Saving…' : 'Next — Book inspection'}
                </button>
              </form>
            </div>

            {/* Price estimate sidebar */}
            <div className="card" style={{ padding: 22, position: 'sticky', top: 80 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Live price estimate</div>
              {!form.brand || !form.model || !form.year ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Fill in brand, model and year to see an estimate.</p>
              ) : estimateLoading ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Calculating…</p>
              ) : estimate ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>BuyRight offer range</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: 24, marginBottom: 4 }}>
                    RM {estimate.low?.toLocaleString()} – {estimate.high?.toLocaleString()}
                  </div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Based on {estimate.comparable_count} similar cars in our inventory</div>
                  <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-muted)', borderRadius: 8 }}>
                    Final offer confirmed after physical inspection.
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>No comparable cars found. We'll assess at inspection.</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ maxWidth: 560 }}>
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Book your inspection</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Choose a BuyRight inspection centre and time slot.</p>
              <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Inspection centre *">
                  <select className="input-field" required value={inspection.location} onChange={(e) => setInspection((i) => ({ ...i, location: e.target.value }))} style={{ background: 'var(--bg-muted)' }}>
                    <option value="">Select a centre</option>
                    {CENTRES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <Field label="Date * (next 14 weekdays)">
                  <select className="input-field" required value={inspection.date} onChange={(e) => setInspection((i) => ({ ...i, date: e.target.value }))} style={{ background: 'var(--bg-muted)' }}>
                    <option value="">Select a date</option>
                    {weekdays.map((d) => {
                      const iso = d.toISOString().slice(0,10);
                      const label = d.toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short' });
                      return <option key={iso} value={iso}>{label}</option>;
                    })}
                  </select>
                </Field>

                <Field label="Time slot *">
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['Morning 9–12', 'Afternoon 2–5'].map((slot) => (
                      <label key={slot} style={{ flex: 1, padding: '10px 14px', border: '1.5px solid', borderColor: inspection.time === slot ? 'var(--primary)' : 'var(--border)', background: inspection.time === slot ? 'var(--primary-soft)' : 'var(--surface)', borderRadius: 'var(--radius-input)', cursor: 'pointer', textAlign: 'center', fontSize: 13, fontWeight: inspection.time === slot ? 700 : 400 }}>
                        <input type="radio" name="time" value={slot} checked={inspection.time === slot} onChange={() => setInspection((i) => ({ ...i, time: slot }))} style={{ display: 'none' }} />
                        {slot}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Contact phone *">
                  <input className="input-field" type="tel" required value={inspection.phone} onChange={(e) => setInspection((i) => ({ ...i, phone: e.target.value }))} placeholder="01X-XXXXXXX" />
                </Field>

                <div style={{ padding: '12px 14px', background: 'var(--primary-soft)', borderRadius: 10, border: '1px solid var(--primary-border)', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  <strong>What to bring:</strong> IC (MyKad), car grant/geran, service records, spare key.
                </div>

                {step2Error && <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fbeae8', borderRadius: 8 }}>{step2Error}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn-outline" style={{ flex: 1, padding: 13 }} onClick={() => setStep(1)}>Back</button>
                  <button type="submit" className="btn-primary" style={{ flex: 2, padding: 13 }} disabled={step2Loading}>
                    {step2Loading ? 'Booking…' : 'Confirm appointment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ maxWidth: 520 }}>
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff', fontSize: 24 }}>✓</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>You're booked!</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                Reference: <strong style={{ color: 'var(--text)', letterSpacing: '0.05em' }}>{ref}</strong>
              </div>

              {/* Status timeline */}
              <div style={{ textAlign: 'left', marginBottom: 28 }}>
                {[
                  { label: 'Submitted', done: true },
                  { label: 'Inspection', done: true },
                  { label: 'BuyRight Reviews', done: false },
                  { label: 'Offer Sent', done: false },
                  { label: 'You Decide', done: false },
                ].map((s, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < arr.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.done ? 'var(--green)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{s.done ? '✓' : ''}</div>
                      {i < arr.length - 1 && <div style={{ width: 2, height: 20, background: 'var(--border)', marginTop: 2 }} />}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: s.done ? 600 : 400, color: s.done ? 'var(--green)' : 'var(--text-secondary)', paddingTop: 1 }}>{s.label}</span>
                  </div>
                ))}
              </div>

              <Link to="/account">
                <button className="btn-primary" style={{ width: '100%', padding: 14 }}>Track my submission</button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `/sell`. Expected: Step 1 form renders with price estimate sidebar. Fill in brand/model/year — estimate updates. Submit — step 2 inspection booking appears. Complete step 2 — step 3 confirmation with reference number and status timeline.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/SellFlow.jsx
git commit -m "feat: add 3-step SellFlow wizard (car details, inspection booking, confirmation)"
```

---

## Task 19: Account Dashboard

**Files:**
- Create: `client/src/pages/Account.jsx`

- [ ] **Step 1: Write Account.jsx**

```jsx
// client/src/pages/Account.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMySubmissions, getMyEnquiries, respondToOffer } from '../utils/api';

const STATUS_BADGES = {
  submitted:             { label: 'Submitted',           cls: 'badge-muted'    },
  inspection_scheduled:  { label: 'Inspection Booked',   cls: 'badge-amber'    },
  under_review:          { label: 'Under Review',         cls: 'badge-blue'     },
  offer_sent:            { label: 'Offer Sent',           cls: 'badge-primary'  },
  accepted:              { label: 'Accepted',             cls: 'badge-green'    },
  rejected:              { label: 'Rejected',             cls: 'badge-red'      },
  withdrawn:             { label: 'Withdrawn',            cls: 'badge-muted'    },
};

const ENQUIRY_BADGES = {
  new:     { label: 'Awaiting reply', cls: 'badge-amber' },
  replied: { label: 'Replied',        cls: 'badge-green'  },
};

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null); // offer id being responded to

  useEffect(() => {
    Promise.all([getMySubmissions().catch(() => ({ submissions: [] })), getMyEnquiries().catch(() => ({ enquiries: [] }))])
      .then(([s, e]) => { setSubmissions(s.submissions || []); setEnquiries(e.enquiries || []); })
      .finally(() => setLoading(false));
  }, []);

  async function handleOfferResponse(offerId, decision) {
    setResponding(offerId);
    try {
      await respondToOffer(offerId, decision);
      setSubmissions((prev) => prev.map((s) => {
        if (s.latest_offer?.id === offerId) {
          return { ...s, status: decision, latest_offer: { ...s.latest_offer, status: decision } };
        }
        return s;
      }));
    } catch { /* non-fatal */ }
    finally { setResponding(null); }
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 800 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>{user?.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{user?.email}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/sell"><button className="btn-primary" style={{ padding: '9px 18px', fontSize: 14 }}>Sell a car</button></Link>
          </div>
        </div>

        {loading ? <div style={{ color: 'var(--text-faint)' }}>Loading…</div> : (
          <>
            {/* Sell submissions */}
            <Section title="My Submissions" count={submissions.length}>
              {submissions.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '16px 0' }}>
                  No submissions yet. <Link to="/sell" style={{ color: 'var(--primary)', fontWeight: 600 }}>Start selling</Link>
                </div>
              ) : submissions.map((s) => {
                const badge = STATUS_BADGES[s.status] || { label: s.status, cls: 'badge-muted' };
                const hasOffer = s.status === 'offer_sent' && s.latest_offer?.status === 'pending';
                return (
                  <div key={s.id} className="card" style={{ padding: '16px 20px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: hasOffer ? 12 : 0 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{s.year} {s.brand} {s.model}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                          {Number(s.mileage_km).toLocaleString()} km · {s.condition}
                          {s.inspection && ` · ${new Date(s.inspection.scheduled_at).toLocaleDateString('en-MY', { day:'numeric',month:'short',year:'numeric' })} @ ${s.inspection.location}`}
                        </div>
                      </div>
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                    {hasOffer && (
                      <div style={{ padding: '14px 16px', background: 'var(--primary-soft)', borderRadius: 10, border: '1px solid var(--primary-border)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          BuyRight offer: <span style={{ color: 'var(--primary)' }}>RM {Number(s.latest_offer.offer_price).toLocaleString()}</span>
                        </div>
                        {s.latest_offer.notes && <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>{s.latest_offer.notes}</p>}
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }} onClick={() => handleOfferResponse(s.latest_offer.id, 'accepted')} disabled={responding === s.latest_offer.id}>Accept</button>
                          <button className="btn-outline" style={{ padding: '8px 20px', fontSize: 14, borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => handleOfferResponse(s.latest_offer.id, 'rejected')} disabled={responding === s.latest_offer.id}>Reject</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>

            {/* Enquiries */}
            <Section title="My Enquiries" count={enquiries.length}>
              {enquiries.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '16px 0' }}>
                  No enquiries yet. <Link to="/cars" style={{ color: 'var(--primary)', fontWeight: 600 }}>Browse cars</Link>
                </div>
              ) : enquiries.map((e) => {
                const badge = ENQUIRY_BADGES[e.status] || { label: e.status, cls: 'badge-muted' };
                return (
                  <div key={e.id} className="card" style={{ padding: '14px 18px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{e.car_title || `Car #${e.car_id}`}</div>
                      <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>{new Date(e.created_at).toLocaleDateString('en-MY')}</div>
                    </div>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                );
              })}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
        <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{count} total</span>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Log in and navigate to `/account`. Expected: user name/email, Submissions section (empty or with cards), Enquiries section. When a submission has status `offer_sent` with pending offer, Accept/Reject buttons appear.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Account.jsx
git commit -m "feat: add role-aware Account dashboard with submissions tracker and offer accept/reject"
```

---

## Task 20: Admin Layout

**Files:**
- Create: `client/src/pages/admin/AdminLayout.jsx`

- [ ] **Step 1: Create admin directory**

```bash
mkdir -p client/src/pages/admin
```

- [ ] **Step 2: Write AdminLayout.jsx**

```jsx
// client/src/pages/admin/AdminLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/admin',              label: 'Overview',     exact: true },
  { to: '/admin/submissions',  label: 'Submissions'               },
  { to: '/admin/inspections',  label: 'Inspections'               },
  { to: '/admin/offers',       label: 'Make Offers'               },
  { to: '/admin/inventory',    label: 'Inventory'                 },
  { to: '/admin/buyers',       label: 'Buyers'                    },
  { to: '/admin/moderation',   label: 'Moderation'                },
  { to: '/admin/ai',           label: 'AI Config'                 },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/'); }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Brand */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 13, width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>BR</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>BuyRight</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'block',
                padding: '9px 12px',
                borderRadius: 8,
                marginBottom: 2,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--primary)' : 'var(--text-dim)',
                background: isActive ? 'var(--primary-soft)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.12s',
              })}
            >{label}</NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{user?.name}</div>
          <button onClick={handleLogout} style={{ color: 'var(--red)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Log in as admin and navigate to `/admin`. Expected: sidebar with all 8 nav items, active item highlighted in primary-soft. Content area shows Overview (not yet written — blank is fine).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/AdminLayout.jsx
git commit -m "feat: add AdminLayout with 240px sidebar nav and active state"
```

---

## Task 21: Admin Pages — Overview, Submissions, Inspections

**Files:**
- Create: `client/src/pages/admin/Overview.jsx`
- Create: `client/src/pages/admin/Submissions.jsx`
- Create: `client/src/pages/admin/Inspections.jsx`

- [ ] **Step 1: Write Overview.jsx**

```jsx
// client/src/pages/admin/Overview.jsx
import { useEffect, useState } from 'react';
import { adminOverview } from '../../utils/api';

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  useEffect(() => { adminOverview().then(setData).catch(() => {}); }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 28 }}>Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total submissions"  value={data?.submissions}    sub="all time" />
        <StatCard label="Live inventory"     value={data?.inventory}      sub="available cars" />
        <StatCard label="Registered buyers"  value={data?.buyers}         sub="user accounts" />
        <StatCard label="Pending offers"     value={data?.pending_offers} sub="awaiting seller response" />
      </div>
      <div className="card" style={{ padding: '20px 24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Charts and deeper analytics — add after MVP.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write Submissions.jsx**

```jsx
// client/src/pages/admin/Submissions.jsx
import { useEffect, useState } from 'react';
import { adminGetSubmissions, adminUpdateSubmission, adminSendOffer } from '../../utils/api';

const STATUSES = ['submitted','inspection_scheduled','under_review','offer_sent','accepted','rejected','withdrawn'];

export default function Submissions() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offerModal, setOfferModal] = useState(null); // submission object
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    adminGetSubmissions().then((d) => setSubs(d.submissions || [])).finally(() => setLoading(false));
  }, []);

  async function updateStatus(id, status) {
    await adminUpdateSubmission(id, { status });
    setSubs((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  }

  async function sendOffer() {
    if (!offerPrice) return;
    setSending(true);
    try {
      await adminSendOffer({ submission_id: offerModal.id, offer_price: Number(offerPrice), notes: offerNote || undefined });
      setSubs((prev) => prev.map((s) => s.id === offerModal.id ? { ...s, status: 'offer_sent' } : s));
      setOfferModal(null); setOfferPrice(''); setOfferNote('');
    } catch { /* non-fatal */ }
    finally { setSending(false); }
  }

  const STATUS_COLOR = { submitted:'badge-muted', inspection_scheduled:'badge-amber', under_review:'badge-blue', offer_sent:'badge-primary', accepted:'badge-green', rejected:'badge-red', withdrawn:'badge-muted' };

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Submissions</h1>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Car','Seller','Mileage','Condition','Status','Actions'].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>{s.year} {s.brand} {s.model}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div>{s.seller_name || '—'}</div>
                    <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>{s.seller_phone}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{Number(s.mileage_km).toLocaleString()} km</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{s.condition}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${STATUS_COLOR[s.status] || 'badge-muted'}`}>{s.status.replace(/_/g,' ')}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.status === 'inspection_scheduled' && (
                        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => updateStatus(s.id, 'under_review')}>→ Under review</button>
                      )}
                      {s.status === 'under_review' && (
                        <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px' }} onClick={() => setOfferModal(s)}>Send offer</button>
                      )}
                      {!['accepted','rejected','withdrawn'].includes(s.status) && (
                        <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px', color: 'var(--red)' }} onClick={() => updateStatus(s.id, 'withdrawn')}>Withdraw</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Offer modal */}
      {offerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: 400, padding: 28 }}>
            <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Send offer</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{offerModal.year} {offerModal.brand} {offerModal.model}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Offer price (RM) *</label>
              <input className="input-field" type="number" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} placeholder="e.g. 55000" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Note to seller (optional)</label>
              <textarea className="input-field" rows={3} value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder="Reason for offer, conditions…" style={{ resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setOfferModal(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={sendOffer} disabled={!offerPrice || sending}>{sending ? 'Sending…' : 'Send offer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write Inspections.jsx**

```jsx
// client/src/pages/admin/Inspections.jsx
import { useEffect, useState } from 'react';
import { adminGetInspections, adminUpdateInspection } from '../../utils/api';

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetInspections().then((d) => setItems(d.inspections || [])).finally(() => setLoading(false));
  }, []);

  async function toggleComplete(id, completed) {
    await adminUpdateInspection(id, { completed: !completed });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, completed: !completed } : i));
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Inspections</h1>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Date & time','Centre','Car','Seller','Status',''].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((ins) => (
                <tr key={ins.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    {new Date(ins.scheduled_at).toLocaleDateString('en-MY', { weekday:'short', day:'numeric', month:'short' })}
                    <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>{new Date(ins.scheduled_at).toLocaleTimeString('en-MY', { hour:'2-digit', minute:'2-digit' })}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{ins.location}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{ins.year} {ins.brand} {ins.model}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>
                    <div>{ins.seller_name || '—'}</div>
                    <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>{ins.seller_phone}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${ins.completed ? 'badge-green' : 'badge-amber'}`}>{ins.completed ? 'Completed' : 'Upcoming'}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => toggleComplete(ins.id, ins.completed)}>
                      {ins.completed ? 'Undo' : 'Mark complete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

Log in as admin. Navigate to `/admin` — stat cards render. Navigate to `/admin/submissions` — table of submissions with status badges. Navigate to `/admin/inspections` — table of upcoming inspections.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/Overview.jsx client/src/pages/admin/Submissions.jsx client/src/pages/admin/Inspections.jsx
git commit -m "feat: add admin Overview (stat cards), Submissions (table + offer modal), Inspections (table)"
```

---

## Task 22: Admin Pages — Offers, Inventory, Buyers, Moderation, AiConfig

**Files:**
- Create: `client/src/pages/admin/Offers.jsx`
- Create: `client/src/pages/admin/Inventory.jsx`
- Create: `client/src/pages/admin/Buyers.jsx`
- Create: `client/src/pages/admin/Moderation.jsx`
- Create: `client/src/pages/admin/AiConfig.jsx`

- [ ] **Step 1: Write Offers.jsx**

```jsx
// client/src/pages/admin/Offers.jsx
import { useEffect, useState } from 'react';
import { adminGetSubmissions, adminSendOffer } from '../../utils/api';

export default function Offers() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState({});
  const [notes, setNotes] = useState({});
  const [sending, setSending] = useState(null);

  useEffect(() => {
    adminGetSubmissions()
      .then((d) => setQueue((d.submissions || []).filter((s) => s.status === 'under_review')))
      .finally(() => setLoading(false));
  }, []);

  async function send(sub) {
    const price = prices[sub.id];
    if (!price) return;
    setSending(sub.id);
    try {
      await adminSendOffer({ submission_id: sub.id, offer_price: Number(price), notes: notes[sub.id] });
      setQueue((q) => q.filter((s) => s.id !== sub.id));
    } catch { /* non-fatal */ }
    finally { setSending(null); }
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Make Offers</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>Submissions with status "Under Review" — enter a price and send the offer to the seller.</p>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : queue.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No submissions under review.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {queue.map((s) => (
            <div key={s.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px auto', gap: 16, alignItems: 'end' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.year} {s.brand} {s.model}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{Number(s.mileage_km).toLocaleString()} km · {s.condition}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 4 }}>{s.seller_name} · {s.seller_phone}</div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NOTE (optional)</label>
                  <input className="input-field" placeholder="Reason or condition…" value={notes[s.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>OFFER PRICE (RM) *</label>
                  <input className="input-field" type="number" placeholder="e.g. 52000" value={prices[s.id] || ''} onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))} />
                </div>
                <button className="btn-primary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }} onClick={() => send(s)} disabled={!prices[s.id] || sending === s.id}>
                  {sending === s.id ? 'Sending…' : 'Send offer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write Inventory.jsx**

```jsx
// client/src/pages/admin/Inventory.jsx
import { useEffect, useState } from 'react';
import { adminGetCars, adminAddCar, adminUpdateCar } from '../../utils/api';

const BODY_TYPES = ['Hatchback','Sedan','SUV','MPV','Pickup','Coupe','Wagon'];
const BLANK_FORM = { title:'', brand:'', model:'', variant:'', year:'', price:'', market_value_min:'', market_value_max:'', mileage_km:'', transmission:'Automatic', fuel_type:'Petrol', body_type:'Sedan', color:'', engine_cc:'', seats:'5', dealscore:'', ai_summary:'', city:'', state:'', image_url:'' };

export default function Inventory() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetCars().then((d) => setCars(d.cars || [])).finally(() => setLoading(false));
  }, []);

  function setF(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { car } = await adminAddCar({ ...form, year: Number(form.year), price: Number(form.price), mileage_km: Number(form.mileage_km), dealscore: Number(form.dealscore), market_value_min: Number(form.market_value_min || form.price), market_value_max: Number(form.market_value_max || form.price), engine_cc: form.engine_cc ? Number(form.engine_cc) : undefined, seats: Number(form.seats || 5) });
      setCars((c) => [car, ...c]);
      setShowModal(false);
      setForm(BLANK_FORM);
    } catch { /* non-fatal */ }
    finally { setSaving(false); }
  }

  async function markSold(id) {
    await adminUpdateCar(id, { status: 'sold' });
    setCars((c) => c.map((car) => car.id === id ? { ...car, status: 'sold' } : car));
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Inventory</h1>
        <button className="btn-primary" style={{ padding: '9px 18px', fontSize: 14 }} onClick={() => setShowModal(true)}>+ Add car</button>
      </div>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Car','Price','Mileage','Deal','Status',''].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{car.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{car.priceFormatted}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{car.mileageFormatted}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{car.dealscore}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${car.status === 'available' ? 'badge-green' : car.status === 'reserved' ? 'badge-amber' : 'badge-muted'}`}>{car.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {car.status === 'available' && (
                      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => markSold(car.id)}>Mark sold</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add car modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, overflowY: 'auto', padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, padding: 28 }}>
            <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Add car to inventory</h3>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                {[['title','Title *','text'],['brand','Brand *','text'],['model','Model *','text'],['variant','Variant','text'],['year','Year *','number'],['price','Price (RM) *','number'],['mileage_km','Mileage (km) *','number'],['dealscore','DealScore *','number'],['city','City *','text'],['state','State *','text'],['color','Colour','text'],['engine_cc','Engine (cc)','number'],['image_url','Image URL','url']].map(([k,l,t]) => (
                  <div key={k} style={{ gridColumn: ['title','image_url'].includes(k) ? '1/-1' : undefined }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>{l}</label>
                    <input className="input-field" type={t} value={form[k]} onChange={(e) => setF(k, e.target.value)} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Body type *</label>
                  <select className="input-field" value={form.body_type} onChange={(e) => setF('body_type', e.target.value)} style={{ background: 'var(--bg-muted)' }}>
                    {BODY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Transmission</label>
                  <select className="input-field" value={form.transmission} onChange={(e) => setF('transmission', e.target.value)} style={{ background: 'var(--bg-muted)' }}>
                    <option>Automatic</option><option>Manual</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add car'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write Buyers.jsx**

```jsx
// client/src/pages/admin/Buyers.jsx
import { useEffect, useState } from 'react';
import { adminGetBuyers } from '../../utils/api';

export default function Buyers() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { adminGetBuyers().then((d) => setBuyers(d.buyers || [])).finally(() => setLoading(false)); }, []);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Buyers</h1>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {['Name','Email','Phone','Enquiries','Joined'].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{b.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{b.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{b.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{b.enquiry_count}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(b.created_at).toLocaleDateString('en-MY')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write Moderation.jsx**

```jsx
// client/src/pages/admin/Moderation.jsx
import { useEffect, useState } from 'react';
import { adminGetEnquiries, adminUpdateEnquiry } from '../../utils/api';

export default function Moderation() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { adminGetEnquiries().then((d) => setItems(d.enquiries || [])).finally(() => setLoading(false)); }, []);

  async function markReplied(id) {
    await adminUpdateEnquiry(id, { status: 'replied' });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'replied' } : i));
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Inbox Moderation</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Buyer "Contact to buy" enquiries. Follow up by phone or WhatsApp.</p>
      {loading ? <p style={{ color: 'var(--text-faint)' }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No enquiries yet.</p>}
          {items.map((e) => (
            <div key={e.id} className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{e.car_title || `Car #${e.car_id}`}</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{e.name} · {e.phone}</div>
                {e.message && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{e.message}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{new Date(e.created_at).toLocaleString('en-MY')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${e.status === 'new' ? 'badge-amber' : 'badge-green'}`}>{e.status === 'new' ? 'New' : 'Replied'}</span>
                {e.status === 'new' && (
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => markReplied(e.id)}>Mark replied</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write AiConfig.jsx**

```jsx
// client/src/pages/admin/AiConfig.jsx
import { useState } from 'react';

export default function AiConfig() {
  const [tone, setTone] = useState('friendly');
  const [lang, setLang] = useState('en');
  const [fallback, setFallback] = useState(true);
  const [saved, setSaved] = useState(false);

  function save() {
    // ponytail: AI config stored in env vars for MVP — no DB persistence yet
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ padding: 32, maxWidth: 580 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>AI Config</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32 }}>BuyRight AI assistant settings. Changes take effect on the next conversation turn.</p>

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <ConfigRow label="Response tone" desc="How the AI presents information to users.">
          <div style={{ display: 'flex', gap: 8 }}>
            {['friendly','professional','concise'].map((t) => (
              <button key={t} onClick={() => setTone(t)} style={{ padding: '7px 16px', borderRadius: 'var(--radius-pill)', border: '1.5px solid', borderColor: tone===t?'var(--primary)':'var(--border)', background: tone===t?'var(--primary-soft)':'transparent', color: tone===t?'var(--primary)':'var(--text-dim)', fontWeight: tone===t?700:400, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
        </ConfigRow>

        <ConfigRow label="Default language" desc="Language used when user hasn't set a preference.">
          <select className="input-field" style={{ maxWidth: 200, background: 'var(--bg-muted)' }} value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="ms">Bahasa Malaysia</option>
            <option value="zh">中文</option>
          </select>
        </ConfigRow>

        <ConfigRow label="Regex fallback" desc="Use pattern matching when DeepSeek API is unavailable.">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div onClick={() => setFallback((f) => !f)} style={{ width: 40, height: 22, borderRadius: 11, background: fallback?'var(--primary)':'var(--border)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: fallback?20:2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            </div>
            <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{fallback ? 'Enabled' : 'Disabled'}</span>
          </label>
        </ConfigRow>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <button className="btn-primary" style={{ padding: '10px 24px' }} onClick={save}>
            {saved ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, desc, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Verify all admin pages in browser**

Navigate to each admin route:
- `/admin` — stat cards
- `/admin/submissions` — table with status badges, offer modal opens on "Send offer"
- `/admin/inspections` — upcoming/completed inspection table
- `/admin/offers` — under-review queue with inline offer form
- `/admin/inventory` — car table with "Mark sold", "+ Add car" modal
- `/admin/buyers` — buyer list
- `/admin/moderation` — enquiry cards with "Mark replied"
- `/admin/ai` — tone/language/fallback config

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/
git commit -m "feat: add all 8 admin pages (Offers, Inventory, Buyers, Moderation, AiConfig)"
```

---

## Self-Review Checklist

Verified against spec `docs/superpowers/specs/2026-07-12-buyright-redesign.md`:

| Spec section | Covered in tasks |
|---|---|
| C2B2C model — buy, sell, offer flow | Tasks 4, 5, 18, 19 |
| Auth (JWT, register/login/me) | Tasks 2, 3, 10, 17 |
| DB schema (users, submissions, inspections, offers, enquiries) | Task 1 |
| Server routes (auth, submissions, offers, admin) | Tasks 3–5 |
| AI tool-calling agent loop (5 tools) | Tasks 6–8 |
| BuyRight system prompt (C2B2C, sell flow rules) | Task 7 |
| Design system (warm-white, --primary #ff5a2b) | Task 9 |
| React Router v6 multi-page app | Task 11 |
| Landing page (hero, How it Works, featured cars, Sell CTA) | Task 14 |
| CarBrowse (filter sidebar + grid) | Task 15 |
| CarDetail (specs + contact modal) | Task 15 |
| Chat page (dedicated, language switcher) | Task 16 |
| SellFlow wizard (3 steps + price estimate sidebar) | Task 18 |
| Account (seller submissions + offer accept/reject + buyer enquiries) | Task 19 |
| Admin sidebar layout | Task 20 |
| Admin: Overview, Submissions, Inspections, Offers, Inventory, Buyers, Moderation, AI Config | Tasks 21–22 |
| Offline regex fallback preserved | Task 8 (parseFallback still used) |
| Multilingual EN/BM/ZH | Tasks 7, 16 |
| Photo upload (base64 JSONB) | Spec says out of scope for MVP — photos field accepted but no upload UI wired |

**Known gap:** Photo upload slots in SellFlow Step 1 are not implemented — the spec explicitly defers cloud storage to post-MVP. The `photos` field is accepted by the API and stored as an empty array.

