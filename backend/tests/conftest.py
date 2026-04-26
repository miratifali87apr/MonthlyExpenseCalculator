"""
Shared test fixtures — in-memory SQLite DB, test client, seeded user.
"""
import os
# Point to SQLite BEFORE any app module is imported so database.py
# never tries to connect to PostgreSQL during test collection.
# Force SQLite before any app module is imported — overrides .env too
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only-32chars!!"
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-secret"
os.environ["FRONTEND_URL"] = "http://localhost:3000"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.database as _db_module
from app.database import Base, get_db
from app import models
from app.auth import get_password_hash, create_access_token
from main import app

# ── Single SQLite engine shared by app + tests (avoids file-lock conflicts) ──
TEST_DB_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})

# Point the app's database module at the same engine so create_all/sessions
# all operate on one connection pool.
_db_module.engine = engine
_db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_db():
    """Drop and recreate all tables before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def user(db):
    """A seeded test user with plan=free."""
    u = models.User(
        email="test@example.com",
        name="Test User",
        password=get_password_hash("password123"),
        plan="free",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def pro_user(db):
    """A seeded test user with plan=pro."""
    u = models.User(
        email="pro@example.com",
        name="Pro User",
        password=get_password_hash("password123"),
        plan="pro",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def token(user):
    return create_access_token({"sub": user.email})


@pytest.fixture
def pro_token(pro_user):
    return create_access_token({"sub": pro_user.email})


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def pro_headers(pro_token):
    return {"Authorization": f"Bearer {pro_token}"}


@pytest.fixture
def property_(db, user):
    """A property owned by the test user."""
    p = models.Property(
        user_id=user.id,
        name="Test Property",
        address="123 Test St",
        weekly_rent=500,
        pm_fee_pct=0.08,
        tenant_liable_for_water=False,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
