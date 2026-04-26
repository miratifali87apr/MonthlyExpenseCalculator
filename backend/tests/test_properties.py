"""Tests for /api/properties endpoints."""


def test_list_properties_empty(client, auth_headers):
    res = client.get("/api/properties", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_create_property(client, auth_headers):
    res = client.post("/api/properties", json={
        "name": "My Investment Property",
        "address": "456 Main St",
        "weekly_rent": 600,
        "pm_fee_pct": 0.08,
        "tenant_liable_for_water": True,
    }, headers=auth_headers)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["name"] == "My Investment Property"
    assert data["weekly_rent"] == 600.0
    assert data["id"] is not None


def test_create_property_name_required(client, auth_headers):
    res = client.post("/api/properties", json={
        "address": "No name property",
    }, headers=auth_headers)
    assert res.status_code == 422


def test_list_properties_returns_only_own(client, auth_headers, property_):
    res = client.get("/api/properties", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["name"] == "Test Property"


def test_update_property(client, auth_headers, property_):
    res = client.put(f"/api/properties/{property_.id}", json={
        "name": "Updated Name",
        "weekly_rent": 650,
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"
    assert res.json()["weekly_rent"] == 650.0


def test_delete_property(client, auth_headers, property_):
    res = client.delete(f"/api/properties/{property_.id}", headers=auth_headers)
    assert res.status_code in (200, 204)
    res2 = client.get("/api/properties", headers=auth_headers)
    assert res2.json() == []


def test_get_property_summary(client, auth_headers, property_):
    res = client.get(f"/api/properties/{property_.id}/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_income" in data
    assert "total_expenses" in data
    assert "net_cashflow" in data


def test_unauthenticated_access(client):
    res = client.get("/api/properties")
    assert res.status_code == 401
