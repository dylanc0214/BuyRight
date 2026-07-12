# KeretaAI — Second-Hand Car AI Chatbot for Malaysia

**KeretaAI** ("kereta" = car in Malay) is an AI chatbot that helps **buyers find second-hand cars** and **sellers price & list their cars** across Malaysia. Built for the AI Hackathon, modeled on the BidNow AI mechanism (AI filter extraction → parameterized SQL search → cards + narrative) with several improvements.

## Stack
- **Frontend**: React + Vite (port 5173)
- **Backend**: Node.js + Express (port 3000)
- **Database**: PostgreSQL 15 (port 5432, local Homebrew)
- **AI**: DeepSeek API (`deepseek-chat`)

## What's better than BidNow
| Improvement | Detail |
|---|---|
| **Buy AND Sell modes** | One chat handles both. A seller can say "I want to sell my 2019 Myvi, 60k km" — the AI extracts the details, finds comparable listings in the DB, and suggests a fair asking price with a listing draft. |
| **DealScore (0–100)** | Every listing is scored on price-vs-market, mileage-vs-age, and seller trust — surfaced on every card so buyers instantly see good deals. |
| **Loan estimate on every card** | Monthly installment (10% down, 3.5% flat, 9 years — typical MY hire purchase) computed server-side. No more mental math. |
| **Progressive filter relaxation** | Zero results never dead-end: the search widens city → state, drops soft preferences, then bumps budget 15% once — and tells the user what it relaxed. |
| **Single AI call per turn** | Intent + filters + next question extracted in one JSON call (BidNow used multiple round trips), so replies are faster and cheaper. |
| **Offline fallback** | Regex parser keeps the demo alive if the DeepSeek API (or hackathon WiFi) dies. |
| **Multilingual** | English / Bahasa Melayu / 中文, same as BidNow. |

## Quick Start

### 1. Prerequisites
- Node.js v18+
- PostgreSQL 15 (`brew install postgresql@15`)
- DeepSeek API key from https://platform.deepseek.com

### 2. Database setup
```bash
brew services start postgresql@15
bash database/setup.sh
```

### 3. Backend
```bash
cd server
npm install
cp .env.example .env   # then set DEEPSEEK_API_KEY=your_key
npm run dev
```

### 4. Frontend
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## Mock Data
- **100 cars** across 24 brands recognised in Malaysia (Perodua, Proton, Toyota, Honda, Nissan, Mazda, Mitsubishi, Suzuki, Isuzu, Ford, Hyundai, Kia, Chery, BYD, Tesla, Volkswagen, BMW, Mercedes-Benz, Audi, Volvo, Lexus, Subaru, Peugeot, MINI), realistic used-market prices in RM.
- **28 sellers** (dealers + private) covering all 13 states + KL, Putrajaya & Labuan.
- **14 users** (buyers + sellers, sellers linked to seller profiles).

## Project Structure
```
KeretaAI/
├── database/
│   ├── schema.sql       # users, sellers, cars, conversations
│   ├── seed.sql         # 100 cars, 28 sellers, 14 users
│   └── setup.sh         # One-command DB bootstrap
├── server/
│   └── src/
│   ├── scripts/selfcheck.js          # No-DB smoke checks (npm run check)
│   └── src/
│       ├── index.js                  # Express entry point
│       ├── routes/chat.js            # POST /api/chat (buy + sell orchestration)
│       ├── routes/cars.js            # GET /api/cars
│       └── services/
│           ├── db.js                 # pg.Pool (reads PG* vars from .env)
│           ├── deepseekService.js    # Intent + filter extraction, narratives
│           ├── fallbackParser.js     # Regex fallback (offline mode)
│           ├── conversationService.js# Conversation CRUD (JSONB context)
│           ├── carSearchService.js   # Parameterized SQL + relaxation
│           ├── carFormatter.js       # DB row → card object + loan estimate
│           └── sellFlowService.js    # Comparables → price estimate
└── client/
    └── src/
        ├── App.jsx, index.css
        ├── chatState.js              # useChat hook (messages, persistence)
        ├── utils/{api,storage}.js
        └── components/{Header,ChatMessages,ChatInput,SuggestedButtons,TypingIndicator,CarCard}.jsx
```

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server + DB status |
| POST | `/api/chat` | Chat message → AI response + car cards |
| GET | `/api/cars` | Paginated car list (filterable) |
| GET | `/api/cars/brands` | Distinct brands with counts |
| GET | `/api/cars/:id` | Single car with seller info |
# BuyRight
