"""Voice -> text (Groq Whisper) and text -> expenses (local keyword parser).
Gemini removed for speed: the local parser returns JSON instantly (~0ms)."""
import os
import re
from typing import List

import httpx
from pydantic import BaseModel, Field

CATEGORIES = ["Food", "Groceries", "Transport", "Rent", "Fun", "Bills", "Shopping", "Health", "Friends", "Other"]


class ExpenseItem(BaseModel):
    amount: float = Field(description="Amount spent, number only")
    category: str = Field(description="One of: " + ", ".join(CATEGORIES))
    note: str = Field(description="Very short description, e.g. 'lunch'")


class ExpenseList(BaseModel):
    items: List[ExpenseItem]


# ---------- Speech to text ----------
EXT = {"webm": "webm", "mp4": "mp4", "mpeg": "mp3", "mp3": "mp3", "wav": "wav", "ogg": "ogg", "m4a": "m4a", "x-m4a": "m4a"}


def _ext(content_type: str) -> str:
    sub = (content_type or "").split(";")[0].split("/")[-1].lower()
    return EXT.get(sub, "webm")


from dotenv import load_dotenv

load_dotenv(override=True)


async def transcribe(audio: bytes, content_type: str) -> str:
    key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not key:
        load_dotenv(override=True)
        key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set. Add it to backend/.env, or use the typed input.")
    filename = f"audio.{_ext(content_type)}"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {key}"},
            files={"file": (filename, audio, content_type or "audio/webm")},
            data={
                "model": "whisper-large-v3-turbo",
                "response_format": "json",
                "temperature": "0",
                "language": "en",
                "prompt": "Transcribe personal expenses in English only: 120 on lunch, 50 auto, 350 for groceries, 499 netflix, 1000 rent.",
            },
        )
    if r.status_code != 200:
        raise RuntimeError(f"Groq error {r.status_code}: {r.text[:200]}")
    return r.json().get("text", "").strip()


# ---------- Text to expenses (local keyword parser — instant) ----------
KEYWORDS = {
    "Food": [
        "lunch", "dinner", "breakfast", "snack", "tea", "coffee", "biryani",
        "burger", "pizza", "food", "restaurant", "juice", "meal", "dosa",
        "idli", "parotta", "chicken", "mutton", "fish", "samosa", "pani puri",
        "chaat", "noodles", "rice", "chapati", "roti", "thali", "canteen",
        "mess", "tiffin", "eat", "ate", "hotel", "bakery", "cake", "sweet",
        "ice cream", "icecream", "milkshake", "lassi", "soup", "sandwich",
        "shawarma", "wrap", "roll",
    ],
    "Groceries": [
        "grocer", "vegetable", "fruit", "milk", "supermarket", "rice",
        "egg", "oil", "sugar", "atta", "flour", "dal", "provision",
        "kirana", "bigbasket", "blinkit", "zepto", "swiggy instamart",
        "grocery",
    ],
    "Transport": [
        "bus", "auto", "cab", "uber", "ola", "petrol", "fuel", "metro",
        "train", "taxi", "ticket", "travel", "traveled", "travelled",
        "ride", "rapido", "bike", "toll", "parking", "walk", "commute",
        "office", "tambaram", "solliganallur", "siruseri", "pg",
    ],
    "Rent": ["rent", "hostel", "room", "accommodation", "stay", "lodge"],
    "Fun": [
        "movie", "game", "netflix", "party", "concert", "fun", "outing",
        "mall", "chill", "hangout", "hang out", "pub", "bar", "club",
        "spotify", "prime", "hotstar", "youtube premium", "entertainment",
    ],
    "Bills": [
        "bill", "recharge", "electricity", "wifi", "internet", "emi",
        "subscription", "insurance", "phone bill", "mobile bill",
        "water bill", "gas bill", "maintenance",
    ],
    "Shopping": [
        "shirt", "shoes", "shopping", "amazon", "flipkart", "clothes",
        "dress", "pant", "jeans", "watch", "bag", "backpack", "gadget",
        "earphone", "headphone", "charger", "cable", "buy something",
        "bought", "purchase", "myntra", "meesho", "mall",
    ],
    "Health": [
        "medicine", "doctor", "hospital", "pharmacy", "gym", "clinic",
        "tablet", "health", "medical", "test", "scan", "blood test",
        "consultation", "dentist", "eye",
    ],
    "Friends": [
        "friend", "friends", "gift", "treat", "birthday", "party for",
        "gave", "lent", "split", "share", "contributed", "donation",
        "help", "borrow",
    ],
}


WORD_NUMS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90, "hundred": 100, "thousand": 1000,
}


def _words_to_number(text: str) -> float:
    """Helper to detect simple spoken English number words like 'fifty' or 'two hundred'."""
    tokens = re.findall(r"[a-z]+", text.lower())
    total = 0
    current = 0
    found = False
    for t in tokens:
        if t in WORD_NUMS:
            found = True
            v = WORD_NUMS[t]
            if v == 100:
                current = (current or 1) * 100
            elif v == 1000:
                total += (current or 1) * 1000
                current = 0
            else:
                current += v
    if found and (total + current) > 0:
        return float(total + current)
    return 0.0


def _parse_local(text: str) -> List[ExpenseItem]:
    """Fast local parser: splits by conjunctions, extracts amounts + categories."""
    items = []
    # Split on common separators
    for part in re.split(r",|\band\b|\bthen\b|\bafter that\b|\balso\b|\bplus\b|\.|;", text, flags=re.I):
        m = re.search(r"(\d[\d,]*\.?\d*)", part)
        if m:
            amount = float(m.group(1).replace(",", ""))
        else:
            amount = _words_to_number(part)
        if amount <= 0:
            continue
        # Clean up the note
        words = re.sub(
            r"(rs\.?|rupees|inr|₹|\d[\d,]*\.?\d*|\bspent\b|\bpaid\b|\bon\b|\bfor\b|\bi\b|\bgot\b|\bgave\b|\baround\b|\babout\b|\blike\b|\bsome\b|\ba\b|\ban\b|\bthe\b|\bzero\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b|\beleven\b|\btwelve\b|\bthirteen\b|\bfourteen\b|\bfifteen\b|\bsixteen\b|\bseventeen\b|\beighteen\b|\bnineteen\b|\btwenty\b|\bthirty\b|\bforty\b|\bfifty\b|\bsixty\b|\bseventy\b|\beighty\b|\bninety\b|\bhundred\b|\bthousand\b)",
            " ", part, flags=re.I,
        )
        note = " ".join(words.split())[:60] or "expense"
        # Match category
        cat = "Other"
        low = part.lower()
        for c, keys in KEYWORDS.items():
            if any(k in low for k in keys):
                cat = c
                break
        items.append(ExpenseItem(amount=amount, category=cat, note=note))
    return items


def parse_expenses(text: str) -> List[ExpenseItem]:
    """Parse text into expense items using the local keyword parser (instant, no API calls)."""
    items = _parse_local(text)
    for it in items:
        if it.category not in CATEGORIES:
            it.category = "Other"
    return items
