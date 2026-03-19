from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import DashboardSummary, CashflowTrend, ExpenseItemResponse, IncomeItemResponse
from app.auth import get_current_user

router = APIRouter()


def _monthly_equivalent(amount: float, frequency: str) -> float:
    """Convert any frequency amount to its monthly equivalent."""
    freq = (frequency or "monthly").lower()
    if freq == "weekly":
        return float(amount) * 52 / 12
    if freq == "fortnightly":
        return float(amount) * 26 / 12
    if freq == "quarterly":
        return float(amount) / 3
    # monthly / ad_hoc / other
    return float(amount)


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today = now.date()
    current_year = today.year
    current_month = today.month

    # ------------------------------------------------------------------
    # Total monthly income
    # ------------------------------------------------------------------
    # Recurring income (normalised to monthly)
    recurring_income_items = (
        db.query(models.IncomeItem)
        .filter(models.IncomeItem.is_recurring == True)
        .all()
    )
    total_monthly_income = sum(
        _monthly_equivalent(float(item.amount), item.frequency or "monthly")
        for item in recurring_income_items
    )

    # Non-recurring income received this calendar month
    non_recurring_this_month = (
        db.query(models.IncomeItem)
        .filter(
            models.IncomeItem.is_recurring == False,
            models.IncomeItem.received_date != None,  # noqa: E711
        )
        .all()
    )
    for item in non_recurring_this_month:
        rd = item.received_date
        if rd and rd.year == current_year and rd.month == current_month:
            total_monthly_income += float(item.amount)

    # ------------------------------------------------------------------
    # Total monthly expenses
    # ------------------------------------------------------------------
    expenses_this_month = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.due_date != None,  # noqa: E711
        )
        .all()
    )
    expenses_this_month_filtered = [
        e for e in expenses_this_month
        if e.due_date.year == current_year and e.due_date.month == current_month
    ]

    if expenses_this_month_filtered:
        total_monthly_expenses = sum(float(e.amount) for e in expenses_this_month_filtered)
    else:
        # Fall back to recurring templates sum
        active_templates = (
            db.query(models.RecurringTemplate)
            .filter(models.RecurringTemplate.is_active == True)
            .all()
        )
        total_monthly_expenses = sum(float(t.amount) for t in active_templates)

    net_cashflow = total_monthly_income - total_monthly_expenses

    # ------------------------------------------------------------------
    # Upcoming 7 days
    # ------------------------------------------------------------------
    window_7 = now + timedelta(days=7)
    upcoming_7_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.due_date >= now,
            models.ExpenseItem.due_date <= window_7,
            models.ExpenseItem.status != "paid",
        )
        .order_by(models.ExpenseItem.due_date.asc())
        .all()
    )

    # ------------------------------------------------------------------
    # Upcoming 30 days
    # ------------------------------------------------------------------
    window_30 = now + timedelta(days=30)
    upcoming_30_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.due_date >= now,
            models.ExpenseItem.due_date <= window_30,
            models.ExpenseItem.status != "paid",
        )
        .order_by(models.ExpenseItem.due_date.asc())
        .all()
    )

    # ------------------------------------------------------------------
    # Overdue items
    # ------------------------------------------------------------------
    overdue_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.due_date < now,
            models.ExpenseItem.status == "pending",
        )
        .order_by(models.ExpenseItem.due_date.desc())
        .all()
    )

    # ------------------------------------------------------------------
    # Next 7 unfunded — upcoming pending items regardless of date window
    # ------------------------------------------------------------------
    next_unfunded_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.due_date >= now,
            models.ExpenseItem.status == "pending",
        )
        .order_by(models.ExpenseItem.due_date.asc())
        .limit(7)
        .all()
    )

    # ------------------------------------------------------------------
    # Pending reimbursements
    # ------------------------------------------------------------------
    pending_reimb_raw = (
        db.query(models.IncomeItem)
        .filter(
            models.IncomeItem.type == "reimbursement",
            models.IncomeItem.reimbursement_status == "pending",
        )
        .all()
    )

    # ------------------------------------------------------------------
    # Cashflow trend – last 6 months
    # ------------------------------------------------------------------
    trend: List[CashflowTrend] = []
    for i in range(5, -1, -1):
        # Go back i months from current month
        month_offset = current_month - i
        year_offset = current_year
        while month_offset <= 0:
            month_offset += 12
            year_offset -= 1

        month_label = f"{year_offset}-{month_offset:02d}"

        # Income for this month: received_date OR expected_date in that month
        all_income = db.query(models.IncomeItem).all()
        month_income = 0.0
        for inc in all_income:
            rd = inc.received_date
            ed = inc.expected_date
            if (rd and rd.year == year_offset and rd.month == month_offset) or (
                ed and ed.year == year_offset and ed.month == month_offset
            ):
                month_income += float(inc.amount)

        # Expenses for this month
        all_expenses = db.query(models.ExpenseItem).all()
        month_expenses_items = [
            e for e in all_expenses
            if e.due_date and e.due_date.year == year_offset and e.due_date.month == month_offset
        ]

        if month_expenses_items:
            month_expenses = sum(float(e.amount) for e in month_expenses_items)
        else:
            # Fall back to templates total if no expense items recorded for that month
            active_templates = (
                db.query(models.RecurringTemplate)
                .filter(models.RecurringTemplate.is_active == True)
                .all()
            )
            month_expenses = sum(float(t.amount) for t in active_templates)

        # For income, fall back to recurring income total if no recorded income
        if month_income == 0.0:
            month_income = sum(
                _monthly_equivalent(float(item.amount), item.frequency or "monthly")
                for item in recurring_income_items
            )

        trend.append(
            CashflowTrend(
                month=month_label,
                income=round(month_income, 2),
                expenses=round(month_expenses, 2),
                net=round(month_income - month_expenses, 2),
            )
        )

    return DashboardSummary(
        total_monthly_income=round(total_monthly_income, 2),
        total_monthly_expenses=round(total_monthly_expenses, 2),
        net_cashflow=round(net_cashflow, 2),
        upcoming_7_days=[ExpenseItemResponse.model_validate(e) for e in upcoming_7_raw],
        upcoming_30_days=[ExpenseItemResponse.model_validate(e) for e in upcoming_30_raw],
        overdue_items=[ExpenseItemResponse.model_validate(e) for e in overdue_raw],
        next_unfunded=[ExpenseItemResponse.model_validate(e) for e in next_unfunded_raw],
        pending_reimbursements=[IncomeItemResponse.model_validate(r) for r in pending_reimb_raw],
        cashflow_trend=trend,
    )
