from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import PropertyCreate, PropertyUpdate, PropertyResponse, PropertySummary
from app.auth import get_current_user
from app.utils import monthly_equivalent

router = APIRouter()


@router.get("", response_model=List[PropertyResponse])
def list_properties(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    properties = (
        db.query(models.Property)
        .filter(models.Property.user_id == current_user.id)
        .order_by(models.Property.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [PropertyResponse.model_validate(p) for p in properties]


@router.post("", response_model=PropertyResponse, status_code=status.HTTP_201_CREATED)
def create_property(
    data: PropertyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    prop = models.Property(**data.model_dump(), user_id=current_user.id)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return PropertyResponse.model_validate(prop)


@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(
    property_id: int,
    data: PropertyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    prop = (
        db.query(models.Property)
        .filter(models.Property.id == property_id, models.Property.user_id == current_user.id)
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prop, field, value)

    db.commit()
    db.refresh(prop)
    return PropertyResponse.model_validate(prop)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    prop = (
        db.query(models.Property)
        .filter(models.Property.id == property_id, models.Property.user_id == current_user.id)
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(prop)
    db.commit()


@router.get("/{property_id}/summary", response_model=PropertySummary)
def get_property_summary(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    prop = (
        db.query(models.Property)
        .filter(models.Property.id == property_id, models.Property.user_id == current_user.id)
        .first()
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month

    income_items = (
        db.query(models.IncomeItem)
        .filter(
            models.IncomeItem.property_id == property_id,
            models.IncomeItem.user_id == current_user.id,
        )
        .all()
    )

    total_income = 0.0
    for item in income_items:
        if item.is_recurring:
            total_income += monthly_equivalent(float(item.amount), item.frequency or "monthly")
        else:
            rd = item.received_date
            if rd and rd.year == current_year and rd.month == current_month:
                total_income += float(item.amount)

    expense_items = (
        db.query(models.ExpenseItem)
        .filter(
            models.ExpenseItem.property_id == property_id,
            models.ExpenseItem.user_id == current_user.id,
        )
        .all()
    )
    expenses_this_month = [
        e for e in expense_items
        if e.due_date and e.due_date.year == current_year and e.due_date.month == current_month
    ]

    expense_breakdown: dict = {}

    if expenses_this_month:
        for e in expenses_this_month:
            cat = e.category or "other"
            expense_breakdown[cat] = expense_breakdown.get(cat, 0.0) + float(e.amount)
        total_expenses = sum(expense_breakdown.values())
    else:
        templates = (
            db.query(models.RecurringTemplate)
            .filter(
                models.RecurringTemplate.property_id == property_id,
                models.RecurringTemplate.user_id == current_user.id,
                models.RecurringTemplate.is_active == True,
            )
            .all()
        )
        for t in templates:
            cat = t.category or "other"
            expense_breakdown[cat] = expense_breakdown.get(cat, 0.0) + monthly_equivalent(float(t.amount), t.frequency or "monthly")
        total_expenses = sum(expense_breakdown.values())

    net_cashflow = total_income - total_expenses

    return PropertySummary(
        property=PropertyResponse.model_validate(prop),
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        net_cashflow=round(net_cashflow, 2),
        expense_breakdown={k: round(v, 2) for k, v in expense_breakdown.items()},
    )
