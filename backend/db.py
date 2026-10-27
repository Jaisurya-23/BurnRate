import os
from datetime import date, datetime

from dotenv import load_dotenv
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv(override=True)

raw_url = (os.getenv("DATABASE_URL") or "").strip()

if not raw_url:
    raise RuntimeError(
        "DATABASE_URL is not set in backend/.env! Please paste your Neon PostgreSQL connection string."
    )

def clean_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    # Remove channel_binding parameter as Windows psycopg2/libpq builds reject it
    if "channel_binding" in url:
        url = (
            url.replace("&channel_binding=require", "")
            .replace("channel_binding=require&", "")
            .replace("channel_binding=require", "")
        )
        if url.endswith("?"):
            url = url[:-1]
    return url

url = clean_database_url(raw_url)

print(f"[DB] Connecting strictly to Neon PostgreSQL: {url.split('@')[-1] if '@' in url else 'configured'}")

engine = create_engine(
    url,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(120), unique=True, index=True, nullable=False)
    name = Column(String(100), default="")
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"
    id = Column(Integer, primary_key=True)
    token = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String(40), nullable=False, default="Other")
    note = Column(String(200), default="")
    spent_on = Column(Date, nullable=False, default=date.today)
    raw_transcript = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Budget(Base):
    """Monthly budget scoped per user."""
    __tablename__ = "budget"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    monthly_budget = Column(Float, default=0)
    fixed_bills = Column(Float, default=0)


class CategoryBudget(Base):
    """Per-category spending limits scoped per user."""
    __tablename__ = "category_budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "category", name="uix_user_category"),
    )
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(40), nullable=False)
    budget_limit = Column(Float, nullable=False, default=0)


def init_db():
    # Remove old SQLite burnrate.db if present
    old_sqlite = os.path.join(os.path.dirname(__file__), "burnrate.db")
    if os.path.exists(old_sqlite):
        try:
            os.remove(old_sqlite)
            print("[DB] Removed old local burnrate.db SQLite file successfully.")
        except Exception:
            pass

    # Create all tables on Neon PostgreSQL
    Base.metadata.create_all(engine)
    print("[DB] All tables verified & initialized on Neon PostgreSQL.")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
