from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,      # test connections before use — prevents stale-connection errors
    pool_size=10,            # keep 10 connections open in the pool
    max_overflow=20,         # allow up to 20 additional connections under load
    pool_recycle=300,        # recycle connections after 5 minutes to avoid DB-side timeouts
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
