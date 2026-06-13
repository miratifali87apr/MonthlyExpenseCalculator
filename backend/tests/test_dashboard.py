"""Tests for /api/dashboard/summary endpoint."""
from datetime import datetime, timedelta, timezone


def _expense(name="Mortgage", amount=1500, days_offset=5):
    due = (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()
    return {"name": name, "category": "loan", "amount": amount, "due_date": due, "status": "pending"}


def _income(name="Salary", amount=5000, type_="salary"):
    expected = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    return {"name": name, "type": type_, "amount": amount, "expected_date": expected}


def test_dashboard_summary_empty(client, auth_headers):
    res = client.get("/api/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_monthly_income"] == 0.0
    assert data["total_monthly_expenses"] == 0.0
    assert data["net_cashflow"] == 0.0
    assert data["upcoming_7_days"] == []
    assert data["upcoming_30_days"] == []
    assert data["overdue_items"] == []
    assert data["next_unfunded"] == []
    assert data["pending_reimbursements"] == []
    assert len(data["cashflow_trend"]) == 6


def test_dashboard_requires_auth(client):
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 401


def test_dashboard_upcoming_7_days(client, auth_headers):
    # Expense due in 3 days — should appear in upcoming_7_days
    client.post("/api/expenses", json=_expense(days_offset=3), headers=auth_headers)
    res = client.get("/api/dashboard/summary", headers=auth_headers)
    assert len(res.json()["upcoming_7_days"]) == 1


def test_dashboard_upcoming_30_days(client, auth_headers):
    # Expense due in 20 days — not in 7-day window but in 30-day window
    client.post("/api/expenses", json=_expense(days_offset=20), headers=auth_headers)
    data = client.get("/api/dashboard/summary", headers=auth_headers).json()
    assert len(data["upcoming_7_days"]) == 0
    assert len(data["upcoming_30_days"]) == 1


def test_dashboard_overdue_items(client, auth_headers):
    # Expense due well in the past (use explicit past date to avoid timezone edge cases)
    payload = {"name": "Overdue Bill", "category": "utility", "amount": 200, "due_date": "2020-01-01T00:00:00", "status": "pending"}
    client.post("/api/expenses", json=payload, headers=auth_headers)
    data = client.get("/api/dashboard/summary", headers=auth_headers).json()
    assert len(data["overdue_items"]) == 1
    assert data["overdue_items"][0]["name"] == "Overdue Bill"


def test_dashboard_paid_expense_not_in_overdue(client, auth_headers):
    payload = {"name": "Paid Bill", "category": "utility", "amount": 200, "due_date": "2020-01-01T00:00:00", "status": "paid"}
    client.post("/api/expenses", json=payload, headers=auth_headers)
    data = client.get("/api/dashboard/summary", headers=auth_headers).json()
    assert data["overdue_items"] == []


def test_dashboard_pending_reimbursements(client, auth_headers):
    payload = _income(name="Reimbursement", type_="reimbursement")
    payload["reimbursement_status"] = "pending"
    client.post("/api/income", json=payload, headers=auth_headers)
    data = client.get("/api/dashboard/summary", headers=auth_headers).json()
    assert len(data["pending_reimbursements"]) == 1


def test_dashboard_cashflow_trend_has_6_months(client, auth_headers):
    data = client.get("/api/dashboard/summary", headers=auth_headers).json()
    trend = data["cashflow_trend"]
    assert len(trend) == 6
    for entry in trend:
        assert "month" in entry
        assert "income" in entry
        assert "expenses" in entry
        assert "net" in entry


def test_dashboard_isolation(client, auth_headers, pro_headers):
    """Each user sees only their own data."""
    # Add expense for main user
    client.post("/api/expenses", json=_expense(days_offset=3), headers=auth_headers)
    # Pro user's dashboard should not include it
    data = client.get("/api/dashboard/summary", headers=pro_headers).json()
    assert data["upcoming_7_days"] == []
