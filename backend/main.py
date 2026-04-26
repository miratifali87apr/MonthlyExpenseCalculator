from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app import models
from app.routers import auth, dashboard, expenses, income, properties, recurring, ai, export, notify
from app.config import settings

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Finance Tracker API",
    description="Personal Finance & Property Cashflow Manager",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000", settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(income.router, prefix="/api/income", tags=["Income"])
app.include_router(properties.router, prefix="/api/properties", tags=["Properties"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["Recurring"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(notify.router, prefix="/api/notify", tags=["Notifications"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "finance-tracker-api"}
