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
    Extract PM statement data from a PDF using text extraction + regex.
    No AI API calls, no Pro plan required — works for all users.
    Returns the same JSON shape as /parse-statement.
    """
    raw_bytes = await file.read()
    is_pdf = (
        (file.content_type or "") == "application/pdf"
        or (file.filename or "").lower().endswith(".pdf")
    )
    if not is_pdf:
        raise HTTPException(status_code=422, detail="Only PDF files are supported by this endpoint. For images use the AI parser.")

    try:
        import pdfplumber
        import io as _io
        with pdfplumber.open(_io.BytesIO(raw_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except ImportError:
        raise HTTPException(status_code=503, detail="pdfplumber not installed on this server.")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {e}")

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract any text from this PDF. The file may be a scanned image — try the AI parser instead."
        )

    import re

    def _find_amount(patterns: list[str], txt: str) -> float | None:
        for pat in patterns:
            m = re.search(pat, txt, re.IGNORECASE)
            if m:
                raw = m.group(1).replace(",", "").replace("$", "").strip()
                try:
                    return float(raw)
                except ValueError:
                    continue
        return None

    # ---- Gross Rent ----
    gross_rent = _find_amount([
        r"(?:gross\s+)?rental\s+income[^\d$]*\$?([\d,]+\.?\d*)",
        r"gross\s+rent[^\d$]*\$?([\d,]+\.?\d*)",
        r"total\s+rent[^\d$]*\$?([\d,]+\.?\d*)",
        r"rent\s+received[^\d$]*\$?([\d,]+\.?\d*)",
        r"rent\s+collected[^\d$]*\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Management Fee ----
    management_fee = _find_amount([
        r"management\s+fee[^\d$]*\$?([\d,]+\.?\d*)",
        r"management\s+(?:commission|charge)[^\d$]*\$?([\d,]+\.?\d*)",
        r"(?:property\s+)?management[^\d$\n]{0,20}\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Letting Fee ----
    letting_fee = _find_amount([
        r"letting\s+fee[^\d$]*\$?([\d,]+\.?\d*)",
        r"lease\s+(?:renewal\s+)?fee[^\d$]*\$?([\d,]+\.?\d*)",
        r"re-?let(?:ting)?\s+fee[^\d$]*\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Net to Owner ----
    net_to_owner = _find_amount([
        r"net\s+(?:amount\s+)?(?:payable|to\s+owner|disbursement|remittance)[^\d$]*\$?([\d,]+\.?\d*)",
        r"amount\s+(?:payable|paid)\s+to\s+owner[^\d$]*\$?([\d,]+\.?\d*)",
        r"total\s+(?:net\s+)?(?:payable|disbursed)[^\d$]*\$?([\d,]+\.?\d*)",
        r"owner\s+(?:net|payment|disbursement)[^\d$]*\$?([\d,]+\.?\d*)",
        r"net\s+owner[^\d$]*\$?([\d,]+\.?\d*)",
    ], text)

    # ---- Maintenance items ----
    maintenance_items: list[dict] = []
    maintenance_patterns = [
        r"((?:maintenance|repair|plumb|electr|clean|garden|pest|lock|paint|carpet)[^\n$]*?)\s+\$?([\d,]+\.?\d*)",
        r"((?:maintenance|repair|plumb|electr|clean|garden|pest|lock|paint|carpet)[^\n$]*?)\s+([\d,]+\.?\d*)\s*$",
    ]
    seen_amounts: set[float] = set()
    for pat in maintenance_patterns:
        for m in re.finditer(pat, text, re.IGNORECASE | re.MULTILINE):
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
        r"total\s+(?:deductions|disbursements|expenses|charges)[^\d$]*\$?([\d,]+\.?\d*)",
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
