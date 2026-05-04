"""Tests for /api/ai/extract-bill-text — verifies field extraction logic.

We mock pdfplumber text extraction so tests run without real PDFs or OCR.
"""
import io
from unittest.mock import patch, MagicMock


def _upload(client, auth_headers, text: str):
    """Helper: POST a fake PDF whose pdfplumber text returns `text`."""
    fake_pdf = io.BytesIO(b"%PDF fake")
    fake_pdf.name = "bill.pdf"

    mock_page = MagicMock()
    mock_page.extract_text.return_value = text
    mock_pdf_ctx = MagicMock()
    mock_pdf_ctx.__enter__ = lambda s: s
    mock_pdf_ctx.__exit__ = MagicMock(return_value=False)
    mock_pdf_ctx.pages = [mock_page]

    with patch("pdfplumber.open", return_value=mock_pdf_ctx):
        return client.post(
            "/api/ai/extract-bill-text",
            files={"file": ("bill.pdf", fake_pdf, "application/pdf")},
            headers=auth_headers,
        )


# ── Amount extraction ──────────────────────────────────────────────────────────

def test_extracts_amount_due_same_line(client, auth_headers):
    text = "EnergyAustralia Pty Ltd\nAmount due $302.22\nBill due date 18 May 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["amount"] == 302.22


def test_extracts_amount_two_column_layout(client, auth_headers):
    """Amount on the line after 'Amount due' (two-column PDF layout)."""
    text = "Your bill\nAmount due\n$259.81\nBill due date\n25 Feb 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["amount"] == 259.81


def test_does_not_pick_up_fine_print_amount(client, auth_headers):
    """Fine-print 'payment amounts up to $10,000' must not override the real amount."""
    text = (
        "EnergyAustralia Pty Ltd\n"
        "Amount due\n$302.22\n"
        "Bill due date\n18 May 2026\n"
        "Direct debit: for payment amounts up to $10,000."
    )
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["amount"] == 302.22


# ── Due date extraction ────────────────────────────────────────────────────────

def test_extracts_due_date_same_line(client, auth_headers):
    text = "Sydney Water\nAmount due $150.00\nDue date 15/06/2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["due_date"] == "2026-06-15"


def test_extracts_due_date_next_line(client, auth_headers):
    """Two-column PDF: 'Bill due date' label then date on next line."""
    text = "EnergyAustralia Pty Ltd\nAmount due\n$259.81\nBill due date\n25 Feb 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["due_date"] == "2026-02-25"


def test_extracts_due_date_month_format(client, auth_headers):
    text = "Gas Bill\nAmount due $302.22\nBill due date\n18 May 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["due_date"] == "2026-05-18"


# ── Name / entity extraction ───────────────────────────────────────────────────

def test_name_strips_noise_words(client, auth_headers):
    """'Tax invoice EnergyAustralia Pty Ltd' should not include 'Tax' or 'invoice'."""
    text = "Tax invoice\nEnergyAustralia Pty Ltd ABN 99 086 014 968\nAmount due $259.81\nBill due date 25 Feb 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    name = res.json()["name"]
    assert "Tax" not in name
    assert "invoice" not in name.lower()
    assert "taxinvoice" not in name.lower()


def test_name_includes_company(client, auth_headers):
    text = "Tax invoice\nEnergyAustralia Pty Ltd ABN 99 086 014 968\nAmount due $259.81\nBill due date 25 Feb 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert "Energy Australia" in res.json()["name"] or "EnergyAustralia" in res.json()["name"]


# ── Category detection ─────────────────────────────────────────────────────────

def test_category_utility_for_electricity(client, auth_headers):
    text = "EnergyAustralia Pty Ltd\nYour electricity account\nAmount due $259.81\nBill due date 25 Feb 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["category"] == "utility"


def test_category_utility_for_gas(client, auth_headers):
    text = "EnergyAustralia Pty Ltd\nYour gas account\nAmount due $302.22\nBill due date 18 May 2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["category"] == "utility"


def test_category_council_rates(client, auth_headers):
    text = "Liverpool City Council\nRates Notice\nAmount due $515.00\nDue date 30/07/2026"
    res = _upload(client, auth_headers, text)
    assert res.status_code == 200
    assert res.json()["category"] == "council_rates"


# ── Auth required ──────────────────────────────────────────────────────────────

def test_extract_bill_text_requires_auth(client):
    file_data = io.BytesIO(b"fake")
    res = client.post(
        "/api/ai/extract-bill-text",
        files={"file": ("bill.pdf", file_data, "application/pdf")},
    )
    assert res.status_code == 401
