"""Tests for /api/export/tax-year endpoint."""
from datetime import datetime


def test_tax_year_export_requires_auth(client):
    res = client.get("/api/export/tax-year?fy=2025")
    assert res.status_code == 401


def test_tax_year_export_empty(client, auth_headers):
    res = client.get("/api/export/tax-year?fy=2025", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["expenses"] == []
    assert data["income"] == []
    assert data["summary"]["total_income"] == 0.0
    assert data["summary"]["total_expenses"] == 0.0
    assert data["summary"]["net"] == 0.0


def test_tax_year_export_includes_correct_fy(client, auth_headers):
    """Expenses with due_date in FY2025 (Jul 2024 – Jun 2025) should appear."""
    # Due date within FY2025
    payload = {
        "name": "Insurance",
        "category": "insurance",
        "amount": 1200,
        "due_date": "2025-01-15T00:00:00",
        "status": "paid",
    }
    client.post("/api/expenses", json=payload, headers=auth_headers)
    res = client.get("/api/export/tax-year?fy=2025", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["expenses"]) == 1
    assert data["expenses"][0]["name"] == "Insurance"


def test_tax_year_export_excludes_wrong_fy(client, auth_headers):
    """Expenses outside the requested FY should be excluded."""
    # Due date in FY2024 (Jul 2023 – Jun 2024)
    payload = {
        "name": "Old Expense",
        "category": "insurance",
        "amount": 500,
        "due_date": "2023-09-01T00:00:00",
        "status": "paid",
    }
    client.post("/api/expenses", json=payload, headers=auth_headers)
    res = client.get("/api/export/tax-year?fy=2025", headers=auth_headers)
    data = res.json()
    assert len(data["expenses"]) == 0


def test_tax_year_export_summary_totals(client, auth_headers):
    """Summary totals must match sum of returned items."""
    expense_payload = {
        "name": "Rates",
        "category": "council_rates",
        "amount": 800,
        "due_date": "2025-03-01T00:00:00",
        "status": "paid",
    }
    income_payload = {
        "name": "Rent",
        "type": "rental",
        "amount": 2600,
        "expected_date": "2025-03-01T00:00:00",
    }
    client.post("/api/expenses", json=expense_payload, headers=auth_headers)
    client.post("/api/income", json=income_payload, headers=auth_headers)
    data = client.get("/api/export/tax-year?fy=2025", headers=auth_headers).json()
    assert data["summary"]["total_expenses"] == 800.0
    assert data["summary"]["total_income"] == 2600.0
    assert data["summary"]["net"] == 1800.0


def test_tax_year_export_includes_property_name(client, auth_headers, property_):
    """Expenses linked to a property should show property name, not 'Personal'."""
    payload = {
        "name": "PM Fees",
        "category": "pm_fees",
        "amount": 300,
        "due_date": "2025-02-01T00:00:00",
        "status": "paid",
        "property_id": property_.id,
    }
    client.post("/api/expenses", json=payload, headers=auth_headers)
    data = client.get("/api/export/tax-year?fy=2025", headers=auth_headers).json()
    assert len(data["expenses"]) == 1
    assert data["expenses"][0]["property"] == "Test Property"


def test_tax_year_export_unlinked_shows_personal(client, auth_headers):
    payload = {
        "name": "Groceries",
        "category": "other",
        "amount": 200,
        "due_date": "2025-02-01T00:00:00",
        "status": "paid",
    }
    client.post("/api/expenses", json=payload, headers=auth_headers)
    data = client.get("/api/export/tax-year?fy=2025", headers=auth_headers).json()
    assert data["expenses"][0]["property"] == "Personal"


def test_tax_year_export_isolation(client, auth_headers, pro_headers):
    """Users should only see their own data."""
    payload = {
        "name": "My Expense",
        "category": "insurance",
        "amount": 999,
        "due_date": "2025-05-01T00:00:00",
        "status": "paid",
    }
    client.post("/api/expenses", json=payload, headers=auth_headers)
    data = client.get("/api/export/tax-year?fy=2025", headers=pro_headers).json()
    assert len(data["expenses"]) == 0


def test_tax_year_requires_fy_param(client, auth_headers):
    res = client.get("/api/export/tax-year", headers=auth_headers)
    assert res.status_code == 422
