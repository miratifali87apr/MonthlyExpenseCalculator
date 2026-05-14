
import calendar
from datetime import date as date_type, datetime, timezone
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


@router.get("", response_model=List[RecurringTemplateResponse])
def list_recurring_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    templates = (
        db.query(models.RecurringTemplate)
        .filter(models.RecurringTemplate.user_id == current_user.id)
        .order_by(
            models.RecurringTemplate.day_of_month.asc().nulls_last(),
            models.RecurringTemplate.name.asc(),
        )
        .all()
    )
    return [RecurringTemplateResponse.model_validate(t) for t in templates]


@router.post("", response_model=RecurringTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_template(
    data: RecurringTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    template = models.RecurringTemplate(**data.model_dump(), user_id=current_user.id)
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
        .filter(
            models.RecurringTemplate.id == template_id,
            models.RecurringTemplate.user_id == current_user.id,
        )
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
        .filter(
            models.RecurringTemplate.id == template_id,
            models.RecurringTemplate.user_id == current_user.id,
        )
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
    Generate expense items from the current user's active recurring templates for a given month/year.
    Defaults to next month if not specified.
    Skips any template+month combination that already has an expense item.
    """
    now = datetime.now(timezone.utc)
    today = now.date()

    target_month = month if month is not None else today.month
    target_year = year if year is not None else today.year

    active_templates = (
        db.query(models.RecurringTemplate)
        .filter(
            models.RecurringTemplate.user_id == current_user.id,
            models.RecurringTemplate.is_active == True,
        )
        .all()
    )

    generated_count = 0

    for template in active_templates:
        # Yearly templates only fire in their designated month
        if template.frequency == "yearly":
            desired_month = template.month_of_year or 1
            if target_month != desired_month:
                continue

        day = template.day_of_month or 1
        max_day = calendar.monthrange(target_year, target_month)[1]

        existing = (
            db.query(models.ExpenseItem)
            .filter(
                models.ExpenseItem.template_id == template.id,
                models.ExpenseItem.user_id == current_user.id,
                models.ExpenseItem.is_recurring == True,
            )
            .all()
        )

        # For weekly/fortnightly, generate one expense per occurrence in the month
        if template.frequency in ("weekly", "fortnightly"):
            step = 7 if template.frequency == "weekly" else 14
            existing_dates = {
                e.due_date.date() for e in existing if e.due_date
            }
            current_day = min(day, max_day)
            while current_day <= max_day:
                occurrence_date = date_type(target_year, target_month, current_day)
                if occurrence_date not in existing_dates:
                    due_dt = datetime(target_year, target_month, current_day, tzinfo=timezone.utc)
                    item_status = "overdue" if due_dt < now else "pending"
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
                current_day += step
        else:
            # Single occurrence per month (monthly, quarterly, ad_hoc, yearly)
            already_exists = any(
                e.due_date and e.due_date.year == target_year and e.due_date.month == target_month
                for e in existing
            )
            if already_exists:
                continue

            clamped_day = min(day, max_day)
            due_dt = datetime(target_year, target_month, clamped_day, tzinfo=timezone.utc)
            item_status = "overdue" if due_dt < now else "pending"
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
