# Finance Tracker – Personal Finance & Property Cashflow Manager

A full-stack personal finance management application for tracking monthly expenses, rental property cashflow, recurring bills, income, and reimbursements.

---

## Features

- **Dashboard** – At-a-glance summary of monthly income vs expenses, net cashflow, and 6-month trend chart
- **Expense Tracking** – Log one-off and recurring expenses with categories, due dates, and payment status
- **Recurring Bills** – Template-based recurring expense system; auto-generate upcoming bills for any month
- **Income Management** – Track salary, rental income, reimbursements, and ad-hoc income
- **Property Cashflow** – Per-property income/expense breakdown and net cashflow reporting
- **Reimbursement Tracking** – Mark reimbursements as pending or received; view outstanding amounts
- **Upcoming & Overdue Alerts** – See bills due in the next 7 / 30 days and overdue items instantly
- **Mark as Paid** – One-click payment confirmation with auto-date stamping
- **Multi-property Support** – Manage expenses and income for multiple investment properties independently
- **Secure Authentication** – JWT-based login with bcrypt password hashing

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 14 (App Router), TypeScript |
| UI          | Tailwind CSS, shadcn/ui             |
| ORM (FE)    | Prisma (PostgreSQL)                 |
| Backend     | FastAPI (Python 3.11)               |
| ORM (BE)    | SQLAlchemy 2.0                      |
| Database    | PostgreSQL 16                       |
| Auth        | JWT (python-jose), bcrypt (passlib) |
| Container   | Docker & Docker Compose             |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) v2+
- [Node.js](https://nodejs.org/) 18+ (for manual frontend setup)
- [Python](https://www.python.org/downloads/) 3.11+ (for manual backend setup)
- [pnpm](https://pnpm.io/) (optional – npm or yarn also work)

---

## Quick Start with Docker Compose

```bash
git clone <repo>
cd MonthlyExpenseCalculator
cp .env.example .env
docker-compose up -d
# Wait for services to start (~30s)
# Seed the database:
docker-compose exec backend python seed.py
# Run Prisma migrations:
cd frontend && npx prisma migrate deploy && npx prisma db seed
```

Once running, open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Manual Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env         # edit DATABASE_URL if needed
python seed.py                  # seed database
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install                     # or pnpm install
cp ../.env.example .env.local   # edit NEXT_PUBLIC_API_URL if needed
npx prisma migrate dev
npx prisma db seed
npm run dev
```

---

## Default Login

| Field    | Value               |
|----------|---------------------|
| Email    | admin@finance.local |
| Password | admin123            |

> Change these credentials immediately in any non-local environment.

---

## URLs

| Service      | URL                              |
|--------------|----------------------------------|
| Frontend     | http://localhost:3000            |
| API          | http://localhost:8000            |
| API Docs     | http://localhost:8000/docs       |
| API ReDoc    | http://localhost:8000/redoc      |

---

## Commands Reference

### Docker

| Command                                              | Description                            |
|------------------------------------------------------|----------------------------------------|
| `docker-compose up -d`                               | Start all services in background       |
| `docker-compose down`                                | Stop all services                      |
| `docker-compose down -v`                             | Stop and remove volumes (wipe DB)      |
| `docker-compose logs -f backend`                     | Tail backend logs                      |
| `docker-compose exec backend python seed.py`         | Seed the database                      |
| `docker-compose exec backend alembic upgrade head`   | Run database migrations                |
| `docker-compose ps`                                  | Show running containers                |

### Manual

| Command                                              | Description                            |
|------------------------------------------------------|----------------------------------------|
| `uvicorn main:app --reload`                          | Start backend dev server               |
| `python seed.py`                                     | Seed database with sample data         |
| `npm run dev`                                        | Start frontend dev server              |
| `npx prisma migrate dev`                             | Create and apply a new migration       |
| `npx prisma migrate deploy`                          | Apply pending migrations               |
| `npx prisma db seed`                                 | Run Prisma seed script                 |
| `npx prisma studio`                                  | Open Prisma visual DB explorer         |

---

## Environment Variables

| Variable                | Location           | Description                              |
|-------------------------|--------------------|------------------------------------------|
| `DATABASE_URL`          | `.env` / backend   | PostgreSQL connection string             |
| `SECRET_KEY`            | `.env` / backend   | JWT signing secret (min 32 chars)        |
| `FRONTEND_URL`          | `.env` / backend   | Allowed CORS origin                      |
| `NEXT_PUBLIC_API_URL`   | `frontend/.env.local` | Backend API base URL for the browser  |

---

## Project Structure

```
MonthlyExpenseCalculator/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── seed.py
│   └── app/
│       ├── __init__.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── auth.py
│       └── routers/
│           ├── __init__.py
│           ├── auth.py
│           ├── dashboard.py
│           ├── expenses.py
│           ├── income.py
│           ├── properties.py
│           └── recurring.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── ...
```
