# BuyRight — Platform Redesign Spec
**Date:** 2026-07-12  
**Project:** KeretaAI → BuyRight  
**Model:** C2B2C (BuyRight buys from sellers, reconditions, sells to buyers — like CARSOME)

---

## 1. Goal

Rebuild KeretaAI into **BuyRight**, a Malaysian used-car platform that mirrors CARSOME's business model:

1. **Sellers** submit their car → book a physical inspection → receive a cash offer from BuyRight → accept or reject.
2. **BuyRight** buys accepted cars, adds them to live inventory.
3. **Buyers** browse BuyRight's curated inventory, use the AI chat to find a car, then contact BuyRight to purchase.

The AI chatbot must be at least as capable as BidNow's (tool-calling agent loop), adapted for cars and C2B2C context.

---

## 2. Approach

**Full client rebuild + server evolution.**

The current KeretaAI client (`client/src/`) is a single-page chat widget — nothing worth preserving architecturally. It will be replaced with a multi-page React app (React Router v6).

The server keeps its existing `chat` and `cars` routes and gains new routes for auth, sell submissions, inspection booking, offers, and admin.

---

## 3. Design System

Sourced from the CARSOME Studio `.dc.html` design files in `ai-car-sales-assistant/project/`.

```css
--primary:        #ff5a2b;   /* orange-red — CTAs, active nav, user chat bubbles */
--primary-soft:   #fff3ec;   /* suggestion chip backgrounds */
--primary-border: #ffd3ba;   /* suggestion chip borders */
--bg:             #fbfaf8;   /* warm white — all content pages */
--bg-chat:        #ffffff;   /* pure white — chat page only */
--surface:        #ffffff;   /* cards, modals, panels */
--border:         #efece5;   /* all dividers and card borders */
--bg-muted:       #f5f3ee;   /* inputs, inactive tabs, photo slots */
--text:           #1a1a1a;
--text-secondary: #8a8579;
--text-dim:       #6f6a5d;
--text-faint:     #a8a396;   /* placeholders, timestamps */
--green:          #1f8a5b;   /* below-market, verified, success, accepted */
--amber:          #c9922e;   /* reserved, scheduled, warning */
--red:            #a8503f;   /* reject, destructive actions */
--radius-card:    16px;
--radius-input:   10px;
--radius-pill:    999px;
--font: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
```

**Brand:** Logo mark `BR` on `#ff5a2b` rounded square. Site name: **BuyRight**. Tagline: *"Buy smart. Sell right."*

---

## 4. Page Map

### Public (no auth required)

| Route | Page |
|-------|------|
| `/` | Landing — hero, "How BuyRight Works", featured cars, Sell CTA |
| `/cars` | Browse inventory — filter sidebar + car grid |
| `/cars/:id` | Car detail — photos, specs, "Contact to buy" |
| `/chat` | AI chat (dedicated page, Option A) |
| `/sell` | Sell flow wizard (auth required at step 2) |
| `/login` | Login |
| `/register` | Register |

### Protected (auth required)

| Route | Page |
|-------|------|
| `/account` | User dashboard (buyer or seller view) |

### Admin (admin role)

| Route | Section |
|-------|---------|
| `/admin` | Overview |
| `/admin/submissions` | Seller submissions queue |
| `/admin/inspections` | Inspection appointments |
| `/admin/offers` | Make offers to sellers |
| `/admin/inventory` | Live car inventory |
| `/admin/buyers` | Buyer accounts |
| `/admin/moderation` | Inbox moderation |
| `/admin/ai` | AI Assistant config |

---

## 5. Client Structure

```
client/src/
  pages/
    Landing.jsx
    CarBrowse.jsx
    CarDetail.jsx
    SellFlow.jsx          ← 3-step wizard
    Chat.jsx              ← AI chat, reskinned
    Login.jsx
    Register.jsx
    Account.jsx           ← role-aware (buyer vs seller view)
    admin/
      AdminLayout.jsx     ← sidebar nav
      Overview.jsx
      Submissions.jsx
      Inspections.jsx
      Offers.jsx
      Inventory.jsx
      Buyers.jsx
      Moderation.jsx
      AiConfig.jsx
  components/
    Header.jsx            ← warm-white nav with Login/Register
    CarCard.jsx           ← redesigned per CARSOME style
    ChatMessages.jsx
    ChatInput.jsx
    SuggestedButtons.jsx
    TypingIndicator.jsx
  context/
    AuthContext.jsx       ← JWT auth state
  utils/
    api.js
  App.jsx                 ← React Router v6 setup
  index.css               ← new design system (replaces dark theme)
```

---

## 6. Database Schema Additions

Four new tables alongside existing `cars`, `sellers`, `conversations`:

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(30),
  role          VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' | 'admin'
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE submission_status AS ENUM (
  'submitted', 'inspection_scheduled', 'under_review',
  'offer_sent', 'accepted', 'rejected', 'withdrawn'
);

