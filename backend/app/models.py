from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    tenant_liable_for_water = Column(Boolean, default=False)
    weekly_rent = Column(Numeric(10, 2), nullable=True, default=0)
    pm_fee_pct = Column(Numeric(5, 4), nullable=True, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    expenses = relationship("ExpenseItem", back_populates="property")
    income = relationship("IncomeItem", back_populates="property")
    templates = relationship("RecurringTemplate", back_populates="property")


class RecurringTemplate(Base):
    __tablename__ = "recurring_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    frequency = Column(String, nullable=False, default="monthly")
    day_of_month = Column(Integer, nullable=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    property = relationship("Property", back_populates="templates")
    expenses = relationship("ExpenseItem", back_populates="template")


class ExpenseItem(Base):
    __tablename__ = "expense_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), nullable=True, default=0)
    due_date = Column(DateTime(timezone=True), nullable=False)
    paid_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="pending")  # pending, partial, paid, overdue, funded
    notes = Column(Text, nullable=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    template_id = Column(Integer, ForeignKey("recurring_templates.id"), nullable=True)
    is_recurring = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    property = relationship("Property", back_populates="expenses")
    template = relationship("RecurringTemplate", back_populates="expenses")


class IncomeItem(Base):
    __tablename__ = "income_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # salary, rental, reimbursement, other
    amount = Column(Numeric(10, 2), nullable=False)
    received_date = Column(DateTime(timezone=True), nullable=True)
    expected_date = Column(DateTime(timezone=True), nullable=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    reimbursement_status = Column(String, nullable=True)  # pending, received
    notes = Column(Text, nullable=True)
    is_recurring = Column(Boolean, default=False)
    frequency = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    property = relationship("Property", back_populates="income")
