import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from db import User, UserSession, get_db


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a cryptographically secure random salt."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + "$" + key.hex()


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored salt$key hash."""
    try:
        salt_hex, key_hex = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def create_session(db: Session, user_id: int) -> str:
    """Generate a high-entropy bearer token and save session to database."""
    token = secrets.token_urlsafe(32)
    session = UserSession(token=token, user_id=user_id)
    db.add(session)
    db.commit()
    return token


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency to extract and authenticate user from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[len("Bearer ") :].strip()
    session = db.query(UserSession).filter(UserSession.token == token).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )
    return user
