"""
seed.py – Idempotent database seeder for Finance Tracker.

Usage:
    python seed.py

Environment:
    DATABASE_URL  (optional, defaults to local dev connection string)
"""

import calendar
import os
import sys
from datetime import datetime, timezone, date

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Bootstrap – resolve DATABASE_URL before importing app modules
# ---------------------------------------------------------------------------
load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://finance_user:finance_pass@localhost:5432/finance_tracker",
)

# Patch the environment so app.config picks it up if it hasn't been imported yet
os.environ.setdefault("DATABASE_URL", DATABASE_URL)

# ---------------------------------------------------------------------------
# App imports
# ---------------------------------------------------------------------------
# Adjust path so we can import from 'app' package when running script directly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import Base  # noqa: E402
from app import models  # noqa: E402
from passlib.context import CryptContext  # noqa: E402

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# DB connection
# ---------------------------------------------------------------------------
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_or_create(db, model, defaults=None, **kwargs):
    """
    Fetch an existing record matching **kwargs filters, or create one with
    **kwargs merged with defaults dict.
    Returns (instance, created: bool).
    """
    instance = db.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = {**kwargs, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def clamp_day(year: int, month: int, day: int) -> int:
    """Return day clamped to the last valid day of the given month."""
    return min(day, calendar.monthrange(year, month)[1])


def status_for_due_date(due_dt: datetime) -> str:
    """Return 'paid', 'overdue', or 'pending' based on the due datetime vs now."""
    now = datetime.now(timezone.utc)
    if due_dt < now:
        return "overdue"
    return "pending"


def make_due_dt(year: int, month: int, day: int) -> datetime:
    d = clamp_day(year, month, day)
    return datetime(year, month, d, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Main seeder
# ---------------------------------------------------------------------------
def seed():
    print("=" * 60)
    print("Finance Tracker – Database Seeder")
    print("=" * 60)
    print(f"Connecting to: {DATABASE_URL[:50]}...")

    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Tables ensured.")

    db = SessionLocal()
    try:
        _seed_all(db)
        db.commit()
        print("\nSeed completed successfully.")
    except Exception as exc:
        db.rollback()
        print(f"\nSeed FAILED: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


def _seed_all(db):
    # ------------------------------------------------------------------
    # 1. Admin user
    # ------------------------------------------------------------------
    print("\n[1] Users")
    user, created = get_or_create(
        db,
        models.User,
        defaults={
            "password": pwd_context.hash("admin123"),
            "name": "Admin User",
        },
        email="admin@finance.local",
    )
    print(f"    {'Created' if created else 'Exists '} → {user.email}")

    # ------------------------------------------------------------------
    # 2. Properties
    # ------------------------------------------------------------------
    print("\n[2] Properties")
    properties_data = [
        # (name, address, tenant_liable_for_water, weekly_rent, pm_fee_pct)
        ("Austral",  "Austral NSW",        False, 0,   0.0),
        ("Kirwan",   "Kirwan QLD 4817",    True,  600, 0.077),
        ("Finley",   "Finley NSW 2713",    True,  530, 0.066),
        ("Chigwell", "Chigwell TAS 7011",  True,  580, 0.060),
        ("Temora",   "Temora NSW 2666",    True,  0,   0.0),
    ]
    props: dict[str, models.Property] = {}

    for pname, address, tenant_liable, weekly_rent, pm_fee_pct in properties_data:
        prop, created = get_or_create(
            db,
            models.Property,
            defaults={
                "address": address,
                "tenant_liable_for_water": tenant_liable,
                "weekly_rent": weekly_rent,
                "pm_fee_pct": pm_fee_pct,
            },
            name=pname,
        )
        # Update existing records with rent data
        if not created:
            prop.weekly_rent = weekly_rent
            prop.pm_fee_pct = pm_fee_pct
            db.flush()
        props[pname] = prop
        print(f"    {'Created' if created else 'Updated'} → {pname} (${weekly_rent}/wk)")

    # ------------------------------------------------------------------
    # 3. Recurring templates
    # ------------------------------------------------------------------
    print("\n[3] Recurring Templates")

    templates_data = [
        # (name, category, amount, frequency, day_of_month, property_key)
        ("Kirwan Home Loan",              "loan",      2559.28, "monthly", 1,  "Kirwan"),
        ("Temora Land Loan",              "loan",       995.00, "monthly", 1,  "Temora"),
        ("Chigwell AAMI Landlord Insurance", "insurance", 97.74, "monthly", 3, "Chigwell"),
        ("Austral Home Loan",             "loan",      3474.11, "monthly", 14, "Austral"),
        ("Finley Home Loan",              "loan",      2635.01, "monthly", 14, "Finley"),
        ("Finley Insurance",              "insurance",  121.64, "monthly", 14, "Finley"),
        ("Kirwan Landlord Insurance",     "insurance",  394.62, "monthly", 19, "Kirwan"),
        ("Austral Home Insurance",        "insurance",  202.68, "monthly", 20, "Austral"),
        ("Chigwell Loan",                 "loan",      2477.00, "monthly", 23, "Chigwell"),
        ("Temora Build Loan",             "loan",      1802.00, "monthly", 25, "Temora"),
        ("Geely Car Loan",                "car",       1290.60, "monthly", 1,  None),
        ("Geely Car Insurance",           "car",        195.65, "monthly", 1,  None),
    ]

    template_objects: dict[str, models.RecurringTemplate] = {}

    for name, category, amount, frequency, day_of_month, prop_key in templates_data:
        prop_id = props[prop_key].id if prop_key else None
        template, created = get_or_create(
            db,
            models.RecurringTemplate,
            defaults={
                "category": category,
                "amount": amount,
                "frequency": frequency,
                "day_of_month": day_of_month,
                "property_id": prop_id,
                "is_active": True,
            },
            name=name,
        )
        template_objects[name] = template
        print(f"    {'Created' if created else 'Exists '} → {name} (${amount:,.2f}/mo, day {day_of_month})")

    # ------------------------------------------------------------------
    # 4. Income items (recurring)
    # ------------------------------------------------------------------
    print("\n[4] Income Items")

    income_data = [
        # (name, type, amount, frequency, property_key)
        ("Salary",       "salary",  10000.00, "monthly",     None),
        ("Finley Rent",  "rental",   2296.67, "monthly",     "Finley"),   # 530*52/12
        ("Kirwan Rent",  "rental",   2600.00, "monthly",     "Kirwan"),   # 600*52/12
        ("Chigwell Rent","rental",   2513.33, "monthly",     "Chigwell"), # 580*52/12
    ]

    for name, inc_type, amount, frequency, prop_key in income_data:
        prop_id = props[prop_key].id if prop_key else None
        income, created = get_or_create(
            db,
            models.IncomeItem,
            defaults={
                "type": inc_type,
                "amount": amount,
                "frequency": frequency,
                "property_id": prop_id,
                "is_recurring": True,
            },
            name=name,
        )
        print(f"    {'Created' if created else 'Exists '} → {name} (${amount:,.2f}/mo)")

    # ------------------------------------------------------------------
    # 5. Generate expense items: previous month, current month, next month
    # ------------------------------------------------------------------
    print("\n[5] Expense Items (from templates)")

    today = date.today()
    current_year = today.year
    current_month = today.month

    # Build list of (year, month) for last, current, next months
    def month_offset(year, month, delta):
        m = month + delta
        y = year
        while m > 12:
            m -= 12
            y += 1
        while m < 1:
            m += 12
            y -= 1
        return y, m

    target_months = [
        month_offset(current_year, current_month, -1),
        (current_year, current_month),
        month_offset(current_year, current_month, 1),
    ]

    generated_count = 0
    skipped_count = 0
    now = datetime.now(timezone.utc)

    # Reload templates fresh after flush
    all_templates = db.query(models.RecurringTemplate).filter(
        models.RecurringTemplate.is_active == True
    ).all()

    for template in all_templates:
        day = template.day_of_month or 1

        for t_year, t_month in target_months:
            due_dt = make_due_dt(t_year, t_month, day)

            # Check for existing expense item for this template + year/month
            existing = (
                db.query(models.ExpenseItem)
                .filter(
                    models.ExpenseItem.template_id == template.id,
                    models.ExpenseItem.is_recurring == True,
                )
                .all()
            )
            already_exists = any(
                e.due_date and e.due_date.year == t_year and e.due_date.month == t_month
                for e in existing
            )
            if already_exists:
                skipped_count += 1
                continue

            item_status = status_for_due_date(due_dt)

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

    db.flush()
    print(f"    Generated {generated_count} expense items, skipped {skipped_count} (already existed)")

    # ------------------------------------------------------------------
    # 6. Upcoming one-off scheduled expenses
    # ------------------------------------------------------------------
    print("\n[6] Upcoming Scheduled Expenses")

    one_off_expenses = [
        # (name, category, amount, due_date_str, property_key, notes)
        ("BAS Instalment",        "tax",         2665.00, "2026-03-20", None,       None),
        ("Credit Card Bill",      "credit_card", 1258.21, "2026-03-28", None,       None),
        ("Water Consumption",     "utility",      102.30, "2026-03-31", "Finley",   "Tenant liable – reimbursement expected"),
        ("School Fees – Term 2",  "school_fees", 1900.00, "2026-04-02", None,       None),
        ("BAS Instalment",        "tax",         2665.00, "2026-04-03", None,       None),
        ("BAS Instalment",        "tax",         2665.00, "2026-04-17", None,       None),
        ("BAS Instalment",        "tax",         2665.00, "2026-05-01", None,       None),
        ("School Fees – Term 3",  "school_fees", 1900.00, "2026-07-02", None,       None),
        ("School Fees – Term 4",  "school_fees", 1900.00, "2026-09-02", None,       None),
    ]

    for name, category, amount, due_str, prop_key, notes in one_off_expenses:
        due_dt = datetime.strptime(due_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        prop_id = props[prop_key].id if prop_key else None

        existing = (
            db.query(models.ExpenseItem)
            .filter(
                models.ExpenseItem.name == name,
                models.ExpenseItem.due_date == due_dt,
                models.ExpenseItem.is_recurring == False,
            )
            .first()
        )
        if existing:
            print(f"    Exists  → {name} ({due_str})")
            continue

        item_status = status_for_due_date(due_dt)
        expense = models.ExpenseItem(
            name=name,
            category=category,
            amount=amount,
            due_date=due_dt,
            status=item_status,
            property_id=prop_id,
            is_recurring=False,
            notes=notes,
        )
        db.add(expense)
        print(f"    Created → {name} ({due_str}, ${amount:,.2f})")

    db.flush()

    # ------------------------------------------------------------------
    # 7. Pending reimbursements (income items)
    # ------------------------------------------------------------------
    print("\n[7] Pending Reimbursements")

    reimbursements = [
        # (name, amount, property_key, notes)
        ("Water Reimbursement – Finley",  102.30, "Finley",  "Recover from tenant"),
        ("Water Reimbursement – Kirwan",  278.32, "Kirwan",  "Recover from tenant"),
    ]

    for name, amount, prop_key, notes in reimbursements:
        prop_id = props[prop_key].id if prop_key else None
        reimbursement, created = get_or_create(
            db,
            models.IncomeItem,
            defaults={
                "type": "reimbursement",
                "amount": amount,
                "property_id": prop_id,
                "reimbursement_status": "pending",
                "notes": notes,
                "is_recurring": False,
            },
            name=name,
        )
        print(f"    {'Created' if created else 'Exists '} → {name} (${amount:,.2f})")

    db.flush()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("SEED SUMMARY")
    print("=" * 60)
    total_users = db.query(models.User).count()
    total_props = db.query(models.Property).count()
    total_templates = db.query(models.RecurringTemplate).count()
    total_income = db.query(models.IncomeItem).count()
    total_expenses = db.query(models.ExpenseItem).count()
    print(f"  Users:               {total_users}")
    print(f"  Properties:          {total_props}")
    print(f"  Recurring Templates: {total_templates}")
    print(f"  Income Items:        {total_income}")
    print(f"  Expense Items:       {total_expenses}")
    print("\nDefault login:")
    print("  Email:    admin@finance.local")
    print("  Password: admin123")
    print("=" * 60)


if __name__ == "__main__":
    seed()
