"""
Authentication service: user registration and login.
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import User
from core.security import hash_password, verify_password, create_access_token


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, username: str, email: str, password: str) -> tuple[User, str]:
        """
        Create a new user account and return the user + JWT token.
        Raises ValueError if username or email already exists.
        """
        # Check duplicate
        stmt = select(User).where((User.username == username) | (User.email == email))
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            if existing.username == username:
                raise ValueError(f"Username '{username}' is already taken.")
            raise ValueError(f"Email '{email}' is already registered.")

        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        token = create_access_token(data={"sub": str(user.id), "username": user.username})
        return user, token

    async def authenticate(self, username: str, password: str) -> Optional[User]:
        """
        Verify credentials and return the User if valid, None otherwise.
        """
        stmt = select(User).where(User.username == username)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
