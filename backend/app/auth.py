import os
import secrets
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

    # 1. Try Supabase JWT first
    supabase_secret = os.environ.get("SUPABASE_JWT_SECRET")
    if supabase_secret:
        try:
            payload = jwt.decode(
                token,
                supabase_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            email: str = payload.get("email")
            if email:
                meta = payload.get("user_metadata") or {}
                name = meta.get("full_name") or meta.get("name") or email.split("@")[0]
                return _find_or_create_user(email, name, db)
        except JWTError:
            pass

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
