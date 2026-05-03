import os
import urllib.request
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

router = APIRouter()

NOTIFY_SECRET = os.environ.get("NOTIFY_SECRET", "")
CRON_SECRET = os.environ.get("CRON_SECRET", "")


def _send_email(to: str, subject: str, html: str):
    """Send email via Resend API. Returns (success, error_str)."""
    resend_key = os.environ.get("RESEND_API_KEY", "")
    if not resend_key:
        return False, "RESEND_API_KEY not set"

    payload = json.dumps({
        "from": "CashflowWise <reminders@cashflowwise.com.au>",
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
            return resp.status == 200, None
    except Exception as e:
        return False, str(e)


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
            <a href="https://cashflowwise.com.au/expenses"
               style="display:inline-block;background:#0f172a;color:white;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none">
              View & Pay Bills →
            </a>
          </div>

          <p style="color:#94a3b8;font-size:12px;margin-top:24px;text-align:center">
            Finance Tracker · You're receiving this because you have overdue bills.<br>
            <a href="https://cashflowwise.com.au" style="color:#94a3b8">Manage your account</a>
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
        ok, _ = _send_email(user.email, subject, html)
        if ok:
            sent += 1

    return {"sent": sent, "users_with_overdue": len(user_bills)}


def _reminder_email_html(user_name: str, bills: list) -> str:
    """Clean HTML email listing bills due within the next 3 days."""
    total = sum(b["amount"] for b in bills)

    rows = "".join(
        f"""
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a">{b['name']}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#64748b;text-align:center">{b['due_date']}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;text-align:right">${b['amount']:,.2f}</td>
        </tr>
        """
        for b in bills
    )

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">

        <div style="background:#0f172a;padding:24px 28px">
          <p style="color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 4px">CashflowWise</p>
          <h1 style="color:white;font-size:20px;font-weight:700;margin:0">Bills due in the next 3 days</h1>
        </div>

        <div style="padding:24px 28px">
          <p style="color:#334155;font-size:15px;margin:0 0 20px">
            Hi {user_name}, you have <strong>{len(bills)} bill{'s' if len(bills) != 1 else ''}</strong> coming up soon. Here's a summary:
          </p>

          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:8px 14px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Bill</th>
                <th style="padding:8px 14px;text-align:center;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Due Date</th>
                <th style="padding:8px 14px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Amount</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
            <tfoot>
              <tr style="background:#f8fafc">
                <td colspan="2" style="padding:10px 14px;font-size:13px;font-weight:700;color:#0f172a">Total Due</td>
                <td style="padding:10px 14px;text-align:right;font-size:16px;font-weight:700;color:#0f172a">${total:,.2f}</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-top:24px;text-align:center">
            <a href="https://cashflowwise.com.au/expenses"
               style="display:inline-block;background:#0f172a;color:white;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none">
              View &amp; Pay Bills →
            </a>
          </div>

          <p style="color:#94a3b8;font-size:12px;margin-top:24px;text-align:center">
            CashflowWise · You're receiving this because you have upcoming bills.<br>
            <a href="https://cashflowwise.com.au" style="color:#94a3b8">Manage your account</a>
          </p>
        </div>

      </div>
    </body>
    </html>
    """


@router.post("/send-reminders")
def send_bill_reminders(
    x_cron_secret: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """
    Called by a scheduled cron job.
    Finds all users with bills due within the next 3 days (status pending or overdue)
    and sends each user one summary email via Resend.
    Secured by X-Cron-Secret header checked against CRON_SECRET env var.
    """
    if CRON_SECRET and x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    # Debug: check total pending expenses and first due_date value
    total_pending = db.query(models.ExpenseItem).filter(
        models.ExpenseItem.status.in_(["pending", "overdue"])
    ).count()
    sample = db.query(models.ExpenseItem).filter(
        models.ExpenseItem.status.in_(["pending", "overdue"])
    ).first()
    sample_due = str(sample.due_date) if sample else None
    sample_uid = sample.user_id if sample else None

    now = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    window_end = now + timedelta(days=4)  # include full day of day+3

    # Bills due between today and today+3 days that are still pending/overdue
    upcoming = (
        db.query(models.ExpenseItem, models.User)
        .join(models.User, models.User.id == models.ExpenseItem.user_id)
        .filter(
            models.ExpenseItem.status.in_(["pending", "overdue"]),
            models.ExpenseItem.due_date >= now,
            models.ExpenseItem.due_date < window_end,
        )
        .order_by(models.ExpenseItem.due_date.asc())
        .all()
    )

    # Group bills by user
    user_bills: dict = {}
    for expense, user in upcoming:
        uid = user.id
        if uid not in user_bills:
            user_bills[uid] = {"user": user, "bills": []}
        due = expense.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        user_bills[uid]["bills"].append({
            "name": expense.name,
            "amount": float(expense.amount),
            "due_date": due.strftime("%d %b %Y"),
        })

    sent = 0
    emailed_users = []
    email_errors = []
    for uid, data in user_bills.items():
        user = data["user"]
        bills = data["bills"]
        user_name = user.name or user.email.split("@")[0]
        html = _reminder_email_html(user_name, bills)
        subject = "You have bills due soon — CashflowWise"
        ok, err = _send_email(user.email, subject, html)
        if ok:
            sent += 1
            emailed_users.append(user.email)
        else:
            email_errors.append({"to": user.email, "error": err})

    return {
        "sent": sent,
        "users": emailed_users,
        "_debug": {
            "now_utc": str(now),
            "window_end": str(window_end),
            "total_pending_expenses": total_pending,
            "sample_due_date": sample_due,
            "sample_user_id": sample_uid,
            "upcoming_found": len(upcoming),
            "email_errors": email_errors,
        }
    }
