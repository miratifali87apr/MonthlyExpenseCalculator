"""Tests for /api/notify/overdue endpoint."""
from unittest.mock import patch

# All tests that call /overdue must set NOTIFY_SECRET (the endpoint now
# returns 503 when the secret is unconfigured — a security hardening).
_SECRET = "test-notify-secret"
_SECRET_HEADER = {"X-Notify-Secret": _SECRET}


def _overdue_expense(name="Overdue Bill", amount=500):
    return {"name": name, "category": "utility", "amount": amount, "due_date": "2020-01-01T00:00:00", "status": "pending"}


def _with_secret(monkeypatch):
    monkeypatch.setattr("app.routers.notify.NOTIFY_SECRET", _SECRET)


def test_notify_overdue_no_bills(client, monkeypatch):
    """With no overdue bills, endpoint returns 0 sent."""
    _with_secret(monkeypatch)
    with patch("app.routers.notify._send_email", return_value=(True, None)):
        res = client.post("/api/notify/overdue", headers=_SECRET_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data["sent"] == 0
    assert data["users_with_overdue"] == 0


def test_notify_overdue_with_bills(client, auth_headers, user, monkeypatch):
    """Users with overdue bills get an email attempt."""
    _with_secret(monkeypatch)
    client.post("/api/expenses", json=_overdue_expense(), headers=auth_headers)
    with patch("app.routers.notify._send_email", return_value=(True, None)) as mock_send:
        res = client.post("/api/notify/overdue", headers=_SECRET_HEADER)
    assert res.status_code == 200
    data = res.json()
    assert data["users_with_overdue"] == 1
    assert data["sent"] == 1
    mock_send.assert_called_once()


def test_notify_overdue_email_called_with_correct_address(client, auth_headers, user, monkeypatch):
    """_send_email should be called with the user's email."""
    _with_secret(monkeypatch)
    client.post("/api/expenses", json=_overdue_expense(), headers=auth_headers)
    with patch("app.routers.notify._send_email", return_value=(True, None)) as mock_send:
        client.post("/api/notify/overdue", headers=_SECRET_HEADER)
    args = mock_send.call_args[0]
    assert args[0] == "test@example.com"


def test_notify_only_counts_overdue_not_paid(client, auth_headers, user, monkeypatch):
    """Paid bills should not trigger a notification."""
    _with_secret(monkeypatch)
    payload = {"name": "Paid Old", "category": "utility", "amount": 200, "due_date": "2020-01-01T00:00:00", "status": "paid"}
    client.post("/api/expenses", json=payload, headers=auth_headers)
    with patch("app.routers.notify._send_email", return_value=(True, None)):
        res = client.post("/api/notify/overdue", headers=_SECRET_HEADER)
    assert res.json()["users_with_overdue"] == 0


def test_notify_email_send_failure_not_counted(client, auth_headers, user, monkeypatch):
    """If _send_email returns False, sent count stays 0."""
    _with_secret(monkeypatch)
    client.post("/api/expenses", json=_overdue_expense(), headers=auth_headers)
    with patch("app.routers.notify._send_email", return_value=(False, "send error")):
        res = client.post("/api/notify/overdue", headers=_SECRET_HEADER)
    data = res.json()
    assert data["users_with_overdue"] == 1
    assert data["sent"] == 0


def test_notify_rejects_when_secret_unset(client):
    """If NOTIFY_SECRET is empty, endpoint returns 503."""
    res = client.post("/api/notify/overdue")
    assert res.status_code == 503


def test_notify_secret_header_enforced(client, auth_headers, user, monkeypatch):
    """If NOTIFY_SECRET is set, requests without the header are rejected."""
    monkeypatch.setattr("app.routers.notify.NOTIFY_SECRET", "supersecret")
    res = client.post("/api/notify/overdue")
    assert res.status_code == 401


def test_notify_correct_secret_passes(client, auth_headers, user, monkeypatch):
    """Correct X-Notify-Secret header should pass through."""
    monkeypatch.setattr("app.routers.notify.NOTIFY_SECRET", "supersecret")
    client.post("/api/expenses", json=_overdue_expense(), headers=auth_headers)
    with patch("app.routers.notify._send_email", return_value=(True, None)):
        res = client.post("/api/notify/overdue", headers={"X-Notify-Secret": "supersecret"})
    assert res.status_code == 200
    assert res.json()["users_with_overdue"] == 1


def test_notify_groups_multiple_bills_per_user(client, auth_headers, user, monkeypatch):
    """Multiple overdue bills for one user should be grouped into one email."""
    _with_secret(monkeypatch)
    client.post("/api/expenses", json=_overdue_expense("Bill A", 300), headers=auth_headers)
    client.post("/api/expenses", json=_overdue_expense("Bill B", 200), headers=auth_headers)
    with patch("app.routers.notify._send_email", return_value=(True, None)) as mock_send:
        res = client.post("/api/notify/overdue", headers=_SECRET_HEADER)
    data = res.json()
    assert data["users_with_overdue"] == 1
    assert data["sent"] == 1
    # Should be called once (one email per user, not per bill)
    assert mock_send.call_count == 1
