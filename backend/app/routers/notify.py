import os
import urllib.request
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

router = APIRouter()

NOTIFY_SECRET = os.environ.get("NOTIFY_SECRET", "")


def _send_email(to: str, subject: str, html: str):
    """Send email via Resend API."""
    resend_key = os.environ.get("RESEND_API_KEY", "")
    if not resend_key:
        return False

    payload = json.dumps({
        "from": "Finance Tracker <alerts@financetracker.com.au>",
        "to": [to],
        "subject": subject,
        "html": html,
    }).encode()

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {resend_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def _overdue_email_html(user_name: str, overdue_items: list, total: float) -> str:
    rows = "".join(
        f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a">{item['name']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b">{item['property']}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#dc2626;text-align:right">${item['amount']:,.2f}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#dc2626;text-align:right">{item['due_date']}</td>
        </tr>
        """
        for item in overdue_items
    )

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#0f172a;padding:24px 28px">
          <p style="color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 4px">Finance Tracker</p>
          <h1 style="color:white;font-size:20px;font-weight:700;margin:0">You have overdue bills</h1>
        </div>
        <div style="padding:24px 28px">
          <p style="color:#334155;font-size:15px;margin:0 0 20px">Hi {user_name}, the following bills are overdue and need your attention:</p>

          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Bill</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Property</th>
                <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Amount</th>
                <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Due</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
            <tfoot>
              <tr style="background:#fef2f2">
                <td colspan="2" style="padding:10px 12px;font-size:13px;font-weight:700;color:#0f172a">Total Overdue</td>
                <td colspan="2" style="padding:10px 12px;text-align:right;font-size:16px;font-weight:700;color:#dc2626">${total:,.2f}</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top:24px;text-align:center">
            <a href="https://monthly-expense-calculator-ten.vercel.app/expenses"
               style="display:inline-block;background:#0f172a;color:white;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none">
              View & Pay Bills →
            </a>
          </div>

          <p style="color:#94a3b8;font-size:12px;margin-top:24px;text-align:center">
            Finance Tracker · You're receiving this because you have overdue bills.<br>
            <a href="https://monthly-expense-calculator-ten.vercel.app" style="color:#94a3b8">Manage your account</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    """


@router.post("/overdue")
def send_overdue_alerts(
    x_notify_secret: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """
    Called daily by a cron job.
    Finds all users with overdue bills and emails them.
    Secured by X-Notify-Secret header.
    """
    if NOTIFY_SECRET and x_notify_secret != NOTIFY_SECRET:
        raise HTTPException(status_code=401, detail="Invalid notify secret")

    today = datetime.utcnow()

    # Get all overdue expenses (status=overdue OR due_date < today AND not paid)
    overdue = (
        db.query(models.ExpenseItem, models.User, models.Property)
        .join(models.User, models.User.id == models.ExpenseItem.user_id)
        .outerjoin(models.Property, models.Property.id == models.ExpenseItem.property_id)
        .filter(
            models.ExpenseItem.status.in_(["overdue", "pending"]),
            models.ExpenseItem.due_date < today,
        )
        .all()
    )

    # Group by user
    user_bills: dict = {}
    for expense, user, prop in overdue:
        uid = user.id
        if uid not in user_bills:
            user_bills[uid] = {"user": user, "items": []}
        user_bills[uid]["items"].append({
            "name": expense.name,
            "amount": float(expense.amount),
            "due_date": expense.due_date.strftime("%d/%m/%Y") if expense.due_date else "",
            "property": prop.name if prop else "Personal",
        })

    sent = 0
    for uid, data in user_bills.items():
        user = data["user"]
        items = data["items"]
        total = sum(i["amount"] for i in items)
        html = _overdue_email_html(user.name or user.email.split("@")[0], items, total)
        subject = f"⚠️ {len(items)} overdue bill{'s' if len(items) > 1 else ''} — ${total:,.0f} outstanding"
        if _send_email(user.email, subject, html):
            sent += 1

    return {"sent": sent, "users_with_overdue": len(user_bills)}