CREATE TABLE car_submissions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  brand            VARCHAR(100) NOT NULL,
  model            VARCHAR(100) NOT NULL,
  variant          VARCHAR(100),
  year             INTEGER NOT NULL,
  mileage_km       INTEGER NOT NULL,
  condition        VARCHAR(20) NOT NULL, -- 'excellent' | 'good' | 'fair'
  color            VARCHAR(50),
  description      TEXT,
  photos           JSONB DEFAULT '[]',
  status           submission_status NOT NULL DEFAULT 'submitted',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inspections (
  id             SERIAL PRIMARY KEY,
  submission_id  INTEGER REFERENCES car_submissions(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMP NOT NULL,
  location       VARCHAR(255) NOT NULL,
  notes          TEXT,
  completed      BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE offers (
  id             SERIAL PRIMARY KEY,
  submission_id  INTEGER REFERENCES car_submissions(id) ON DELETE CASCADE,
  offer_price    NUMERIC(12,2) NOT NULL,
  notes          TEXT,
  expires_at     TIMESTAMP,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
  responded_at   TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

When a seller **accepts** an offer, admin manually adds the car to the `cars` table (existing inventory flow).

---

## 7. Server Routes (new)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/cars/:id            ← new (detail page)

POST   /api/submissions         ← seller submits car
GET    /api/submissions/mine    ← seller tracks their submissions
GET    /api/submissions/:id

POST   /api/submissions/:id/inspection   ← book inspection (step 2 of sell flow)
PATCH  /api/offers/:id/respond           ← seller accepts/rejects offer

GET    /api/admin/overview
GET    /api/admin/submissions
PATCH  /api/admin/submissions/:id        ← update status
POST   /api/admin/offers                 ← send offer to seller
GET    /api/admin/inspections
GET    /api/admin/buyers
```

Existing `/api/chat` and `/api/cars` (list/search) unchanged.

---

## 8. Sell Flow UX

### Step 1 — Car details (public)

Two-column layout:
- **Left:** form fields — Brand (dropdown), Model, Variant, Year, Mileage (km), Condition (Excellent · Good · Fair), Color, Description (optional), up to 8 photo upload slots.
- **Right sidebar:** live price estimate panel — calls `sellFlowService.estimatePrice` as the user fills in brand/model/year/mileage. Shows suggested price + range from comparable inventory.

### Step 2 — Book inspection (requires auth)

If guest → login/register modal (returns to same step). Fields:
- Inspection centre (KL HQ · Petaling Jaya · Johor Bahru · Penang · Kota Kinabalu)
- Date (next 14 days, weekdays only)
- Time slot (Morning 9–12 · Afternoon 2–5)
- Phone number (pre-filled from account)
- "What to bring" info block: IC, grant/geran, service records, spare key.

### Step 3 — Confirmation

- Reference number: `BR-XXXXXXXX`
- Appointment summary card
- Visual status timeline: Submitted → Inspection → BuyRight Reviews → Offer Sent → You Decide
- CTA: "Track my submission" → `/account`

---

## 9. Account Dashboard

Role-aware — same route `/account`, different content.

**Seller view:** Submissions table with live status badges:

| Status | Colour |
|--------|--------|
| Submitted | muted gray |
| Inspection Scheduled | amber |
| Under Review | blue |
| Offer Sent | `#ff5a2b` — shows offer price + Accept / Reject buttons |
| Accepted | green |
| Rejected / Withdrawn | muted |

**Buyer view:**
- Saved cars (hearted from browse/detail pages)
- My enquiries — list of cars the buyer sent a "Contact to buy" enquiry about, with status (New · Replied)

**"Contact to buy" flow (car detail page):**
Simple modal — buyer's name + phone pre-filled from account, optional message. On submit creates an enquiry record visible to admin. MVP: no real-time chat, admin follows up by phone/WhatsApp.

---

## 10. Admin Adaptations (vs original design)

The original "Agents & Dealers" section is removed. Replaced with:

**Inspection Appointments** — table of upcoming inspections: date/time, location, submitted car title, seller name/phone. Admin can add notes and mark complete.

**Make Offers** — queue of submissions with status `under_review`. Admin enters an offer price and optional note, clicks "Send Offer" → status updates to `offer_sent`, seller sees offer on their account.

**Inventory** — table of live cars in the `cars` table (BuyRight's stock). Includes an **"+ Add car"** button (reuses the Add Listing modal pattern from the Agent design file) so admin can add a car after a seller accepts an offer.

All other admin sections (Overview, Buyers, Inbox Moderation, AI Config) map directly from the CARSOME Studio Admin design file, adapted with BuyRight branding and C2B2C metrics (GMV, active inventory, buy conversion).

---

## 11. AI Upgrade — Tool-Calling Agent

Replaces KeretaAI's extraction+branching with BidNow-style tool-calling agent loop.

### Tools

| Tool | When called |
|------|-------------|
| `search_cars` | Buyer has given budget OR location — searches live BuyRight inventory |
| `get_car_detail` | User asks about a specific car already shown or named |
| `compare_cars` | User wants to compare 2 cars |
| `get_sell_estimate` | Seller gives brand/model/year — estimates fair price from comparable inventory |
| `start_sell_flow` | Returns deep-link to `/sell?brand=X&model=Y&year=Z` to start submission |

### Key system prompt rules (C2B2C)

- BuyRight **is** the seller. Never say "contact the seller" — say "contact us" or "book a test drive with BuyRight."
- All inventory belongs to BuyRight — cars are reconditioned and certified.
- For sell intent: explain the C2B flow, then call `get_sell_estimate`, then `start_sell_flow`.
- Conversation narrowing: gather budget OR location before calling `search_cars`. Narrow to ≤3 results before presenting cards.
- Multilingual: EN / BM / ZH (same as current KeretaAI).

### Offline fallback

Regex fallback parser (`fallbackParser.js`) kept unchanged — same pattern as BidNow and KeretaAI.

---

## 12. What's NOT in scope

- Email notifications (offer sent, inspection reminder) — add later.
- Payment / checkout flow — BuyRight contacts buyer offline for now.
- Photo upload to cloud storage — photos stored as JSONB array of base64-encoded strings in the `car_submissions.photos` column for MVP. No S3/Supabase dependency.
- Car reconditioning workflow — internal admin process, not tracked in this system.
