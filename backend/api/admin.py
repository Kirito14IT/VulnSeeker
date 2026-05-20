"""
Admin-only routes for user management.
All endpoints require authentication with role=admin.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from core.database import get_db
from core.security import hash_password
from models.models import User
from api.auth import get_current_user
from api.schemas import (
    UserResponse,
    UserCreateByAdmin,
    UserUpdate,
)


router = APIRouter(prefix="/api/admin", tags=["admin"])


async def get_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency: requires the authenticated user to have admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users."""
    stmt = select(User).order_by(User.created_at.desc())
    result = await db.execute(stmt)
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single user by ID."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreateByAdmin,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (admin only)."""
    # Check for duplicate username / email
    stmt = select(User).where((User.username == body.username) | (User.email == body.email))
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        if existing.username == body.username:
            raise HTTPException(status_code=409, detail=f"Username '{body.username}' is already taken.")
        raise HTTPException(status_code=409, detail=f"Email '{body.email}' is already registered.")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing user's fields (admin only)."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check username uniqueness if changing
    if body.username is not None and body.username != user.username:
        dup = await db.execute(select(User).where(User.username == body.username))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Username '{body.username}' is already taken.")
        user.username = body.username

    # Check email uniqueness if changing
    if body.email is not None and body.email != user.email:
        dup = await db.execute(select(User).where(User.email == body.email))
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Email '{body.email}' is already registered.")
        user.email = body.email

    if body.password is not None:
        user.password_hash = hash_password(body.password)

    if body.role is not None:
        user.role = body.role

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user by ID (admin only). Prevent admin from deleting themselves."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
