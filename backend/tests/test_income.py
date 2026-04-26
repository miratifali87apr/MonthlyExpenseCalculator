"""Tests for /api/income endpoints."""
from datetime import datetime, timedelta


def _income(name="Salary", amount=5000, type_="salary", property_id=None):
    expected = (datetime.utcnow() + timedelta(days=1)).isoformat()
    payload = {"name": name, "type": type_, "amount": amount, "expected_date": expected}
    if property_id:
        payload["property_id"] = property_id
    return payload


def test_list_income_empty(client, auth_headers):
    res = client.get("/api/income", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_create_income(client, auth_headers):
    res = client.post("/api/income", json=_income(), headers=auth_headers)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["name"] == "Salary"
    assert data["amount"] == 5000.0
    assert data["type"] == "salary"


def test_create_rental_income(client, auth_headers, property_):
    res = client.post("/api/income", json=_income(name="Rent", type_="rental", property_id=property_.id), headers=auth_headers)
    assert res.status_code in (200, 201)
    assert res.json()["property"]["id"] == property_.id


def test_create_reimbursement(client, auth_headers):
    payload = _income(name="Water Reimbursement", type_="reimbursement")
    payload["reimbursement_status"] = "pending"
    res = client.post("/api/income", json=payload, headers=auth_headers)
    assert res.status_code in (200, 201)
    assert res.json()["reimbursement_status"] == "pending"


def test_mark_reimbursement_received(client, auth_headers):
    payload = _income(name="Reimbursement", type_="reimbursement")
    payload["reimbursement_status"] = "pending"
    create = client.post("/api/income", json=payload, headers=auth_headers).json()
    res = client.patch(f"/api/income/{create['id']}/receive", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["reimbursement_status"] == "received"


def test_update_income(client, auth_headers):
    create = client.post("/api/income", json=_income(), headers=auth_headers).json()
    res = client.put(f"/api/income/{create['id']}", json={"amount": 6000}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["amount"] == 6000.0


def test_delete_income(client, auth_headers):
    create = client.post("/api/income", json=_income(), headers=auth_headers).json()
    res = client.delete(f"/api/income/{create['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert client.get("/api/income", headers=auth_headers).json() == []


def test_income_isolation(client, auth_headers, pro_headers):
    create = client.post("/api/income", json=_income(), headers=auth_headers).json()
    res = client.get("/api/income", headers=pro_headers)
    assert all(i["id"] != create["id"] for i in res.json())
