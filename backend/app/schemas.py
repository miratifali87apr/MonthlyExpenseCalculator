from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Property
# ---------------------------------------------------------------------------

class PropertyBase(BaseModel):
    name: str
    address: Optional[str] = None
    tenant_liable_for_water: bool = False
    weekly_rent: Optional[float] = 0
    pm_fee_pct: Optional[float] = 0


class PropertyCreate(PropertyBase):
    pass


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    tenant_liable_for_water: Optional[bool] = None
    weekly_rent: Optional[float] = None
    pm_fee_pct: Optional[float] = None


class PropertyResponse(PropertyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def model_post_init(self, __context):
        if isinstance(self.weekly_rent, Decimal):
            object.__setattr__(self, "weekly_rent", float(self.weekly_rent))
        if isinstance(self.pm_fee_pct, Decimal):
            object.__setattr__(self, "pm_fee_pct", float(self.pm_fee_pct))


# ---------------------------------------------------------------------------
# Recurring Template
# ---------------------------------------------------------------------------

class RecurringTemplateBase(BaseModel):
    name: str
    category: str
    amount: float
    frequency: str = "monthly"
    day_of_month: Optional[int] = None
    month_of_year: Optional[int] = None  # 1-12, only used when frequency='yearly'
    property_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool = True


class RecurringTemplateCreate(RecurringTemplateBase):
    pass


class RecurringTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    day_of_month: Optional[int] = None
    month_of_year: Optional[int] = None
    property_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class RecurringTemplateResponse(RecurringTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    property: Optional[PropertyResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def model_post_init(self, __context):
        # Coerce Decimal to float
        if isinstance(self.amount, Decimal):
            object.__setattr__(self, "amount", float(self.amount))


# ---------------------------------------------------------------------------
# Expense Item
# ---------------------------------------------------------------------------

class ExpenseItemBase(BaseModel):
    name: str
    category: str
    amount: float
    amount_paid: float = 0
    due_date: datetime
    paid_date: Optional[datetime] = None
    status: str = "pending"
    notes: Optional[str] = None
    property_id: Optional[int] = None
    template_id: Optional[int] = None
    is_recurring: bool = False


class ExpenseItemCreate(ExpenseItemBase):
    pass


class ExpenseItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    property_id: Optional[int] = None
    template_id: Optional[int] = None
    is_recurring: Optional[bool] = None


class ExpenseItemResponse(ExpenseItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    property: Optional[PropertyResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def model_post_init(self, __context):
        if isinstance(self.amount, Decimal):
            object.__setattr__(self, "amount", float(self.amount))
        if isinstance(self.amount_paid, Decimal):
            object.__setattr__(self, "amount_paid", float(self.amount_paid))


# ---------------------------------------------------------------------------
# Income Item
# ---------------------------------------------------------------------------

class IncomeItemBase(BaseModel):
    name: str
    type: str
    amount: float
    received_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    property_id: Optional[int] = None
    reimbursement_status: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: bool = False
    frequency: Optional[str] = None


class IncomeItemCreate(IncomeItemBase):
    pass


class IncomeItemUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    amount: Optional[float] = None
    received_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    property_id: Optional[int] = None
    reimbursement_status: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: Optional[bool] = None
    frequency: Optional[str] = None


class IncomeItemResponse(IncomeItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    property: Optional[PropertyResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def model_post_init(self, __context):
        if isinstance(self.amount, Decimal):
            object.__setattr__(self, "amount", float(self.amount))


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class CashflowTrend(BaseModel):
    month: str  # e.g. "2024-01"
    income: float
    expenses: float
    net: float


class DashboardSummary(BaseModel):
    total_monthly_income: float
    total_monthly_expenses: float
    net_cashflow: float
    upcoming_7_days: list[ExpenseItemResponse]
    upcoming_30_days: list[ExpenseItemResponse]
    overdue_items: list[ExpenseItemResponse]
    next_unfunded: list[ExpenseItemResponse]
    pending_reimbursements: list[IncomeItemResponse]
    cashflow_trend: list[CashflowTrend]


# ---------------------------------------------------------------------------
# Property Summary
# ---------------------------------------------------------------------------

class PropertySummary(BaseModel):
    property: PropertyResponse
    total_income: float
    total_expenses: float
    net_cashflow: float
    expense_breakdown: dict[str, float]
