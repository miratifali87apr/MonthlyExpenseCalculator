import os
import base64
import json

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app import models

router = APIRouter()

# ---------------------------------------------------------------------------
# AI client — prefers OpenAI if OPENAI_API_KEY is set, falls back to Anthropic
# ---------------------------------------------------------------------------

def _ai_text(prompt: str) -> str:
    """Run a text-only prompt and return the response string."""
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if openai_key:
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2048,
        )
        return resp.choices[0].message.content.strip()

    if anthropic_key:
        from anthropic import Anthropic
        client = Anthropic(api_key=anthropic_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()

    raise HTTPException(
        status_code=503,
        detail="No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file.",
    )


def _ai_vision(image_b64: str, media_type: str, prompt: str) -> str:
    """Run a vision prompt with an image and return the response string."""
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if openai_key:
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }],
            max_tokens=2048,
        )
        return resp.choices[0].message.content.strip()

    if anthropic_key:
        from anthropic import Anthropic
        client = Anthropic(api_key=anthropic_key)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return resp.content[0].text.strip()

    raise HTTPException(
        status_code=503,
        detail="No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file.",
    )


def _parse_json(raw: str) -> dict:
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(line for line in lines if not line.startswith("```")).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"AI returned non-JSON: {raw[:300]}")


def _require_pro(user: models.User):
    if (user.plan or 'free') != 'pro':
        raise HTTPException(
            status_code=403,
            detail="This feature requires a Pro plan. Upgrade at /pricing."
        )


def _pdf_to_png_b64(raw_bytes: bytes) -> str:
    """Convert first page of a PDF to PNG and return as base64 string."""
    try:
        import pypdfium2 as pdfium
    except ImportError:
        raise HTTPException(
            status_code=422,
            detail="PDF support requires pypdfium2. Please upload a JPG or PNG screenshot instead.",
        )
    pdf = pdfium.PdfDocument(raw_bytes)
    page = pdf[0]
    bitmap = page.render(scale=2)  # 2x scale for better OCR quality
    pil_img = bitmap.to_pil()
    import io as _io
    buf = _io.BytesIO()
    pil_img.save(buf, format="PNG")
    return base64.standard_b64encode(buf.getvalue()).decode("utf-8")


def _pdf_to_png_bytes(raw_bytes: bytes) -> bytes:
    """Convert first page of a PDF to PNG bytes (for OCR)."""
    try:
        import pypdfium2 as pdfium
    except ImportError:
        raise HTTPException(status_code=503, detail="pypdfium2 not installed.")
    import io as _io
    pdf = pdfium.PdfDocument(raw_bytes)
    page = pdf[0]
    bitmap = page.render(scale=2)
    pil_img = bitmap.to_pil()
    buf = _io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def _ocr_bytes(image_bytes: bytes) -> str:
    """Run Tesseract OCR on raw image bytes and return extracted text."""
    try:
        import pytesseract
        from PIL import Image
        import io as _io
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="OCR is not available on this server (pytesseract/Pillow not installed).",
        )
    try:
        img = Image.open(_io.BytesIO(image_bytes))
        return pytesseract.image_to_string(img, config="--psm 6")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"OCR failed: {e}")


