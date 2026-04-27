import calendar
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import ExpenseItemCreate, ExpenseItemUpdate, ExpenseItemResponse
from app.auth import get_current_user


class PartialPayRequest(BaseModel):
    amount: float

router = APIRouter()


def _resolve_status(expense: models.ExpenseItem) -> str:
    """Re-evaluate status: if pending and due_date is in the past, mark overdue."""
    if expense.status == "pending":
        now = datetime.now(timezone.utc)
        due = expense.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if due < now:
            return "overdue"
    return expense.status


@router.get("", response_model=List[ExpenseItemResponse])
def list_expenses(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    property_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.ExpenseItem).filter(models.ExpenseItem.user_id == current_user.id)

    if month is not None and year is not None:
        query = query.filter(models.ExpenseItem.due_date != None)  # noqa: E711
        items = query.order_by(models.ExpenseItem.due_date.desc()).all()
        items = [
            i for i in items
            if i.due_date and i.due_date.year == year and i.due_date.month == month
        ]
    elif year is not None:
        items = query.order_by(models.ExpenseItem.due_date.desc()).all()
        items = [i for i in items if i.due_date and i.due_date.year == year]
    else:
        if property_id is not None:
            query = query.filter(models.ExpenseItem.property_id == property_id)
        if status is not None:
            query = query.filter(models.ExpenseItem.status == status)
        if category is not None:
            query = query.filter(models.ExpenseItem.category == category)
        items = query.order_by(models.ExpenseItem.due_date.desc()).all()

    if month is not None or year is not None:
        if property_id is not None:
            items = [i for i in items if i.property_id == property_id]
        if status is not None:
            items = [i for i in items if i.status == status]
        if category is not None:
            items = [i for i in items if i.category == category]

    return [ExpenseItemResponse.model_validate(i) for i in items]


@router.post("", response_model=ExpenseItemResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: ExpenseItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = models.ExpenseItem(**data.model_dump(), user_id=current_user.id)

    now = datetime.now(timezone.utc)
    due = expense.due_date
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    if expense.status == "pending" and due < now:
        expense.status = "overdue"

    db.add(expense)
    db.commit()
    db.refresh(expense)
    return ExpenseItemResponse.model_validate(expense)


@router.put("/{expense_id}", response_model=ExpenseItemResponse)
def update_expense(
    expense_id: int,
    data: ExpenseItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = (
        db.query(models.ExpenseItem)
        .filter(models.ExpenseItem.id == expense_id, models.ExpenseItem.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)

    new_status = _resolve_status(expense)
    if expense.status != "paid":
        expense.status = new_status

    db.commit()
    db.refresh(expense)
    return ExpenseItemResponse.model_validate(expense)


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = (
        db.query(models.ExpenseItem)
        .filter(models.ExpenseItem.id == expense_id, models.ExpenseItem.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"message": "deleted"}


@router.patch("/{expense_id}/pay", response_model=ExpenseItemResponse)
def mark_paid(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = (
        db.query(models.ExpenseItem)
        .filter(models.ExpenseItem.id == expense_id, models.ExpenseItem.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.status = "paid"
    expense.paid_date = datetime.now(timezone.utc)
    db.commit()
    db.refresh(expense)
    return ExpenseItemResponse.model_validate(expense)


@router.patch("/{expense_id}/fund", response_model=ExpenseItemResponse)
def mark_funded(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = (
        db.query(models.ExpenseItem)
        .filter(models.ExpenseItem.id == expense_id, models.ExpenseItem.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense.status = "funded"
    db.commit()
    db.refresh(expense)
    return ExpenseItemResponse.model_validate(expense)


@router.patch("/{expense_id}/partial-pay", response_model=ExpenseItemResponse)
def partial_pay(
    expense_id: int,
    data: PartialPayRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = (
        db.query(models.ExpenseItem)
        .filter(models.ExpenseItem.id == expense_id, models.ExpenseItem.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    current_paid = float(expense.amount_paid or 0)
    new_paid = current_paid + data.amount
    total = float(expense.amount)

    expense.amount_paid = min(new_paid, total)

    if expense.amount_paid >= total:
        expense.status = "paid"
        expense.paid_date = datetime.now(timezone.utc)
    else:
        expense.status = "partial"

    db.commit()
    db.refresh(expense)
    return ExpenseItemResponse.model_validate(expense)


@router.patch("/{expense_id}/unpay", response_model=ExpenseItemResponse)
def mark_unpaid(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    expense = (
        db.query(models.ExpenseItem)
        .filter(models.ExpenseItem.id == expense_id, models.ExpenseItem.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.status = "pending"
    expense.paid_date = None
    db.commit()
    db.refresh(expense)
    return ExpenseItemResponse.model_validate(expense)


@router.post("/generate-upcoming")
def generate_upcoming_expenses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generate expense items from active recurring templates for the next 3 months.
    Skips months that already have an expense item for that template.
    Only generates for the current user's templates.
    """
    now = datetime.now(timezone.utc)
    today = now.date()
    generated_count = 0

    active_templates = (
        db.query(models.RecurringTemplate)
        .filter(
            models.RecurringTemplate.user_id == current_user.id,
            models.RecurringTemplate.is_active == True,
        )
        .all()
    )

    for template in active_templates:
        day = template.day_of_month or 1

        for month_offset in range(0, 3):
            # Yearly templates only fire in their designated month
            if template.frequency == "yearly":
                target_month_check = today.month + month_offset
                target_year_check = today.year
                while target_month_check > 12:
                    target_month_check -= 12
                    target_year_check += 1
                desired_month = template.month_of_year or 1
                if target_month_check != desired_month:
                    continue
            target_month = today.month + month_offset
            target_year = today.year
            while target_month > 12:
                target_month -= 12
                target_year += 1

            max_day = calendar.monthrange(target_year, target_month)[1]
            clamped_day = min(day, max_day)

            due_dt = datetime(target_year, target_month, clamped_day, tzinfo=timezone.utc)

            existing = (
                db.query(models.ExpenseItem)
                .filter(
                    models.ExpenseItem.template_id == template.id,
                    models.ExpenseItem.user_id == current_user.id,
                    models.ExpenseItem.is_recurring == True,
                )
                .all()
            )
            already_exists = any(
                e.due_date and e.due_date.year == target_year and e.due_date.month == target_month
                for e in existing
            )
            if already_exists:
                continue

            item_status = "pending"
            if due_dt < now:
                item_status = "overdue"

            expense = models.ExpenseItem(
                name=template.name,
                category=template.category,
                amount=template.amount,
                due_date=due_dt,
                status=item_status,
                property_id=template.property_id,
                template_id=template.id,
                is_recurring=True,
                notes=template.notes,
                user_id=current_user.id,
            )
            db.add(expense)
            generated_count += 1

    db.commit()
    return {"generated": generated_count}
