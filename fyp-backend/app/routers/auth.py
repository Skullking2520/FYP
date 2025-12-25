# auth.py
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserRead
from app.utils.jwt_handler import create_access_token
from app.utils.password_hash import hash_password, verify_password


router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    user = User(
        email=user_in.email,
        password=hash_password(user_in.password),
        name=user_in.name,
        age=user_in.age,
        country=user_in.country,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)


@router.post("/login", response_model=Token)
def login_user(user_in: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    token = create_access_token({"sub": str(user.id)}, expires_delta)
    return Token(access_token=token, token_type="bearer")
