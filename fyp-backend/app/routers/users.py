# users.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.config import is_admin_email
from app.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.profile import UserProfile, UserProfileResponse, UserProfileUpdate
from app.services.profile_service import get_user_profile, save_user_profile
from app.schemas.user import UserRead, UserUpdate


router = APIRouter()


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserRead:
    user_out = UserRead.model_validate(current_user)
    return user_out.model_copy(update={"is_admin": is_admin_email(current_user.email)})


@router.put("/me", response_model=UserRead)
def update_current_user(update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> UserRead:
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    user_out = UserRead.model_validate(current_user)
    return user_out.model_copy(update={"is_admin": is_admin_email(current_user.email)})


@router.get("/me/profile", response_model=UserProfileResponse)
def read_my_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    profile = get_user_profile(db, current_user.id) or UserProfile()
    return UserProfileResponse(profile=profile, metadata={})


@router.put("/me/profile", response_model=UserProfileResponse)
def update_my_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    saved = save_user_profile(db, current_user.id, payload)
    return UserProfileResponse(profile=saved, metadata={})
