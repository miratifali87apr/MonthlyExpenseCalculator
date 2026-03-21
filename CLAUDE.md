# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance Tracker is a full-stack personal finance and property cashflow manager. It uses a **dual-ORM architecture**: the FastAPI backend manages the database schema via SQLAlchemy models, while the Next.js frontend has its own Prisma schema that mirrors the same tables for type-safe DB access from server components or API routes.

## Development Commands

### Docker (recommended)
```bash
docker-compose up -d                                    # Start all services
docker-compose exec backend python seed.py              # Seed database
docker-compose exec backend alembic upgrade head        # Run migrations
docker-compose logs -f backend                          # Tail backend logs
docker-compose down -v                                  # Stop and wipe DB
```

### Backend (manual)
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload      # Dev server at http://localhost:8000
python seed.py                 # Seed database
```

### Frontend (manual)
```bash
cd frontend
npm run dev                    # Dev server at http://localhost:3000
npm run lint                   # ESLint check
npm run db:migrate             # Create and apply Prisma migration
npm run db:seed                # Run Prisma seed
npm run db:studio              # Visual DB explorer
```

## Architecture

### Backend (`backend/`)
- **`main.py`** – FastAPI app entry point; registers all routers under `/api/*` prefix; auto-creates tables on startup via `models.Base.metadata.create_all()`; CORS origins read from `settings.frontend_url`
- **`app/models.py`** – SQLAlchemy ORM models (source of truth for DB schema): `User`, `Property`, `RecurringTemplate`, `ExpenseItem`, `IncomeItem`
- **`app/schemas.py`** – Pydantic schemas for request/response validation
- **`app/auth.py`** – Dual JWT verification: tries Supabase JWT first (using `SUPABASE_JWT_SECRET`), falls back to internal JWT (`SECRET_KEY`). Auto-creates a local `User` row on first Supabase login via `_find_or_create_user`.
- **`app/routers/`** – One file per domain: `auth`, `dashboard`, `expenses`, `income`, `properties`, `recurring`, `ai`
- **`seed.py`** – Standalone seed script (run directly, not via uvicorn)

### Frontend (`frontend/`)
- **Next.js 14 App Router** with two route groups:
  - `src/app/(auth)/` – Login/register pages (unauthenticated)
  - `src/app/(dashboard)/` – Protected app pages
- **`src/lib/api.ts`** – Centralized API client; all backend calls go through here using `NEXT_PUBLIC_API_URL`. Gets the Supabase session token via `supabase.auth.getSession()` and sends it as `Authorization: Bearer <token>` on every request. On 401, signs out and redirects to `/login`.
- **`src/lib/supabase.ts`** – Supabase client using `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **`src/types/index.ts`** – All shared TypeScript types; source of truth for frontend types
- **`prisma/schema.prisma`** – Mirrors backend SQLAlchemy models; used for Prisma Client access from the frontend
- **Data fetching** – TanStack Query (`@tanstack/react-query`) for server state management
- **Charts** – Recharts for the 6-month trend visualization

### Auth Flow
Supabase handles the auth UI (Google, GitHub, email/password). After sign-in, `api.ts` extracts the Supabase JWT and sends it to the FastAPI backend as a Bearer token. The backend verifies it using `SUPABASE_JWT_SECRET` and auto-provisions a local `User` row if one doesn't exist.

### Data Flow
- The frontend Prisma client and backend SQLAlchemy both point to the same PostgreSQL database; keep both schemas in sync when adding/modifying models

## Key Domain Concepts

- **`ExpenseItem`**: individual expense; `status` is `pending | paid | overdue | funded`; can be linked to a `RecurringTemplate` via `template_id`; `fund` action marks it as funded without paying
- **`RecurringTemplate`**: blueprint for repeating expenses; `frequency` is `monthly | quarterly | weekly | fortnightly | ad_hoc`; generates `ExpenseItem` instances via the `/api/recurring/generate` endpoint
- **`IncomeItem`**: `type` is `salary | rental | reimbursement | other`; reimbursements have an additional `reimbursement_status` of `pending | received`
- **`Property`**: groups expenses and income for investment properties; `tenant_liable_for_water` flag affects cashflow calculations; has `weekly_rent`, `pm_fee_pct`, `purchase_price`, `loan_amount` fields for cashflow analysis
- **Category**: expense categories are `loan | insurance | utility | council_rates | bas | school_fees | credit_card | car | pm_fees | maintenance | letting_fee | other`

## Environment Variables

| Variable                    | Used by  | Purpose                                              |
|-----------------------------|----------|------------------------------------------------------|
| `DATABASE_URL`              | Backend  | PostgreSQL connection string                         |
| `SECRET_KEY`                | Backend  | JWT signing secret (32+ chars) for internal JWTs    |
| `SUPABASE_JWT_SECRET`       | Backend  | Supabase JWT secret for verifying Supabase tokens    |
| `FRONTEND_URL`              | Backend  | CORS allowed origin                                  |
| `NEXT_PUBLIC_API_URL`       | Frontend | Backend API base URL for browser                     |
| `NEXT_PUBLIC_SUPABASE_URL`  | Frontend | Supabase project URL                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Supabase anon/public key                         |

## Production Deployment

### Services
| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | `https://monthly-expense-calculator-ten.vercel.app` |
| Backend | Render | `https://finance-tracker-backend-nj9l.onrender.com` |
| Database + Auth | Supabase | `https://fxpwhhtwuwqyclrkhexg.supabase.co` |

### GitHub
- Repo: `git@github.com:miratifali87apr/MonthlyExpenseCalculator.git`
- Vercel and Render both auto-deploy from the `main` branch on push

### Vercel (Frontend)
- Project: `monthly-expense-calculator` under `mir-alis-projects`
- Dashboard: `vercel.com/mir-alis-projects/monthly-expense-calculator`
- Env vars set: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploys automatically on push to `main`

### Render (Backend)
- Service: `finance-tracker-backend` (Docker, Free tier)
- Dashboard: `dashboard.render.com` → `finance-tracker-backend`
- Env vars set: `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_URL`, `OPENAI_API_KEY`, `SUPABASE_JWT_SECRET`
- `FRONTEND_URL` must be `https://monthly-expense-calculator-ten.vercel.app` (the `-ten` suffix is required)
- Free tier spins down after inactivity — first request after idle takes ~50s
- To redeploy manually: Render dashboard → Manual Deploy → Deploy latest commit

### Supabase
- Project: `finance-tracker` under `miratifali87apr's Org` (Free/Nano plan)
- Region: South Asia (Mumbai), `ap-south-1`, `t4g.nano`
- Auth providers: Google, GitHub, email/password
- Database: PostgreSQL (no migrations run yet — tables created by SQLAlchemy on backend startup)
- JWT secret needed for backend: Supabase dashboard → Settings → API → JWT Settings → JWT Secret

### To deploy changes
1. Push to `main` — Vercel and Render both auto-deploy
2. If Render doesn't pick it up, go to Render dashboard → Manual Deploy

Copy `.env.example` to `.env` (backend) and `frontend/.env.local` (frontend) to get started.
