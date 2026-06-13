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

### Brand / Product Name
- Product is called **CashflowWise** (previously "Finance Tracker" / "Monthly Expense Calculator")
- Custom domain: `cashflowwise.com.au` (and `cashflowwise.au`) — registered 2026-04-27 via Crazy Domains
- Registered under ABN: 58627268599 (ALI CONSULTANCY SERVICES PTY LTD) — used for domain eligibility only
- Domain auto-renews annually via Crazy Domains account (`sydneymoca@gmail.com`)

### Services
| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | `https://cashflowwise.com.au` (custom domain) |
| Frontend (fallback) | Vercel | `https://monthly-expense-calculator-ten.vercel.app` |
| Backend | Render | `https://finance-tracker-backend-nj9l.onrender.com` |
| Database + Auth | Supabase | `https://fxpwhhtwuwqyclrkhexg.supabase.co` |
| Domain registrar | Crazy Domains | `crazydomains.com.au` — account: `sydneymoca@gmail.com` |

### GitHub
- Repo: `git@github.com:miratifali87apr/MonthlyExpenseCalculator.git`
- Vercel and Render both auto-deploy from the `main` branch on push

### Deploy flow (code changes)
```
git push origin main
  → Vercel auto-deploys frontend (both cashflowwise.com.au and vercel.app URL update)
  → Render auto-deploys backend
```
No manual DNS or domain changes needed for code updates — `cashflowwise.com.au` always serves the latest Vercel deployment automatically.

### Vercel (Frontend)
- Project: `monthly-expense-calculator` under `mir-alis-projects`
- Dashboard: `vercel.com/mir-alis-projects/monthly-expense-calculator`
- Custom domain `cashflowwise.com.au` added and configured
- DNS records set in Crazy Domains: A record → `216.198.79.1`, CNAME `www` → `845160b1887d144c.vercel-dns-017.com`
- Env vars set: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Deploys automatically on push to `main`

### Render (Backend)
- Service: `finance-tracker-backend` (Docker, **Starter plan $7 USD/month**)
- Dashboard: `dashboard.render.com` → `finance-tracker-backend`
- Upgraded from Free to Starter on 2026-04-27 — no more cold starts, server stays awake 24/7
- Env vars set: `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_URL`, `OPENAI_API_KEY`, `SUPABASE_JWT_SECRET`
- `FRONTEND_URL` must be `https://monthly-expense-calculator-ten.vercel.app` (may need updating to `cashflowwise.com.au` once domain is live)
- To redeploy manually: Render dashboard → Manual Deploy → Deploy latest commit

### Supabase
- Project: `finance-tracker` under `miratifali87apr's Org` (Free/Nano plan)
- Region: South Asia (Mumbai), `ap-south-1`, `t4g.nano`
- Auth providers: Google, GitHub, email/password
- Database: PostgreSQL (no migrations run yet — tables created by SQLAlchemy on backend startup)
- JWT secret needed for backend: Supabase dashboard → Settings → API → JWT Settings → JWT Secret
- **TODO**: Add `cashflowwise.com.au` to Supabase Auth → URL Configuration → Redirect URLs once domain is live

### Known fixes applied (2026-04-27)
- `redirect_slashes=False` added to FastAPI app in `main.py` — fixes 307 redirect bug where list endpoints (`/api/expenses`, `/api/income`, etc.) were redirecting and dropping the Authorization header
- Route decorators changed from `@router.get("/")` to `@router.get("")` in expenses, income, properties, recurring routers — required after redirect_slashes change

### User accounts
- `demo@financetracker.com` — Pro plan, used for demos
- `sydneymoca@gmail.com` — Pro plan, owner's main account (all data migrated here from demo on 2026-04-27)
- All other accounts — Free plan

### To deploy changes
1. Push to `main` — Vercel and Render both auto-deploy
2. If Render doesn't pick it up, go to Render dashboard → Manual Deploy

Copy `.env.example` to `.env` (backend) and `frontend/.env.local` (frontend) to get started.

## Code Review — 2026-06-13

### What was reviewed
Full security, correctness, scaling, and hygiene review of the entire codebase (backend + frontend).

### What was fixed this session (TA/SSD sign-off)

**TIER 1 — Security & data leaks**
1. **notify.py debug block removed** — Removed `_debug` response block that leaked user emails, DB counts, and user IDs from `send_bill_reminders`. Also removed `_DEBUG_MODE` flag and `emailed_users`/`email_errors` variables that only existed to feed it. Response now returns only `{"sent": N, "failed": N}`.
   - TA: Eliminates PII leakage at the API boundary; no coupling introduced.
   - SSD: Clean removal, no dead code left behind.
