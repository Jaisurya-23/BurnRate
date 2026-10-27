from dotenv import load_dotenv
load_dotenv(override=True)

import calendar
from datetime import date, datetime
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

import ai
from auth import create_session, get_current_user, hash_password, verify_password
from db import Budget, CategoryBudget, Expense, User, UserSession, get_db, init_db

app = FastAPI(title="BurnRate Engine")
# V1: open CORS for web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")
except Exception:
    from datetime import timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))


def today() -> date:
    return datetime.now(IST).date()


@app.on_event("startup")
def startup():
    init_db()


# ---------- Schemas ----------
class SignupIn(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""


class LoginIn(BaseModel):
    email: str
    password: str


class ExpenseIn(BaseModel):
    amount: float
    category: str = "Other"
    note: str = ""
    spent_on: Optional[date] = None


class SaveExpenses(BaseModel):
    items: List[ExpenseIn]
    raw_transcript: str = ""


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    note: Optional[str] = None
    spent_on: Optional[date] = None


class TextIn(BaseModel):
    text: str


class BudgetIn(BaseModel):
    monthly_budget: float


class CategoryBudgetIn(BaseModel):
    budgets: Dict[str, float]  # e.g. {"Food": 3000, "Transport": 1500}


def expense_out(e: Expense) -> dict:
    return {
        "id": e.id,
        "amount": e.amount,
        "category": e.category,
        "note": e.note,
        "spent_on": e.spent_on.isoformat(),
    }


def user_out(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "name": u.name or u.email.split("@")[0],
    }


def get_user_budget(db: Session, user_id: int) -> Budget:
    b = db.query(Budget).filter(Budget.user_id == user_id).first()
    if not b:
        b = Budget(user_id=user_id, monthly_budget=0, fixed_bills=0)
        db.add(b)
        db.commit()
    return b


# ---------- Health ----------
@app.get("/")
def root():
    return {"status": "ok", "app": "BurnRate Engine (Neon/Multi-User Enabled)"}


# ---------- Authentication Endpoints ----------
@app.post("/auth/signup")
def signup(body: SignupIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "A valid email address is required.")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    existing = db.query(User).filter(func.lower(User.email) == email).first()
    if existing:
        raise HTTPException(400, "An account with this email already exists. Please log in.")

    user = User(
        email=email,
        name=body.name.strip() if body.name else "",
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_session(db, user.id)
    return {"token": token, "user": user_out(user)}


@app.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")

    token = create_session(db, user.id)
    return {"token": token, "user": user_out(user)}


@app.get("/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return user_out(current_user)


@app.post("/auth/logout")
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer ") :].strip()
        db.query(UserSession).filter(UserSession.token == token).delete()
        db.commit()
    return {"status": "ok", "message": "Logged out successfully."}


# ---------- Categories (Scoped to User) ----------
@app.get("/categories")
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    built_in = list(ai.CATEGORIES)
    budget_cats = [
        cb.category
        for cb in db.query(CategoryBudget).filter(CategoryBudget.user_id == current_user.id).all()
    ]
    expense_cats = [
        row[0]
        for row in db.query(Expense.category)
        .filter(Expense.user_id == current_user.id)
        .distinct()
        .all()
        if row[0]
    ]

    seen = set()
    result = []
    for cat in built_in + budget_cats + expense_cats:
        c_clean = cat.strip()
        if c_clean and c_clean not in seen:
            seen.add(c_clean)
            result.append(c_clean)
    return result


# ---------- AI pipeline ----------
@app.post("/voice")
async def voice(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    data = await audio.read()
    if len(data) < 1000:
        raise HTTPException(400, "Recording is too short. Hold the mic a bit longer.")
    try:
        transcript = await ai.transcribe(data, audio.content_type or "")
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    if not transcript:
        raise HTTPException(422, "I could not hear anything. Try again.")
    items = ai.parse_expenses(transcript)
    return {"transcript": transcript, "items": [i.model_dump() for i in items]}


@app.post("/parse-text")
def parse_text(
    body: TextIn,
    current_user: User = Depends(get_current_user),
):
    if not body.text.strip():
        raise HTTPException(400, "Type what you spent first.")
    items = ai.parse_expenses(body.text)
    return {"transcript": body.text, "items": [i.model_dump() for i in items]}


# ---------- Expenses (Scoped to User) ----------
@app.post("/expenses")
def save_expenses(
    body: SaveExpenses,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = []
    for it in body.items:
        if it.amount <= 0:
            continue
        cat = it.category.strip() if it.category else "Other"
        e = Expense(
            user_id=current_user.id,
            amount=it.amount,
            category=cat or "Other",
            note=it.note.strip() if it.note else "",
            spent_on=it.spent_on or today(),
            raw_transcript=body.raw_transcript,
        )
        db.add(e)
        saved.append(e)
    db.commit()

    alerts = _check_category_alerts(db, current_user.id)
    return {"saved": [expense_out(e) for e in saved], "alerts": alerts}


@app.get("/expenses")
def list_expenses(
    month: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start, end = month_range(month)
    rows = (
        db.query(Expense)
        .filter(
            Expense.user_id == current_user.id,
            Expense.spent_on >= start,
            Expense.spent_on <= end,
        )
        .order_by(Expense.spent_on.desc(), Expense.id.desc())
        .all()
    )
    return [expense_out(e) for e in rows]


@app.patch("/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    body: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    e = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.user_id == current_user.id)
        .first()
    )
    if not e:
        raise HTTPException(404, "Expense not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            if field == "category" and isinstance(value, str):
                value = value.strip() or "Other"
            setattr(e, field, value)
    db.commit()
    alerts = _check_category_alerts(db, current_user.id)
    res = expense_out(e)
    res["alerts"] = alerts
    return res


@app.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    e = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.user_id == current_user.id)
        .first()
    )
    if not e:
        raise HTTPException(404, "Expense not found")
    db.delete(e)
    db.commit()
    return {"deleted": expense_id}


# ---------- Budget (Scoped to User) ----------
@app.get("/budget")
def read_budget(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat_budgets = {
        cb.category: cb.budget_limit
        for cb in db.query(CategoryBudget).filter(CategoryBudget.user_id == current_user.id).all()
    }
    total = sum(cat_budgets.values())
    b = get_user_budget(db, current_user.id)
    monthly_budget = total if total > 0 else b.monthly_budget
    return {"monthly_budget": monthly_budget}


@app.put("/budget")
def set_budget(
    body: BudgetIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = get_user_budget(db, current_user.id)
    b.monthly_budget = body.monthly_budget
    b.fixed_bills = 0
    db.commit()
    return {"monthly_budget": b.monthly_budget}


# ---------- Category Budgets (Scoped to User) ----------
@app.get("/category-budgets")
def get_category_budgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(CategoryBudget).filter(CategoryBudget.user_id == current_user.id).all()
    return {row.category: row.budget_limit for row in rows}


@app.put("/category-budgets")
def set_category_budgets(
    body: CategoryBudgetIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for cat, limit in body.budgets.items():
        cat_clean = cat.strip()
        if not cat_clean:
            continue
        existing = (
            db.query(CategoryBudget)
            .filter(
                CategoryBudget.user_id == current_user.id,
                CategoryBudget.category == cat_clean,
            )
            .first()
        )
        if limit <= 0:
            if existing:
                db.delete(existing)
        elif existing:
            existing.budget_limit = limit
        else:
            db.add(CategoryBudget(user_id=current_user.id, category=cat_clean, budget_limit=limit))

    db.commit()
    rows = db.query(CategoryBudget).filter(CategoryBudget.user_id == current_user.id).all()
    b = get_user_budget(db, current_user.id)
    b.monthly_budget = sum(r.budget_limit for r in rows)
    b.fixed_bills = 0
    db.commit()
    return {row.category: row.budget_limit for row in rows}


@app.delete("/category-budgets/{category}")
def delete_category_budget(
    category: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat_clean = category.strip()
    existing = (
        db.query(CategoryBudget)
        .filter(
            CategoryBudget.user_id == current_user.id,
            CategoryBudget.category == cat_clean,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
    rows = db.query(CategoryBudget).filter(CategoryBudget.user_id == current_user.id).all()
    b = get_user_budget(db, current_user.id)
    b.monthly_budget = sum(r.budget_limit for r in rows)
    b.fixed_bills = 0
    db.commit()
    return {"deleted": cat_clean}


def _check_category_alerts(db: Session, user_id: int) -> List[dict]:
    start, end = month_range(None)
    cat_budgets = (
        db.query(CategoryBudget)
        .filter(CategoryBudget.user_id == user_id, CategoryBudget.budget_limit > 0)
        .all()
    )
    if not cat_budgets:
        return []

    by_cat = dict(
        db.query(Expense.category, func.sum(Expense.amount))
        .filter(
            Expense.user_id == user_id,
            Expense.spent_on >= start,
            Expense.spent_on <= end,
        )
        .group_by(Expense.category)
        .all()
    )

    alerts = []
    for cb in cat_budgets:
        spent = by_cat.get(cb.category, 0)
        if spent >= cb.budget_limit:
            alerts.append({
                "category": cb.category,
                "budget": cb.budget_limit,
                "spent": round(spent, 2),
                "over_by": round(spent - cb.budget_limit, 2),
                "severity": "over",
            })
        elif spent >= cb.budget_limit * 0.8:
            alerts.append({
                "category": cb.category,
                "budget": cb.budget_limit,
                "spent": round(spent, 2),
                "remaining": round(cb.budget_limit - spent, 2),
                "severity": "warning",
            })
    return alerts


# ---------- Dashboard (Scoped to User) ----------
def month_range(month: Optional[str]):
    if month:
        try:
            y, m = map(int, month.split("-"))
        except ValueError:
            raise HTTPException(400, "month must look like 2026-10")
    else:
        t = today()
        y, m = t.year, t.month
    last = calendar.monthrange(y, m)[1]
    return date(y, m, 1), date(y, m, last)


@app.get("/dashboard")
def dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = today()
    start, end = month_range(None)
    b = get_user_budget(db, current_user.id)

    spent = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == current_user.id,
            Expense.spent_on >= start,
            Expense.spent_on <= end,
        )
        .scalar()
    )
    spent_today = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.user_id == current_user.id, Expense.spent_on == t)
        .scalar()
    )
    by_cat = (
        db.query(Expense.category, func.sum(Expense.amount))
        .filter(
            Expense.user_id == current_user.id,
            Expense.spent_on >= start,
            Expense.spent_on <= end,
        )
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    cat_budgets = {
        cb.category: cb.budget_limit
        for cb in db.query(CategoryBudget).filter(CategoryBudget.user_id == current_user.id).all()
    }
    total_cat_budget = sum(cat_budgets.values())
    effective_budget = total_cat_budget if total_cat_budget > 0 else b.monthly_budget

    days_left = (end - t).days + 1
    remaining = effective_budget - spent
    safe_per_day = remaining / days_left if days_left > 0 else 0

    categories = []
    all_cat_names = set([c for c, _ in by_cat] + list(cat_budgets.keys()))
    spent_map = dict(by_cat)

    for c in sorted(all_cat_names):
        total = spent_map.get(c, 0.0)
        cat_info = {
            "category": c,
            "total": round(total, 2),
            "percent": round(total / spent * 100) if spent else 0,
        }
        if c in cat_budgets:
            limit = cat_budgets[c]
            cat_info["budget"] = limit
            cat_info["budget_percent"] = round(total / limit * 100) if limit else 0
            cat_info["over"] = total >= limit
            cat_info["warning"] = total >= limit * 0.8
        categories.append(cat_info)

    categories.sort(key=lambda x: (x.get("over", False), x["total"]), reverse=True)
    alerts = _check_category_alerts(db, current_user.id)

    return {
        "user": user_out(current_user),
        "month": t.strftime("%B %Y"),
        "monthly_budget": round(effective_budget, 2),
        "spent": round(spent, 2),
        "spent_today": round(spent_today, 2),
        "remaining": round(remaining, 2),
        "days_left": days_left,
        "safe_to_spend": round(safe_per_day, 2),
        "budget_set": effective_budget > 0,
        "categories": categories,
        "category_budgets": cat_budgets,
        "alerts": alerts,
    }
