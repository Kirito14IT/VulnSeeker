"""
Pydantic schemas for FastAPI request / response models.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

from models.models import TaskSource


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Tasks ─────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    source_type: TaskSource = Field(default=TaskSource.GITHUB, description="Task source mode")
    repo_url: Optional[str] = Field(default=None, max_length=512, description="GitHub repo in org/repo format")
    source_path: Optional[str] = Field(default=None, max_length=1024, description="Server-local path for local_db/local_src")
    language: str = Field(default="c", max_length=16, description="Programming language code")
    force: bool = Field(default=False, description="Force re-download or re-build when supported")


class TaskResponse(BaseModel):
    id: int
    user_id: int
    repo_url: str
    source_type: TaskSource
    source_path: Optional[str]
    force: bool
    language: str
    status: str
    error_message: Optional[str]
    result_path: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Issues ─────────────────────────────────────────────────────────────────────

class IssueSummary(BaseModel):
    """Lightweight issue summary for the issues list table."""
    id: str
    name: str
    file: str
    line: int
    status: str
    finalized: bool = True
    issue_type: str
    repo: str
    manual_decision: Optional[str] = None


class CodeSnippet(BaseModel):
    label: str
    language: str = "cpp"
    content: str


class IssueDetail(BaseModel):
    """Full issue detail returned when a single issue is opened."""
    id: str
    name: str
    file: str
    line: int
    status: str
    issue_type: str
    repo: str
    manual_decision: Optional[str] = None
    snippets: List[CodeSnippet] = []
    summary: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    final_data: Optional[List[Dict[str, Any]]] = None


class IssueDecisionUpdate(BaseModel):
    decision: Optional[str] = Field(
        default=None,
        description="Manual decision: 'True Positive', 'False Positive', 'Uncertain', or null",
    )


# ── WebSocket ─────────────────────────────────────────────────────────────────

class WSMessage(BaseModel):
    type: str  # "log" | "status" | "error" | "done"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.utcnow())


class TaskLogResponse(BaseModel):
    lines: List[WSMessage]


class RepoStat(BaseModel):
    repo: str
    total: int
    true_count: int
    false_count: int
    more_count: int


class ConfigValidationResponse(BaseModel):
    valid: bool
    errors: List[str]
