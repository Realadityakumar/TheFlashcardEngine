# ⚡ FlashcardEngine

Turn any PDF into a smart study deck powered by AI and spaced repetition.

Upload a PDF → Gemini extracts key concepts → SM-2 algorithm schedules reviews → you retain more with less effort.

**Live:** [flashcardengine.vercel.app](https://flashcardengine.vercel.app)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Next.js 16 (App Router)           │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Upload   │  │  Study   │  │  Calendar View    │  │
│  │  (Home)   │  │  Session │  │  + Day Detail     │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │             │
│  ─────┴──────────────┴─────────────────┴──────────── │
│                   API Routes (Node.js)               │
│                                                     │
│  /api/ingest   → PDF processing + Gemini generation  │
│  /api/review   → SM-2 card scheduling               │
│  /api/study    → Due card fetching                   │
│  /api/decks    → CRUD operations                     │
│  /api/stats    → Mastery & retention metrics          │
│  /api/schedule → 14-day forecast                     │
│  /api/calendar → Monthly heatmap data                │
│  /api/calendar/cards → Day-level drill-down          │
│                                                     │
│  ─────────────────────────────────────────────────── │
│          Prisma ORM (PostgreSQL + pg adapter)        │
└─────────────────────────────────────────────────────┘
         │                              │
    ┌────┴────┐                  ┌──────┴──────┐
    │ Gemini  │                  │ PostgreSQL  │
    │ 2.5     │                  │ (Neon/      │
    │ Flash   │                  │  Supabase)  │
    └─────────┘                  └─────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + custom design tokens |
| AI | Google Gemini 2.5 Flash |
| Database | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` |
| PDF Parsing | pdfjs-dist (legacy build for Node.js) |
| Animations | GSAP + Framer Motion |
| Deployment | Vercel (serverless, 120s function timeout) |

---

## Engineering Deep Dive

### PDF Ingestion Pipeline (`/api/ingest` → `lib/pdf-detector.ts` → `lib/gemini.ts`)

The ingestion route streams NDJSON progress updates to the client for real-time UI feedback:

```
Upload → Validate → Hash Check → Detect Type → Generate Cards → Save
  │         │           │            │              │             │
  │      magic bytes  dedup via    vision vs      Gemini API    Prisma
  │      + size check SHA-256     text routing    with retry    transaction
  │                                                             
  └── Streaming NDJSON: analyzing → processing → saving → done
```

**PDF Type Detection** scans page operator lists to find educational images using three filters:
1. **Size** — skip images < 100×100px (icons, bullets)
2. **Position** — skip images in header/footer zones (< 8% or > 92% of page height)
3. **Frequency** — skip images appearing on > 30% of pages (logos, watermarks)

If meaningful images are found → **vision path** (sends PDF as base64 to Gemini).  
Otherwise → **text path** (extracts text via pdfjs, cheaper and faster).

**Large PDFs** (> 40 pages) are chunked into 80-page segments and processed sequentially to respect Gemini's free-tier rate limits.

**Serverless Polyfills** — pdfjs-dist expects browser DOM APIs (`DOMMatrix`, `ImageData`, `Path2D`). These are polyfilled with minimal stubs before dynamic import since we only need text extraction, not rendering.

### Spaced Repetition Engine (`lib/sm2.ts`)

Implements SM-2 with a 4-point rating scale adapted from the original 0–5:

| Rating | Meaning | Behavior |
|--------|---------|----------|
| 0 — Again | Complete failure | Reset streak, re-queue in session |
| 1 — Hard | Passed but struggled | Keep streak, shorter interval (1.2× vs full EF) |
| 2 — Good | Solid recall | Standard SM-2 progression |
| 3 — Easy | Effortless | Boosted interval (1.3× bonus multiplier) |

Key design decision: **Hard is a pass, not a failure.** The card stays in the learning queue but comes back sooner than Good. This prevents discouraging users who recall correctly but with effort.

### Card Validation (`lib/validators.ts`)

Every Gemini response passes through server-side validation:
- **Structure** — front/back must be strings within length bounds (10–300 / 10–600 chars)
- **Content** — rejects cards containing URLs or prompt injection patterns
- **Taxonomy** — normalizes `type` to one of `definition | application | relationship | edge_case`

### Mastery Classification (`/api/stats`)

Cards are classified into three states for the mastery ring visualization:

| State | Criteria | Meaning |
|-------|----------|---------|
| **Mastered** | repetitions ≥ 2 AND easeFactor ≥ 2.0 | Consistently recalled |
| **Shaky** | repetitions ≥ 1 but not mastered | Seen but unstable |
| **New** | repetitions = 0 | Never reviewed or reset by "Again" |

### Streak System (`lib/streak.ts`)

Counts consecutive calendar days with at least one review. The streak remains active if the last review was today or yesterday (grace period for timezone edge cases).

### Database Schema

```
Deck ──< Card ──< ReviewLog
  │        │
  │        ├── easeFactor (SM-2 parameter)
  │        ├── interval (days until next review)
  │        ├── repetitions (consecutive successes)
  │        └── dueDate (next scheduled review)
  │
  ├── pdfHash (SHA-256, unique — prevents duplicate uploads)
  └── lastStudied (updated atomically with each review)
```

All review operations use **Prisma transactions** — card update + review log + deck timestamp happen atomically.

---

## Project Structure

```
app/
├── page.tsx                 # Home — PDF upload with drag & drop
├── layout.tsx               # Root layout with navbar + toaster
├── decks/
│   ├── page.tsx             # Deck list with search + stats
│   └── [id]/
│       ├── page.tsx         # Deck detail — stats, card list, filters
│       └── study/page.tsx   # Study session — flashcard flip + rating
├── calendar/page.tsx        # Monthly calendar heatmap
└── api/                     # 7 API routes (all Node.js runtime)

components/
├── FlashCard.tsx            # 3D flip card with perspective transform
├── RatingButtons.tsx        # 4-button rating with keyboard shortcuts (1-4)
├── MasteryRing.tsx          # SVG donut chart (mastery or due mode)
├── CalendarGrid.tsx         # Interactive month grid with badges
├── DayDetailPanel.tsx       # Slide-in panel for day drill-down
├── DeckCard.tsx             # Deck card with mini mastery ring
├── LoadingIngestion.tsx     # Upload progress overlay with ETA
├── UpcomingSchedule.tsx     # 14-day review forecast bars
├── StreakBar.tsx             # 30-day activity heatmap
├── NavLinks.tsx             # Active-aware navigation links
└── PageTransition.tsx       # Framer Motion page wrapper

lib/
├── gemini.ts                # Gemini client with rate-limit retry logic
├── pdf-detector.ts          # PDF type detection + text extraction
├── sm2.ts                   # SM-2 spaced repetition algorithm
├── prisma.ts                # Singleton Prisma client with pg adapter
├── validators.ts            # PDF + flashcard validation
├── streak.ts                # Streak calculation
└── utils.ts                 # Relative date formatting
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (Neon, Supabase, or local)
- Gemini API key

### Setup

```bash
git clone https://github.com/your-username/TheFlashcardEngine.git
cd TheFlashcardEngine
npm install
```

Create `.env.local`:
```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname?sslmode=require"
GEMINI_API_KEY="your-gemini-api-key"
```

Run migrations and start:
```bash
npx prisma migrate deploy
npm run dev
```

### Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add `DATABASE_URL` and `GEMINI_API_KEY` environment variables
4. Deploy — `prisma generate` runs automatically via postinstall

---

## Design System

The UI uses a dark-first design with a custom token system:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#6c63ff` | Buttons, accents, active states |
| `--color-secondary` | `#00d2ff` | Gradients, secondary accents |
| `--color-success` | `#00e5a0` | Mastered cards, caught-up states |
| `--font-display` | Syne | Headlines, card questions |
| `--font-body` | DM Sans | Body text, UI elements |

---

## License

MIT