@router.post("/extract-property")
async def extract_property(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload a PM statement, rental agreement, or lease PDF/image.
    Returns extracted property details to pre-fill the Add Property form.
    Available to all users (free feature — it's just form assistance).
    """
    content_type = file.content_type or "image/jpeg"
    raw_bytes = await file.read()

    is_pdf = (
        content_type == "application/pdf"
        or (file.filename or "").lower().endswith(".pdf")
    )
    if is_pdf:
        b64 = _pdf_to_png_b64(raw_bytes)
        media_type = "image/png"
    else:
        b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
        media_type = content_type

    prompt = (
        "You are an Australian property document parser. "
        "Analyse this document (PM statement, rental agreement, or lease) and extract property details. "
        "Return ONLY valid JSON with these exact keys:\n"
        '{"property_name": string|null, "address": string|null, '
        '"weekly_rent": number|null, "pm_fee_pct": number|null, '
        '"tenant_name": string|null, "notes": string|null}\n'
        "Rules:\n"
        "- property_name: short name like suburb or street (e.g. 'Kirwan' or '12 Main St')\n"
        "- address: full property address\n"
        "- weekly_rent: rent in dollars per week (convert from monthly/fortnightly if needed)\n"
        "- pm_fee_pct: management fee as a percentage between 0 and 100 (e.g. 8.5 for 8.5%)\n"
        "  If you see a dollar amount for management fee, calculate it as pct of gross rent\n"
        "- tenant_name: name of the tenant if visible\n"
        "- notes: any important info (e.g. 'Letting fee also charged', 'Water included')\n"
        "Use null for any field not found. Return JSON only, no explanation."
    )
    return _parse_json(_ai_vision(b64, media_type, prompt))


@router.post("/parse-statement")
async def parse_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_pro(current_user)
    content_type = file.content_type or "image/jpeg"
    raw_bytes = await file.read()

    # Convert PDF first page to PNG so the vision API can read it
    is_pdf = (
        content_type == "application/pdf"
        or (file.filename or "").lower().endswith(".pdf")
    )
    if is_pdf:
        b64 = _pdf_to_png_b64(raw_bytes)
        media_type = "image/png"
    else:
        b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
        media_type = content_type

    prompt = (
        "You are a property management statement parser. "
        "Analyse this PM statement and return ONLY valid JSON with these exact keys:\n"
        '{"property_address": string|null, "period": {"month": string, "year": string}|null, '
        '"gross_rent": number|null, "management_fee": number|null, "letting_fee": number|null, '
        '"maintenance_items": [{"description": string, "amount": number}], '
        '"total_expenses": number|null, "net_to_owner": number|null}\n'
        "All monetary amounts are positive numbers without $ signs. Use null if not present. JSON only."
    )
    return _parse_json(_ai_vision(b64, media_type, prompt))


@router.post("/extract-bill")
async def extract_bill(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload any bill/invoice PDF or image.
    Returns structured expense data to auto-create an expense record.
    Available to all users.
    """
    content_type = file.content_type or "image/jpeg"
    raw_bytes = await file.read()

    is_pdf = (
        content_type == "application/pdf"
        or (file.filename or "").lower().endswith(".pdf")
    )
    if is_pdf:
        b64 = _pdf_to_png_b64(raw_bytes)
        media_type = "image/png"
    else:
        b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
        media_type = content_type

    categories = "loan | insurance | utility | council_rates | bas | school_fees | credit_card | car | pm_fees | maintenance | letting_fee | other"
    prompt = (
        "You are an Australian bill and invoice parser. "
        "Analyse this document and extract expense details. "
        "Return ONLY valid JSON with these exact keys:\n"
        '{"name": string, "amount": number, "due_date": string|null, '
        '"category": string, "notes": string|null}\n'
        "Rules:\n"
        f"- category: must be exactly one of: {categories}\n"
        "  Choose the best match: 'utility' for water/electricity/gas, 'council_rates' for council/rates, "
        "  'insurance' for any insurance, 'loan' for mortgage/loan repayments, "
        "  'maintenance' for repairs/maintenance, 'pm_fees' for property management fees, "
        "  'other' if none match\n"
        "- name: short descriptive name, e.g. 'Sydney Water Bill', 'Council Rates Q2', 'Building Insurance 2025'\n"
        "- amount: total amount due as a number (no $ sign). If GST is shown separately, use the total including GST\n"
        "- due_date: ISO format YYYY-MM-DD if visible, otherwise null\n"
        "- notes: issuer name, account number, or any important reference info (keep short, 1-2 lines)\n"
        "Use null for optional fields if not found. Return JSON only, no explanation."
    )
    return _parse_json(_ai_vision(b64, media_type, prompt))


@router.post("/parse-statement-text")
async def parse_statement_text(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Extract PM statement data from a PDF or image using text extraction + OCR + regex.
    No AI API calls, no Pro plan required — works for all users.
    - Text-based PDF  → pdfplumber extracts text directly
    - Scanned PDF     → pypdfium2 renders page → Tesseract OCR
    - JPEG / PNG      → Tesseract OCR directly
    Returns the same JSON shape as /parse-statement.
    """
    import io as _io

    raw_bytes = await file.read()
    content_type = file.content_type or ""
    filename = (file.filename or "").lower()
    is_pdf = content_type == "application/pdf" or filename.endswith(".pdf")

    text = ""

    if is_pdf:
        # Step 1: try fast text extraction
        try:
            import pdfplumber
            with pdfplumber.open(_io.BytesIO(raw_bytes)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except ImportError:
            pass
        except Exception:
            pass

        # Step 2: if no text (scanned PDF), render to image and OCR
        if not text.strip():
            png_bytes = _pdf_to_png_bytes(raw_bytes)
            text = _ocr_bytes(png_bytes)
    else:
        # Image file (JPEG, PNG, WEBP, etc.) — OCR directly
        text = _ocr_bytes(raw_bytes)

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract any text from this file. Try a clearer scan or higher resolution image.",
        )

    import re

    # Normalise OCR artefacts: merge runs of spaces, fix common OCR merges
    # e.g. "RentalIncome" → "Rental Income", "ManagementFee" → "Management Fee"
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)   # camelCase split
    text = re.sub(r"([A-Z]{2,})([A-Z][a-z])", r"\1 \2", text)  # ABCDef → ABC Def

    def _find_amount(patterns: list[str], txt: str) -> float | None:
        for pat in patterns:
            m = re.search(pat, txt, re.IGNORECASE)
            if m:
                raw = m.group(1).replace(",", "").replace("$", "").strip()
                try:
                    val = float(raw)
                    if val > 0:
                        return val
                except ValueError:
                    continue
        return None

    # Separator between label and amount — handles spaces, tabs, colons, dashes, dots
    SEP = r"[^(\d\n]{0,20}"

    # ---- Gross Rent ----
    gross_rent = _find_amount([
        r"(?:gross\s*)?rental\s*income" + SEP + r"\$?([\d,]+\.?\d*)",
        r"gross\s*rent" + SEP + r"\$?([\d,]+\.?\d*)",
        r"total\s*rent" + SEP + r"\$?([\d,]+\.?\d*)",
        r"rent\s*(?:received|collected|income)" + SEP + r"\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Management Fee ----
    # Skip parenthetical percentages like "(8.8%)" before the dollar amount
    management_fee = _find_amount([
        r"management\s*fee\s*(?:\([^)]*\))?" + SEP + r"\$?([\d,]+\.?\d*)",
        r"management\s*(?:commission|charge)\s*(?:\([^)]*\))?" + SEP + r"\$?([\d,]+\.?\d*)",
        r"(?:property\s*)?management\s*(?:\([^)]*\))?" + SEP + r"\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Letting Fee ----
    letting_fee = _find_amount([
        r"let(?:t?ing)?\s*fee" + SEP + r"\$?([\d,]+\.?\d*)",  # handles "letting", "leting" (OCR typo)
        r"lease\s*(?:renewal\s*)?fee" + SEP + r"\$?([\d,]+\.?\d*)",
        r"re-?let(?:ting)?\s*fee" + SEP + r"\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Net to Owner ----
    net_to_owner = _find_amount([
        r"net\s*(?:amount\s*)?(?:payable|to\s*owner|disbursement|remittance)" + SEP + r"\$?([\d,]+\.?\d*)",
        r"amount\s*(?:payable|paid)\s*to\s*owner" + SEP + r"\$?([\d,]+\.?\d*)",
        r"total\s*(?:net\s*)?(?:payable|disbursed)" + SEP + r"\$?([\d,]+\.?\d*)",
        r"owner\s*(?:net|payment|disbursement)" + SEP + r"\$?([\d,]+\.?\d*)",
        r"net\s*owner" + SEP + r"\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Maintenance items ----
    maintenance_items: list[dict] = []
    seen_amounts: set[float] = set()
    for m in re.finditer(
        r"((?:maintenance|repair|plumb|electr|clean|garden|pest|lock|paint|carpet)\w*[^\n$]{0,60}?)\s+\$?([\d,]+\.?\d*)",
        text, re.IGNORECASE | re.MULTILINE
    ):
        desc = m.group(1).strip().rstrip("-–—:").strip()
        try:
            amt = float(m.group(2).replace(",", ""))
        except ValueError:
            continue
        if amt <= 0 or amt in seen_amounts:
            continue
        seen_amounts.add(amt)
        maintenance_items.append({"description": desc, "amount": amt})

    # ---- Period ----
    period = None
    period_match = re.search(
        r"(?:period|statement|month)[^\n]*?(\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
        r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[^\n]*?(\d{4}))",
        text, re.IGNORECASE
    )
    if not period_match:
        period_match = re.search(
            r"(\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
            r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[^\n]*?(\d{4}))",
            text, re.IGNORECASE
        )
    if period_match:
        period = {"month": period_match.group(1).strip(), "year": period_match.group(2)}

    # ---- Property address ----
    property_address = None
    addr_match = re.search(
        r"(?:property|address|premises)[^\n]*?:\s*([^\n]+)",
        text, re.IGNORECASE
    )
    if addr_match:
        property_address = addr_match.group(1).strip()

    # ---- Total expenses ----
    total_expenses = _find_amount([
        r"total\s*(?:deductions|disbursements|expenses|charges)" + SEP + r"\$?([\d,]+\.?\d*)",
        r"(?:deductions|charges)\s+total[^\d$]*\$?([\d,]+\.?\d*)",
    ], text)

    return {
        "property_address": property_address,
        "period": period,
        "gross_rent": gross_rent,
        "management_fee": management_fee,
        "letting_fee": letting_fee,
        "maintenance_items": maintenance_items,
        "total_expenses": total_expenses,
        "net_to_owner": net_to_owner,
        "_source": "text_extraction",
    }


@router.post("/extract-bill-text")
async def extract_bill_text(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Extract bill/invoice data from any PDF or image using OCR + regex.
    Works for water, electricity, gas, council rates, insurance, loan statements, etc.
    No AI, no Pro plan required.
    Returns: name, amount, due_date, category, notes
    """
    import io as _io, re

    raw_bytes = await file.read()
    content_type = file.content_type or ""
    filename = (file.filename or "").lower()
    is_pdf = content_type == "application/pdf" or filename.endswith(".pdf")

    text = ""
    if is_pdf:
        try:
            import pdfplumber
            with pdfplumber.open(_io.BytesIO(raw_bytes)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception:
            pass
        if not text.strip():
            text = _ocr_bytes(_pdf_to_png_bytes(raw_bytes))
    else:
        text = _ocr_bytes(raw_bytes)

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from this file.")

    # Normalise OCR camelCase merges
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    text = re.sub(r"([A-Z]{2,})([A-Z][a-z])", r"\1 \2", text)

    SEP = r"[^(\d\n]{0,20}"

    def _find_amount(patterns):
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                raw = m.group(1).replace(",", "").replace("$", "").strip()
                try:
                    val = float(raw)
                    if val > 0:
                        return val
                except ValueError:
                    continue
        return None

    def _find_text(patterns):
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE | re.MULTILINE)
            if m:
                val = m.group(1).strip()
                # Strip leading OCR noise (non-letter characters at the start)
                val = re.sub(r"^[^A-Za-z0-9]+", "", val).strip()
                return val if val else None
        return None

    # ---- Amount due ----
    amount = _find_amount([
        r"(?:total\s*)?amount\s*(?:due|payable|owing)" + SEP + r"\$?([\d,]+\.?\d*)",
        r"please\s*pay" + SEP + r"\$?([\d,]+\.?\d*)",
        r"balance\s*(?:due|owing)" + SEP + r"\$?([\d,]+\.?\d*)",
        r"total\s*(?:due|payable|charges?)" + SEP + r"\$?([\d,]+\.?\d*)",
        r"(?:invoice|bill)\s*total" + SEP + r"\$?([\d,]+\.?\d*)",
        r"(?:current\s*)?(?:charges?|amount)" + SEP + r"\$?([\d,]+\.?\d*)",
    ])

    # ---- Due date ----
    import datetime
    due_date = None
    date_pat = _find_text([
        # Same-line: "due date: 25/02/2026" or "due date: 25 Feb 2026"
        r"(?:due|payment|pay\s*by|due\s*date)[^\n]*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})",
        r"(?:due|payment|pay\s*by|due\s*date)[^\n]*?(\d{1,2}\s+\w+\s+\d{4})",
        r"(?:due|payment)[^\n]*?(\w+\s+\d{1,2},?\s+\d{4})",
        # Two-column PDFs: label on one line, date on the next
        r"(?:due\s*date|pay\s*by)[^\n]*\n\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})",
        r"(?:due\s*date|pay\s*by)[^\n]*\n\s*(\d{1,2}\s+\w+\s+\d{4})",
        # "bill due" anywhere followed by a date within 80 chars
        r"(?:bill\s*due|payment\s*due)[\s\S]{0,80}?(\d{1,2}\s+\w+\s+\d{4})",
        r"(?:bill\s*due|payment\s*due)[\s\S]{0,80}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})",
    ])
    if date_pat:
        for fmt in ("%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d %B %Y", "%d %b %Y", "%B %d, %Y", "%b %d, %Y"):
            try:
                due_date = datetime.datetime.strptime(date_pat.strip(), fmt).strftime("%Y-%m-%d")
                break
            except ValueError:
                continue

    # ---- Issuer / company name ----
    _NOISE_WORDS = {"tax", "invoice", "taxinvoice", "your", "bill", "statement", "ref",
                    "from", "to", "issued", "dear", "account", "notice", "reminder"}

    def _extract_entity_name():
        for entity_type in [
            r"(?:Shire|City|Regional|Rural|Municipal|District)\s+Council",
            r"(?:Pty\.?\s*Ltd|Limited)",
            r"\b(?:Water|Energy|Electricity|Gas|Insurance)\b",
        ]:
            m = re.search(r"([A-Za-z]+(?:\s+[A-Za-z]+){0,2})\s+(" + entity_type + r")", text, re.IGNORECASE)
            if m:
                pre = m.group(1).strip()
                entity = m.group(2).strip()
                words = pre.split()
                # Remove noise words, keep last 2 meaningful capitalised words
                clean = [w for w in words if w.lower() not in _NOISE_WORDS and w[0].isupper()]
                clean = clean[-2:]  # max 2 words before entity type
                if clean:
                    return f"{' '.join(clean)} {entity}"
                return entity
        # Fallback: first non-garbage line
        return _find_text([r"(?:from|issued\s*by|biller)[:\s]+([^\n]{3,50})"])

    issuer = _extract_entity_name()

    # ---- Category detection ----
    text_lower = text.lower()
    category = "other"
    if any(w in text_lower for w in ["water", "sydney water", "urban utilities", "yarra valley"]):
        category = "utility"
    elif any(w in text_lower for w in ["electricity", "energy", "origin", "agl", "ergon", "endeavour energy", "ausgrid"]):
        category = "utility"
    elif any(w in text_lower for w in ["gas", "natural gas"]):
        category = "utility"
    elif any(w in text_lower for w in ["council", "rates", "shire", "city council"]):
        category = "council_rates"
    elif any(w in text_lower for w in ["insurance", "allianz", "qbe", "suncorp", "nrma", "aami", "youi"]):
        category = "insurance"
    elif any(w in text_lower for w in ["mortgage", "home loan", "loan repayment", "westpac", "commbank", "commonwealth bank", "anz", "nab", "macquarie"]):
        category = "loan"
    elif any(w in text_lower for w in ["body corporate", "strata", "owners corporation"]):
        category = "other"
    elif any(w in text_lower for w in ["school", "tuition", "fees"]):
        category = "school_fees"
    elif any(w in text_lower for w in ["management fee", "property management", "rental management"]):
        category = "pm_fees"
    elif any(w in text_lower for w in ["maintenance", "repair", "plumb", "electr", "pest"]):
        category = "maintenance"
    elif any(w in text_lower for w in ["credit card", "visa", "mastercard", "amex"]):
        category = "credit_card"
    elif any(w in text_lower for w in ["registration", "rego", "vehicle", "car loan", "ctp"]):
        category = "car"

    # ---- Bill name ----
    # Try to build a short descriptive name from issuer + category
    if issuer:
        name = issuer[:50]
    else:
        # Fall back to first non-empty line that looks like a company/header
        for line in text.splitlines():
            line = line.strip()
            if 4 < len(line) < 60 and not re.match(r"^[\d\s$.,/-]+$", line):
                name = line
                break
        else:
            name = "Bill"

    notes = None
    acct = _find_text([r"(?:account|acct|reference|ref)\s*(?:number|no\.?|#)?[:\s]+([A-Z0-9\-]{4,20})"])
    if acct:
        notes = f"Ref: {acct}"

    return {
        "name": name,
        "amount": amount,
        "due_date": due_date,
        "category": category,
        "notes": notes,
        "_source": "text_extraction",
        # First 600 chars of extracted text, lowercased — used by the frontend
        # to auto-match against the user's property names/addresses
        "_text_sample": text[:600].lower(),
    }


@router.post("/analyze-portfolio")
async def analyze_portfolio(
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_pro(current_user)
    prompt = (
        "You are an expert Australian property investment analyst. "
        f"Analyse this portfolio data and return ONLY valid JSON:\n{json.dumps(body, indent=2)}\n\n"
        'Return: {"portfolio_score": 0-100, "insights": ["..."], "recommendations": ["..."], '
        '"property_rankings": [{"name": str, "rating": "strong"|"moderate"|"weak", "reason": str}]}\n'
        "Score on cashflow (25%), yield (25%), holding cost efficiency (25%), tax position (25%). "
        "Provide 3-5 insights and 3-5 recommendations. JSON only."
    )
    return _parse_json(_ai_text(prompt))


@router.post("/purchase-predictor")
async def purchase_predictor(
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _require_pro(current_user)
    prompt = (
        "You are an expert Australian property investment analyst. "
        "Evaluate this potential purchase and return ONLY valid JSON:\n"
        f"Location: {body.get('location','')}, Type: {body.get('property_type','House')}, "
        f"Price: ${body.get('purchase_price',0):,.0f}, Loan: ${body.get('loan_amount',0):,.0f}, "
        f"Rate: {body.get('interest_rate',6.5)}%, Weekly rent: ${body.get('weekly_rent',0)}, "
        f"Context: {body.get('existing_portfolio_context','N/A')}\n\n"
        'Return: {"monthly_cashflow": number, "annual_yield": number, '
        '"recommendation": "buy"|"consider"|"avoid", "confidence": 0-100, '
        '"pros": ["..."], "cons": ["..."], "ai_summary": "2-3 sentences"}\n'
        "Cashflow = monthly_rent - interest_only_repayment. JSON only."
    )
    return _parse_json(_ai_text(prompt))
