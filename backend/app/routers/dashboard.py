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
    if freq == "yearly":
        return float(amount) / 12
    if freq == "ad_hoc":
        return 0.0
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
    # Total monthly income — scoped to current user
    # ------------------------------------------------------------------
    recurring_income_items = (
        db.query(models.IncomeItem)
        .filter(
            models.IncomeItem.user_id == current_user.id,
            models.IncomeItem.is_recurring == True,
        )
        .all()
    )
    total_monthly_income = sum(
        _monthly_equivalent(float(item.amount), item.frequency or "monthly")
        for item in recurring_income_items
    )

    non_recurring_this_month = (
        db.query(models.IncomeItem)
        .filter(
            models.IncomeItem.user_id == current_user.id,
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
    # Total monthly expenses — scoped to current user
    # ------------------------------------------------------------------
    expenses_this_month = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.user_id == current_user.id,
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
        active_templates = (
            db.query(models.RecurringTemplate)
            .filter(
                models.RecurringTemplate.user_id == current_user.id,
                models.RecurringTemplate.is_active == True,
            )
            .all()
        )
        total_monthly_expenses = sum(float(t.amount) for t in active_templates)

    net_cashflow = total_monthly_income - total_monthly_expenses

    # ------------------------------------------------------------------
    # Upcoming 7 days — scoped to current user
    # ------------------------------------------------------------------
    window_7 = now + timedelta(days=7)
    upcoming_7_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.user_id == current_user.id,
            models.ExpenseItem.due_date >= now,
            models.ExpenseItem.due_date <= window_7,
            models.ExpenseItem.status != "paid",
        )
        .order_by(models.ExpenseItem.due_date.asc())
        .all()
    )

    # ------------------------------------------------------------------
    # Upcoming 30 days — scoped to current user
    # ------------------------------------------------------------------
    window_30 = now + timedelta(days=30)
    upcoming_30_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.user_id == current_user.id,
            models.ExpenseItem.due_date >= now,
            models.ExpenseItem.due_date <= window_30,
            models.ExpenseItem.status != "paid",
        )
        .order_by(models.ExpenseItem.due_date.asc())
        .all()
    )

    # ------------------------------------------------------------------
    # Overdue items — scoped to current user
    # ------------------------------------------------------------------
    overdue_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.user_id == current_user.id,
            models.ExpenseItem.status.in_(["pending", "overdue"]),
            models.ExpenseItem.due_date < now,
        )
        .order_by(models.ExpenseItem.due_date.desc())
        .all()
    )

    # ------------------------------------------------------------------
    # Next 7 unfunded — scoped to current user
    # ------------------------------------------------------------------
    next_unfunded_raw = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.user_id == current_user.id,
            models.ExpenseItem.due_date >= now,
            models.ExpenseItem.status == "pending",
        )
        .order_by(models.ExpenseItem.due_date.asc())
        .limit(7)
        .all()
    )

    # ------------------------------------------------------------------
    # Pending reimbursements — scoped to current user
    # ------------------------------------------------------------------
    pending_reimb_raw = (
        db.query(models.IncomeItem)
        .filter(
            models.IncomeItem.user_id == current_user.id,
            models.IncomeItem.type == "reimbursement",
            models.IncomeItem.reimbursement_status == "pending",
        )
        .all()
    )

    # ------------------------------------------------------------------
    # Cashflow trend – last 6 months, scoped to current user
    # ------------------------------------------------------------------
    # Fetch all user income and expenses once to avoid 12 DB round-trips
    all_user_income = (
        db.query(models.IncomeItem)
        .filter(models.IncomeItem.user_id == current_user.id)
        .all()
    )
    all_user_expenses = (
        db.query(models.ExpenseItem)
        .filter(models.ExpenseItem.user_id == current_user.id)
        .all()
    )
    user_active_templates = (
        db.query(models.RecurringTemplate)
        .filter(
            models.RecurringTemplate.user_id == current_user.id,
            models.RecurringTemplate.is_active == True,
        )
        .all()
    )
    recurring_income_monthly = sum(
        _monthly_equivalent(float(item.amount), item.frequency or "monthly")
        for item in recurring_income_items
    )
    template_expenses_total = sum(float(t.amount) for t in user_active_templates)

    trend: List[CashflowTrend] = []
    for i in range(5, -1, -1):
        month_offset = current_month - i
        year_offset = current_year
        while month_offset <= 0:
            month_offset += 12
            year_offset -= 1

        month_label = f"{year_offset}-{month_offset:02d}"

        month_income = 0.0
        for inc in all_user_income:
            rd = inc.received_date
            ed = inc.expected_date
            if (rd and rd.year == year_offset and rd.month == month_offset) or (
                ed and ed.year == year_offset and ed.month == month_offset
            ):
                month_income += float(inc.amount)

        month_expenses_items = [
            e for e in all_user_expenses
            if e.due_date and e.due_date.year == year_offset and e.due_date.month == month_offset
        ]

        if month_expenses_items:
            month_expenses = sum(float(e.amount) for e in month_expenses_items)
        else:
            month_expenses = template_expenses_total

        if month_income == 0.0:
            month_income = recurring_income_monthly

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
