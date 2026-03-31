"""
SQLAlchemy ORM models for the VulnSeeker web application.
"""

from datetime import datetime
from typing import Optional
from enum import Enum as PyEnum

from sqlalchemy import (
    String,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    Enum,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from core.database import Base


class TaskStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskSource(str, PyEnum):
    GITHUB = "github"
    LOCAL_DB = "local_db"
    LOCAL_SRC = "local_src"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=True
    )

    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="user", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    repo_url: Mapped[str] = mapped_column(String(512), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), default=TaskSource.GITHUB.value, nullable=False)
    source_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    force: Mapped[bool] = mapped_column("force_run", Boolean, default=False, nullable=False)
    language: Mapped[str] = mapped_column(String(16), nullable=False, default="c")
    status: Mapped[str] = mapped_column(String(32), default=TaskStatus.PENDING.value, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="tasks")
    issue_decisions: Mapped[list["IssueDecision"]] = relationship(
        "IssueDecision", back_populates="task", cascade="all, delete-orphan"
    )


class IssueDecision(Base):
    """
    Stores a user's manual verdict for a specific issue within a task.
    One row per (task_id, issue_id) pair.
    """
    __tablename__ = "issue_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    issue_id: Mapped[str] = mapped_column(String(128), nullable=False)
    decision: Mapped[str] = mapped_column(String(32), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    task: Mapped["Task"] = relationship("Task", back_populates="issue_decisions")
