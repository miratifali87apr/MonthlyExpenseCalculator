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


@router.post("/parse-statement")
async def parse_statement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    content_type = file.content_type or "image/jpeg"
    raw_bytes = await file.read()
    b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")

    prompt = (
        "You are a property management statement parser. "
        "Analyse this PM statement image and return ONLY valid JSON with these exact keys:\n"
        '{"property_address": string|null, "period": {"month": string, "year": string}|null, '
        '"gross_rent": number|null, "management_fee": number|null, "letting_fee": number|null, '
        '"maintenance_items": [{"description": string, "amount": number}], '
        '"total_expenses": number|null, "net_to_owner": number|null}\n'
        "All monetary amounts are positive numbers without $ signs. Use null if not present. JSON only."
    )
    return _parse_json(_ai_vision(b64, content_type, prompt))


@router.post("/analyze-portfolio")
async def analyze_portfolio(
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
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
