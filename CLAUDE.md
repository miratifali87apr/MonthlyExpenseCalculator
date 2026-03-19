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
- **`main.py`** – FastAPI app entry point; registers all routers under `/api/*` prefix; auto-creates tables on startup via `models.Base.metadata.create_all()`
- **`app/models.py`** – SQLAlchemy ORM models (source of truth for DB schema): `User`, `Property`, `RecurringTemplate`, `ExpenseItem`, `IncomeItem`
- **`app/schemas.py`** – Pydantic schemas for request/response validation
- **`app/auth.py`** – JWT token creation/verification and bcrypt password hashing
- **`app/routers/`** – One file per domain: `auth`, `dashboard`, `expenses`, `income`, `properties`, `recurring`
- **`seed.py`** – Standalone seed script (run directly, not via uvicorn)

### Frontend (`frontend/`)
- **Next.js 14 App Router** with two route groups:
  - `src/app/(auth)/` – Login/register pages (unauthenticated)
  - `src/app/(dashboard)/` – Protected app pages
- **`src/lib/api.ts`** – Centralized API client; all backend calls go through here using `NEXT_PUBLIC_API_URL`
- **`prisma/schema.prisma`** – Mirrors backend SQLAlchemy models; used for Prisma Client access from the frontend
- **Data fetching** – TanStack Query (`@tanstack/react-query`) for server state management
- **Charts** – Recharts for the 6-month trend visualization

### Data Flow
- Auth: frontend POSTs to `/api/auth/login` → backend returns JWT → stored client-side → sent as `Authorization: Bearer <token>` on subsequent requests
- The frontend Prisma client and backend SQLAlchemy both point to the same PostgreSQL database; keep both schemas in sync when adding/modifying models

## Key Domain Concepts

- **`ExpenseItem`**: individual expense; `status` is `pending | paid | overdue`; can be linked to a `RecurringTemplate` via `template_id`
- **`RecurringTemplate`**: blueprint for repeating expenses; `frequency` defaults to `monthly`; generates `ExpenseItem` instances via the `/api/recurring` router
- **`IncomeItem`**: `type` is `salary | rental | reimbursement | other`; reimbursements have an additional `reimbursement_status` of `pending | received`
- **`Property`**: groups expenses and income for investment properties; `tenant_liable_for_water` flag affects cashflow calculations

## Environment Variables

| Variable              | Used by  | Purpose                          |
|-----------------------|----------|----------------------------------|
| `DATABASE_URL`        | Backend  | PostgreSQL connection string     |
| `SECRET_KEY`          | Backend  | JWT signing secret (32+ chars)   |
| `FRONTEND_URL`        | Backend  | CORS allowed origin              |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API base URL for browser |

Copy `.env.example` to `.env` (backend) and `frontend/.env.local` (frontend) to get started.
