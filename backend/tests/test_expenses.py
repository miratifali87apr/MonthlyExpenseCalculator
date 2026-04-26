"""Tests for /api/expenses endpoints."""
from datetime import datetime, timedelta


def _expense(name="Mortgage", amount=1500, days_offset=5, status="pending", property_id=None):
    due = (datetime.utcnow() + timedelta(days=days_offset)).isoformat()
    payload = {"name": name, "category": "loan", "amount": amount, "due_date": due, "status": status}
    if property_id:
        payload["property_id"] = property_id
    return payload


def test_list_expenses_empty(client, auth_headers):
    res = client.get("/api/expenses", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_create_expense(client, auth_headers):
    res = client.post("/api/expenses", json=_expense(), headers=auth_headers)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["name"] == "Mortgage"
    assert data["amount"] == 1500.0
    assert data["status"] == "pending"


def test_create_expense_validates_required_fields(client, auth_headers):
    res = client.post("/api/expenses", json={"category": "loan"}, headers=auth_headers)
    assert res.status_code == 422


def test_update_expense(client, auth_headers):
    create = client.post("/api/expenses", json=_expense(), headers=auth_headers).json()
    res = client.put(f"/api/expenses/{create['id']}", json={"name": "Updated", "amount": 2000}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Updated"
    assert res.json()["amount"] == 2000.0


def test_mark_paid(client, auth_headers):
    create = client.post("/api/expenses", json=_expense(), headers=auth_headers).json()
    res = client.patch(f"/api/expenses/{create['id']}/pay", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "paid"


def test_undo_paid(client, auth_headers):
    create = client.post("/api/expenses", json=_expense(), headers=auth_headers).json()
    client.patch(f"/api/expenses/{create['id']}/pay", headers=auth_headers)
    res = client.patch(f"/api/expenses/{create['id']}/unpay", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "pending"


def test_fund_expense(client, auth_headers):
    create = client.post("/api/expenses", json=_expense(), headers=auth_headers).json()
    res = client.patch(f"/api/expenses/{create['id']}/fund", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "funded"


def test_partial_pay(client, auth_headers):
    create = client.post("/api/expenses", json=_expense(amount=1000), headers=auth_headers).json()
    res = client.patch(f"/api/expenses/{create['id']}/partial-pay", json={"amount": 400}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "partial"
    assert float(data["amount_paid"]) == 400.0


def test_delete_expense(client, auth_headers):
    create = client.post("/api/expenses", json=_expense(), headers=auth_headers).json()
    res = client.delete(f"/api/expenses/{create['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert client.get("/api/expenses", headers=auth_headers).json() == []


def test_filter_by_status(client, auth_headers):
    client.post("/api/expenses", json=_expense(status="paid"), headers=auth_headers)
    client.post("/api/expenses", json=_expense(name="Other", status="pending"), headers=auth_headers)
    res = client.get("/api/expenses?status=paid", headers=auth_headers)
    assert all(e["status"] == "paid" for e in res.json())


def test_expense_linked_to_property(client, auth_headers, property_):
    create = client.post("/api/expenses", json=_expense(property_id=property_.id), headers=auth_headers).json()
    assert create["property"]["id"] == property_.id


def test_cannot_access_others_expense(client, auth_headers, pro_headers):
    create = client.post("/api/expenses", json=_expense(), headers=auth_headers).json()
    res = client.put(f"/api/expenses/{create['id']}", json={"name": "Hack"}, headers=pro_headers)
    assert res.status_code in (403, 404)
