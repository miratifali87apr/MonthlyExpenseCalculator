from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import extract, or_, and_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models
from app.schemas import IncomeItemCreate, IncomeItemUpdate, IncomeItemResponse
from app.auth import get_current_user

router = APIRouter()


@router.get("", response_model=List[IncomeItemResponse])
def list_income(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    type: Optional[str] = Query(None),
    property_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.IncomeItem)
        .options(joinedload(models.IncomeItem.property))
        .filter(models.IncomeItem.user_id == current_user.id)
    )

    if type is not None:
        query = query.filter(models.IncomeItem.type == type)
    if property_id is not None:
        query = query.filter(models.IncomeItem.property_id == property_id)

    # SQL-level date filtering: match on expected_date or received_date,
    # and always include recurring items with no date.
    if year is not None or month is not None:
        date_conditions = []
        for col in (models.IncomeItem.expected_date, models.IncomeItem.received_date):
            parts = [col.isnot(None)]
            if year is not None:
                parts.append(extract("year", col) == year)
            if month is not None:
                parts.append(extract("month", col) == month)
            date_conditions.append(and_(*parts))
        # Always include recurring items that have no date at all
        no_date_recurring = and_(
            models.IncomeItem.expected_date.is_(None),
            models.IncomeItem.received_date.is_(None),
            models.IncomeItem.is_recurring == True,
        )
        query = query.filter(or_(*date_conditions, no_date_recurring))

    items = (
        query.order_by(
            models.IncomeItem.expected_date.desc().nulls_last(),
            models.IncomeItem.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [IncomeItemResponse.model_validate(i) for i in items]


@router.post("", response_model=IncomeItemResponse, status_code=status.HTTP_201_CREATED)
def create_income(
    data: IncomeItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    income = models.IncomeItem(**data.model_dump(), user_id=current_user.id)
    db.add(income)
    db.commit()
    db.refresh(income)
    return IncomeItemResponse.model_validate(income)


@router.put("/{income_id}", response_model=IncomeItemResponse)
def update_income(
    income_id: int,
    data: IncomeItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    income = (
        db.query(models.IncomeItem)
        .filter(models.IncomeItem.id == income_id, models.IncomeItem.user_id == current_user.id)
        .first()
    )
    if not income:
        raise HTTPException(status_code=404, detail="Income item not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(income, field, value)

    db.commit()
    db.refresh(income)
    return IncomeItemResponse.model_validate(income)


@router.delete("/{income_id}")
def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    income = (
        db.query(models.IncomeItem)
        .filter(models.IncomeItem.id == income_id, models.IncomeItem.user_id == current_user.id)
        .first()
    )
    if not income:
        raise HTTPException(status_code=404, detail="Income item not found")
    db.delete(income)
    db.commit()
    return {"message": "deleted"}


@router.patch("/{income_id}/receive", response_model=IncomeItemResponse)
def mark_received(
    income_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    income = (
        db.query(models.IncomeItem)
        .filter(models.IncomeItem.id == income_id, models.IncomeItem.user_id == current_user.id)
        .first()
    )
    if not income:
        raise HTTPException(status_code=404, detail="Income item not found")

    income.reimbursement_status = "received"
    income.received_date = datetime.now(timezone.utc)
    db.commit()
    db.refresh(income)
    return IncomeItemResponse.model_validate(income)
