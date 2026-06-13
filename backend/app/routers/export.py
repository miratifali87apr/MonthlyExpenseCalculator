from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app import models

router = APIRouter()


@router.get("/tax-year")
def tax_year_export(
    fy: int = Query(..., description="Financial year end — e.g. 2025 = July 2024 to June 2025"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return all expenses and income for an Australian financial year (1 July – 30 June).
    fy=2025 means 1 July 2024 – 30 June 2025.
    """
    start = datetime(fy - 1, 7, 1)
    end = datetime(fy, 6, 30, 23, 59, 59)

    expenses = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.user_id == current_user.id,
            models.ExpenseItem.due_date >= start,
            models.ExpenseItem.due_date <= end,
        )
        .all()
    )

    income = (
        db.query(models.IncomeItem)
        .filter(
            models.IncomeItem.user_id == current_user.id,
            models.IncomeItem.expected_date >= start,
            models.IncomeItem.expected_date <= end,
        )
        .all()
    )

    properties = (
        db.query(models.Property)
        .filter(models.Property.user_id == current_user.id)
        .all()
    )

    prop_map = {p.id: p.name for p in properties}

    return {
        "financial_year": f"FY{fy} (1 Jul {fy-1} – 30 Jun {fy})",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "expenses": [
            {
                "id": e.id,
                "name": e.name,
                "category": e.category,
                "amount": float(e.amount),
                "amount_paid": float(e.amount_paid or 0),
                "due_date": e.due_date.strftime("%d/%m/%Y") if e.due_date else "",
                "status": e.status,
                "property": prop_map.get(e.property_id, "Personal"),
                "notes": e.notes or "",
            }
            for e in expenses
        ],
        "income": [
            {
                "id": i.id,
                "name": i.name,
                "type": i.type,
                "amount": float(i.amount),
                "date": (i.received_date or i.expected_date).strftime("%d/%m/%Y") if (i.received_date or i.expected_date) else "",
                "property": prop_map.get(i.property_id, "Personal"),
                "notes": i.notes or "",
            }
            for i in income
        ],
        "summary": {
            "total_income": sum(float(i.amount) for i in income),
            "total_expenses": sum(float(e.amount) for e in expenses),
            "total_paid": sum(float(e.amount_paid or 0) for e in expenses),
            "net": sum(float(i.amount) for i in income) - sum(float(e.amount) for e in expenses),
        },
    }
