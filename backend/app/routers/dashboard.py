from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models
from app.schemas import DashboardSummary, CashflowTrend, ExpenseItemResponse, IncomeItemResponse
from app.auth import get_current_user
from app.utils import monthly_equivalent

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    today = now.date()
    current_year = today.year
    current_month = today.month
    window_7 = now + timedelta(days=7)
    window_30 = now + timedelta(days=30)

    def _dt(d):
        """Make a naive datetime timezone-aware (UTC) so Python comparisons don't crash."""
        if d is None:
            return None
        if d.tzinfo is None:
            return d.replace(tzinfo=timezone.utc)
        return d

    # ------------------------------------------------------------------
    # Single query for ALL user expenses — with property eagerly loaded
    # to eliminate N+1 lazy-load queries on serialisation.
    # We filter everything in Python from this one result set.
    # ------------------------------------------------------------------
    all_expenses = (
        db.query(models.ExpenseItem)
        .options(joinedload(models.ExpenseItem.property))
        .filter(models.ExpenseItem.user_id == current_user.id)
        .order_by(models.ExpenseItem.due_date.asc())
        .all()
    )

    expenses_this_month = [
        e for e in all_expenses
        if e.due_date and e.due_date.year == current_year and e.due_date.month == current_month
    ]
    upcoming_7_raw = [
        e for e in all_expenses
        if e.due_date and now <= _dt(e.due_date) <= window_7 and e.status != "paid"
    ]
    upcoming_30_raw = [
        e for e in all_expenses
        if e.due_date and now <= _dt(e.due_date) <= window_30 and e.status != "paid"
    ]
    overdue_raw = sorted(
        [e for e in all_expenses if e.due_date and _dt(e.due_date) < now and e.status in ("pending", "overdue")],
        key=lambda e: e.due_date,
        reverse=True,
    )
    next_unfunded_raw = [
        e for e in all_expenses
        if e.due_date and _dt(e.due_date) >= now and e.status == "pending"
    ][:7]

    # ------------------------------------------------------------------
    # Single query for ALL user income — with property eagerly loaded
    # ------------------------------------------------------------------
    all_income = (
        db.query(models.IncomeItem)
        .options(joinedload(models.IncomeItem.property))
        .filter(models.IncomeItem.user_id == current_user.id)
        .all()
    )

    recurring_income_items = [i for i in all_income if i.is_recurring]
    pending_reimb_raw = [
        i for i in all_income
        if i.type == "reimbursement" and i.reimbursement_status == "pending"
    ]

    # ------------------------------------------------------------------
    # Active templates — used for expense fallback and trend
    # ------------------------------------------------------------------
    user_active_templates = (
        db.query(models.RecurringTemplate)
        .filter(
            models.RecurringTemplate.user_id == current_user.id,
            models.RecurringTemplate.is_active == True,
        )
        .all()
    )
    template_expenses_total = sum(
        monthly_equivalent(float(t.amount), t.frequency or "monthly")
        for t in user_active_templates
    )

    # ------------------------------------------------------------------
    # Totals
    # ------------------------------------------------------------------
    recurring_income_monthly = sum(
        monthly_equivalent(float(item.amount), item.frequency or "monthly")
        for item in recurring_income_items
    )

    total_monthly_income = recurring_income_monthly
    for item in all_income:
        if not item.is_recurring and item.received_date:
            rd = item.received_date
            if rd.year == current_year and rd.month == current_month:
                total_monthly_income += float(item.amount)

    if expenses_this_month:
        total_monthly_expenses = sum(float(e.amount) for e in expenses_this_month)
    else:
        total_monthly_expenses = template_expenses_total

    net_cashflow = total_monthly_income - total_monthly_expenses

    # ------------------------------------------------------------------
    # Cashflow trend — last 6 months, filtered from in-memory data
    # ------------------------------------------------------------------
    trend: List[CashflowTrend] = []
    for i in range(5, -1, -1):
        month_offset = current_month - i
        year_offset = current_year
        while month_offset <= 0:
            month_offset += 12
            year_offset -= 1

        month_label = f"{year_offset}-{month_offset:02d}"

        month_income = 0.0
        for inc in all_income:
            rd = inc.received_date
            ed = inc.expected_date
            if (rd and rd.year == year_offset and rd.month == month_offset) or (
                ed and ed.year == year_offset and ed.month == month_offset
            ):
                month_income += float(inc.amount)

        month_expense_items = [
            e for e in all_expenses
            if e.due_date and e.due_date.year == year_offset and e.due_date.month == month_offset
        ]
        month_expenses = (
            sum(float(e.amount) for e in month_expense_items)
            if month_expense_items else template_expenses_total
        )
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
