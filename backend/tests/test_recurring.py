"""Tests for /api/recurring endpoints."""
from datetime import datetime


def _template(name="Mortgage", amount=1500, category="loan", frequency="monthly", day_of_month=1):
    return {
        "name": name,
        "category": category,
        "amount": amount,
        "frequency": frequency,
        "day_of_month": day_of_month,
    }


def test_list_recurring_empty(client, auth_headers):
    res = client.get("/api/recurring", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_create_recurring_template(client, auth_headers):
    res = client.post("/api/recurring", json=_template(), headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Mortgage"
    assert data["amount"] == 1500.0
    assert data["frequency"] == "monthly"
    assert data["is_active"] is True


def test_create_recurring_validates_required_fields(client, auth_headers):
    res = client.post("/api/recurring", json={"category": "loan"}, headers=auth_headers)
    assert res.status_code == 422


def test_update_recurring_template(client, auth_headers):
    create = client.post("/api/recurring", json=_template(), headers=auth_headers).json()
    res = client.put(f"/api/recurring/{create['id']}", json={"amount": 1600, "name": "Updated Mortgage"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["amount"] == 1600.0
    assert res.json()["name"] == "Updated Mortgage"


def test_deactivate_recurring_template(client, auth_headers):
    create = client.post("/api/recurring", json=_template(), headers=auth_headers).json()
    res = client.delete(f"/api/recurring/{create['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["message"] == "deactivated"
    # Template still listed but is_active = False
    templates = client.get("/api/recurring", headers=auth_headers).json()
    match = next((t for t in templates if t["id"] == create["id"]), None)
    assert match is not None
    assert match["is_active"] is False


def test_generate_from_templates(client, auth_headers):
    client.post("/api/recurring", json=_template(), headers=auth_headers)
    now = datetime.utcnow()
    res = client.post(
        f"/api/recurring/generate?month={now.month}&year={now.year}",
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["generated"] == 1


def test_generate_skips_duplicates(client, auth_headers):
    client.post("/api/recurring", json=_template(), headers=auth_headers)
    now = datetime.utcnow()
    params = f"?month={now.month}&year={now.year}"
    client.post(f"/api/recurring/generate{params}", headers=auth_headers)
    # Second generate in same month should skip
    res = client.post(f"/api/recurring/generate{params}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["generated"] == 0


def test_generate_skips_inactive_templates(client, auth_headers):
    create = client.post("/api/recurring", json=_template(), headers=auth_headers).json()
    client.delete(f"/api/recurring/{create['id']}", headers=auth_headers)
    now = datetime.utcnow()
    res = client.post(
        f"/api/recurring/generate?month={now.month}&year={now.year}",
        headers=auth_headers,
    )
    assert res.json()["generated"] == 0


def test_recurring_isolation(client, auth_headers, pro_headers):
    create = client.post("/api/recurring", json=_template(), headers=auth_headers).json()
    res = client.get("/api/recurring", headers=pro_headers)
    assert all(t["id"] != create["id"] for t in res.json())


def test_update_nonexistent_template(client, auth_headers):
    res = client.put("/api/recurring/99999", json={"amount": 100}, headers=auth_headers)
    assert res.status_code == 404
