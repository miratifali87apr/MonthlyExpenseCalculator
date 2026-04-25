from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import IncomeItemCreate, IncomeItemUpdate, IncomeItemResponse
from app.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[IncomeItemResponse])
def list_income(
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    type: Optional[str] = Query(None),
    property_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.IncomeItem).filter(models.IncomeItem.user_id == current_user.id)

    if type is not None:
        query = query.filter(models.IncomeItem.type == type)
    if property_id is not None:
        query = query.filter(models.IncomeItem.property_id == property_id)

    items = (
        query.order_by(
            models.IncomeItem.expected_date.desc().nulls_last(),
            models.IncomeItem.created_at.desc(),
        )
        .all()
    )

    if month is not None or year is not None:
        filtered = []
        for item in items:
            ref_date = item.expected_date or item.received_date
            if ref_date is None:
                if item.is_recurring:
                    filtered.append(item)
                continue
            if year is not None and ref_date.year != year:
                continue
            if month is not None and ref_date.month != month:
                continue
            filtered.append(item)
        items = filtered

    return [IncomeItemResponse.model_validate(i) for i in items]


@router.post("/", response_model=IncomeItemResponse, status_code=status.HTTP_201_CREATED)
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
