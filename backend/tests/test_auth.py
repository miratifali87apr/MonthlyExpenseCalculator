"""Tests for /api/auth endpoints."""
import pytest


def test_login_success(client, user):
    res = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client, user):
    res = client.post("/api/auth/login", json={"email": "test@example.com", "password": "wrongpass"})
    assert res.status_code == 401


def test_login_unknown_email(client):
    res = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "pass"})
    assert res.status_code == 401


def test_get_me(client, auth_headers, user):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "test@example.com"
    assert data["plan"] == "free"


def test_get_me_unauthenticated(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_get_me_pro_user(client, pro_headers):
    res = client.get("/api/auth/me", headers=pro_headers)
    assert res.status_code == 200
    assert res.json()["plan"] == "pro"