2. **SECRET_KEY startup check** *(prior session, verified)* — `config.py` fails loudly if SECRET_KEY is unset or matches known defaults. `docker-compose.yml` uses `${SECRET_KEY:?}` syntax.
3. **AI rate limiting** *(prior session, verified)* — Per-user rate limiter (`_check_ai_rate_limit`) on all AI endpoints: chat, extract-property, parse-statement, extract-bill, analyze-portfolio, purchase-predictor. Default 10 req/min, configurable via `AI_RATE_LIMIT` env var.
4. **test.db in .gitignore** — Added `*.db` to `.gitignore`. File exists on disk but was never git-tracked.

**TIER 2 — Correctness & resilience**
5. **JWKS TTL + refresh-on-failure** *(prior session, verified)* — `_JWKS_TTL = 3600` with automatic re-fetch. Kid-not-found triggers forced refresh before failing.
6. **datetime.utcnow() eliminated** — Replaced all instances with `datetime.now(timezone.utc)` across notify.py (2 instances) and all test files (test_recurring.py, test_dashboard.py, test_expenses.py, test_income.py).
   - TA: Consistent timezone-aware datetimes prevent subtle comparison bugs at system boundaries.
   - SSD: All call sites verified; no remaining utcnow() in codebase.
7. **Prisma schema synced** *(prior session, verified)* — All fields match between SQLAlchemy models and Prisma schema (user_id, amount_paid, weekly_rent, pm_fee_pct, month_of_year, plan, purchase_price, loan_amount).
   - TA NOTE: Dual-ORM (SQLAlchemy + Prisma on same DB) is fragile long-term. Consider consolidating to one ORM when the frontend moves to full API-driven data fetching. Not refactored now — would be a major architectural change.

**TIER 3 — Scaling**
8. **SQL-level filtering** *(prior session, verified)* — expenses.py uses `sqlalchemy.extract()` for month/year filtering at DB level.
9. **Pagination** — All list endpoints now have `limit`/`offset` query params with SQL-level `OFFSET`/`LIMIT`:
   - expenses: ✓ (prior session)
   - properties: ✓ (prior session)
   - recurring: ✓ (prior session)
   - **income: Fixed this session** — Replaced Python-level slicing with SQL-level `extract()` filtering + `offset()`/`limit()`. Also handles the edge case of recurring items with no date.
   - TA: Income was the last endpoint doing in-memory pagination; now all endpoints scale with data volume.
   - SSD: SQL filter preserves the original semantic (match on expected_date OR received_date, include dateless recurring items).

**TIER 4 — Code hygiene**
10. **Duplicate User interface** *(prior session, verified)* — Only one `User` interface exists in `types/index.ts` with `plan` field.
11. **Shared monthly_equivalent()** — `_to_monthly()` in `ai.py` replaced with import from `app.utils.monthly_equivalent`. Dashboard and properties already used the shared version.
    - TA: Single source of truth for frequency conversion eliminates drift risk.
    - SSD: `ad_hoc` returns `0.0` in shared version (correct for financial context), while the removed local version returned the raw amount.
12. **Footer year** — `"© 2025"` in `page.tsx` replaced with `{new Date().getFullYear()}` for dynamic year.

### CodeRabbit
CodeRabbit CLI (`coderabbit`, `cr`) is not installed locally and no `.coderabbit.yaml` config exists. `gh` CLI is also not installed. CodeRabbit may be configured as a GitHub App — it will run automatically on PR creation. Manual review was performed in lieu of local CLI run.

### What remains / deferred
- **Regression tests for Tier 1/2 fixes**: Deferred. The repo has a test suite (`backend/tests/`) but no CI pipeline to run it. Tests for SECRET_KEY startup check, JWKS refresh, and debug block removal would be valuable but are deferred to a testing-focused session.
- **Dual-ORM consolidation**: The SQLAlchemy + Prisma dual-ORM pattern is fragile (any schema change must be mirrored in two places). Long-term, consider moving the frontend to API-only data fetching and dropping Prisma, or vice versa.
- **Alembic migrations**: Schema is managed by `create_all()` on startup. No Alembic migration history exists. This works for now but will become dangerous with schema changes on a live DB.
- **Mobile app**: Planned (Expo React Native in `/mobile`), not started.
- **Google OAuth**: Client ID registered but not fully configured in Supabase.

### Known issues
- No CI/CD test pipeline — tests exist but must be run manually
- Dual-ORM fragility (SQLAlchemy + Prisma mirror same DB)
- No Alembic migrations — `create_all()` on startup
- `_ai_requests` rate limiter is in-memory; resets on server restart (acceptable for current scale)
- `_USER_CACHE` in auth.py is also in-memory (acceptable for single-instance deployment)

### Next steps for next session
- Set up CI pipeline (GitHub Actions) to run `pytest` on PR
- Add Alembic migration infrastructure
- Write regression tests for security fixes (SECRET_KEY check, JWKS refresh)
- Consider adding Redis-backed rate limiting if scaling beyond single instance
