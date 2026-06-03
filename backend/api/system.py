"""
System helper APIs that mirror legacy CLI support commands.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from api.schemas import ConfigValidationResponse, RepoStat
from core.database import get_db
from models.models import IssueDecision, Task, User
from services.result_loader import build_repo_stats, issue_key, load_task_issues
from src.utils.config_validator import validate_all_config
from src.utils.get_ql_deps import generate_and_install_deps


router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/validate", response_model=ConfigValidationResponse)
async def validate_config(current_user: User = Depends(get_current_user)):
    valid, errors = validate_all_config()
    return ConfigValidationResponse(valid=valid, errors=errors)


@router.post("/fetch-ql-deps")
def fetch_ql_deps(current_user: User = Depends(get_current_user)):
    generate_and_install_deps()
    return {"status": "ok"}


@router.get("/stats", response_model=list[RepoStat])
async def list_repo_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).where(Task.result_path.is_not(None)).order_by(Task.created_at.desc())
    result = await db.execute(stmt)
    tasks = result.scalars().all()

    all_issues = []
    for task in tasks:
        if not task.result_path:
            continue

        results_root = Path(task.result_path)
        if not results_root.exists():
            continue

        issues = load_task_issues(results_root, task.language)
        decisions_result = await db.execute(
            select(IssueDecision).where(IssueDecision.task_id == task.id)
        )
        decisions = {record.issue_id: record.decision for record in decisions_result.scalars()}

        for issue in issues:
            issue.manual_decision = decisions.get(issue_key(issue)) or decisions.get(issue.id)
            issue.repo = task.repo_url
        all_issues.extend(issues)

    return build_repo_stats(all_issues)
