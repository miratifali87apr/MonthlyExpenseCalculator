
import calendar
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import (
    RecurringTemplateCreate,
    RecurringTemplateUpdate,
    RecurringTemplateResponse,
)
from app.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[RecurringTemplateResponse])
def list_recurring_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    templates = (
        db.query(models.RecurringTemplate)
        .order_by(
            models.RecurringTemplate.day_of_month.asc().nulls_last(),
            models.RecurringTemplate.name.asc(),
        )
        .all()
    )
    return [RecurringTemplateResponse.model_validate(t) for t in templates]


@router.post("/", response_model=RecurringTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_template(
    data: RecurringTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    template = models.RecurringTemplate(**data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return RecurringTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=RecurringTemplateResponse)
def update_recurring_template(
    template_id: int,
    data: RecurringTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    template = (
        db.query(models.RecurringTemplate)
        .filter(models.RecurringTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)
    return RecurringTemplateResponse.model_validate(template)


@router.delete("/{template_id}")
def deactivate_recurring_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Soft delete – sets is_active=False rather than removing the record."""
    template = (
        db.query(models.RecurringTemplate)
        .filter(models.RecurringTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found")

    template.is_active = False
    db.commit()
    return {"message": "deactivated"}


@router.post("/generate")
def generate_from_templates(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Generate expense items from all active recurring templates for a given month/year.
    Defaults to next month if not specified.
    Skips any template+month combination that already has an expense item.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    # Default: next month
    if month is None or year is None:
        next_month = today.month + 1
        next_year = today.year
        if next_month > 12:
            next_month = 1
            next_year += 1
        target_month = month if month is not None else next_month
        target_year = year if year is not None else next_year
    else:
        target_month = month
        target_year = year

    active_templates = (
        db.query(models.RecurringTemplate)
        .filter(models.RecurringTemplate.is_active == True)
        .all()
    )

    generated_count = 0

    for template in active_templates:
        day = template.day_of_month or 1
        max_day = calendar.monthrange(target_year, target_month)[1]
        clamped_day = min(day, max_day)

        due_dt = datetime(target_year, target_month, clamped_day, tzinfo=timezone.utc)

        # Check if expense item already exists for this template + year + month
        existing = (
            db.query(models.ExpenseItem)
            .filter(
                models.ExpenseItem.template_id == template.id,
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
        )
        db.add(expense)
        generated_count += 1

    db.commit()
    return {"generated": generated_count}
