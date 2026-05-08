import os
import json
import secrets
import time
import urllib.request
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://fxpwhhtwuwqyclrkhexg.supabase.co")
_supabase_jwks: Optional[dict] = None

# ── User cache ────────────────────────────────────────────────────────────────
# Caches the user row in memory keyed by email so we skip a DB round-trip
# (Oregon → Mumbai, ~250 ms) on every API request. TTL = 5 minutes.
_USER_CACHE: dict[str, tuple[models.User, float]] = {}
_USER_CACHE_TTL = 300  # seconds


def _cache_get(email: str) -> Optional[models.User]:
    entry = _USER_CACHE.get(email)
    if entry and (time.monotonic() - entry[1]) < _USER_CACHE_TTL:
        return entry[0]
    return None


def _cache_set(user: models.User) -> None:
    _USER_CACHE[user.email] = (user, time.monotonic())


def _get_supabase_jwks() -> dict:
    global _supabase_jwks
    if _supabase_jwks is None:
        url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(url, timeout=10) as resp:
            _supabase_jwks = json.loads(resp.read())
    return _supabase_jwks


def _verify_supabase_token(token: str) -> Optional[dict]:
    try:
        jwks = _get_supabase_jwks()
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            return None
        return jwt.decode(token, key, algorithms=["ES256"], audience="authenticated")
    except Exception:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def _find_or_create_user(email: str, name: str, db: Session) -> models.User:
    cached = _cache_get(email)
    if cached:
        return cached
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            email=email,
            name=name or email.split("@")[0],
            password=get_password_hash(secrets.token_hex(32)),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    _cache_set(user)
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Try Supabase JWT (ES256 via JWKS)
    payload = _verify_supabase_token(token)
    if payload:
        email: str = payload.get("email")
        if email:
            meta = payload.get("user_metadata") or {}
            name = meta.get("full_name") or meta.get("name") or email.split("@")[0]
            return _find_or_create_user(email, name, db)

    # 2. Fall back to our own JWT (email/password via seeded users)
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email = payload.get("sub")
        if email:
            user = db.query(models.User).filter(models.User.email == email).first()
            if user:
                return user
    except JWTError:
        pass

    raise credentials_exception
