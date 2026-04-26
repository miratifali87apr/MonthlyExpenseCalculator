"""Tests for /api/ai endpoints — focuses on plan gating (Pro-only).

AI endpoints make real calls to OpenAI/Anthropic which we don't want in tests.
We mock the _ai_text and _ai_vision helpers so tests verify auth/gating only.
"""
import io
import json
from unittest.mock import patch

import pytest


# ── Helpers ─────────────────────────────────────────────────────────────────

MOCK_PORTFOLIO_RESPONSE = json.dumps({
    "summary": "Good portfolio",
    "yield_estimate": 5.2,
    "risks": [],
    "recommendations": [],
})

MOCK_PREDICTOR_RESPONSE = json.dumps({
    "recommendation": "Buy",
    "rationale": "Strong yield",
    "estimated_yield": 5.0,
    "risks": [],
})

MOCK_STATEMENT_RESPONSE = json.dumps({
    "property_address": "123 Test St",
    "period": {"month": "March", "year": "2025"},
    "gross_rent": 2600.0,
    "management_fee": 208.0,
    "letting_fee": None,
    "maintenance_items": [],
    "total_expenses": 208.0,
    "net_to_owner": 2392.0,
})


# ── Plan gating: free user gets 403 ─────────────────────────────────────────

def test_free_user_cannot_analyze_portfolio(client, auth_headers):
    payload = {"properties": [], "expenses": [], "income": []}
    res = client.post("/api/ai/analyze-portfolio", json=payload, headers=auth_headers)
    assert res.status_code == 403
    assert "Pro plan" in res.json()["detail"]


def test_free_user_cannot_predict_purchase(client, auth_headers):
    payload = {"address": "1 Test St", "purchase_price": 500000, "weekly_rent": 400}
    res = client.post("/api/ai/purchase-predictor", json=payload, headers=auth_headers)
    assert res.status_code == 403


def test_free_user_cannot_parse_statement(client, auth_headers):
    file_data = io.BytesIO(b"fake image data")
    res = client.post(
        "/api/ai/parse-statement",
        files={"file": ("statement.jpg", file_data, "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 403


# ── Plan gating: pro user gets through (mocked AI calls) ─────────────────────

def test_pro_user_can_analyze_portfolio(client, pro_headers):
    payload = {
        "properties": [{"name": "My Place", "address": "1 Test St"}],
        "expenses": [],
        "rental_income": [],
    }
    with patch("app.routers.ai._ai_text", return_value=MOCK_PORTFOLIO_RESPONSE):
        res = client.post("/api/ai/analyze-portfolio", json=payload, headers=pro_headers)
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data or isinstance(data, dict)


def test_pro_user_can_predict_purchase(client, pro_headers):
    payload = {
        "address": "1 Investor Ave, Sydney",
        "purchase_price": 600000,
        "weekly_rent": 450,
        "loan_amount": 480000,
        "property_type": "house",
    }
    with patch("app.routers.ai._ai_text", return_value=MOCK_PREDICTOR_RESPONSE):
        res = client.post("/api/ai/purchase-predictor", json=payload, headers=pro_headers)
    assert res.status_code == 200


def test_pro_user_can_parse_statement(client, pro_headers):
    file_data = io.BytesIO(b"fake image data")
    with patch("app.routers.ai._ai_vision", return_value=MOCK_STATEMENT_RESPONSE):
        res = client.post(
            "/api/ai/parse-statement",
            files={"file": ("statement.jpg", file_data, "image/jpeg")},
            headers=pro_headers,
        )
    assert res.status_code == 200
    data = res.json()
    assert data["gross_rent"] == 2600.0


# ── Auth required ─────────────────────────────────────────────────────────────

def test_ai_analyze_requires_auth(client):
    res = client.post("/api/ai/analyze-portfolio", json={})
    assert res.status_code == 401


def test_ai_parse_requires_auth(client):
    file_data = io.BytesIO(b"fake")
    res = client.post(
        "/api/ai/parse-statement",
        files={"file": ("s.jpg", file_data, "image/jpeg")},
    )
    assert res.status_code == 401
