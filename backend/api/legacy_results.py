"""
Global legacy-results APIs that mirror the old CLI/TUI helpers.
"""

from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from api.schemas import RepoStat
from core.database import get_db
from core.config import get_settings
from models.models import IssueDecision, Task, User
from services.result_loader import (
    build_repo_stats,
    issue_key,
    load_global_issues,
    load_task_issues,
)


router = APIRouter(prefix="/api/legacy", tags=["legacy"])
settings = get_settings()


def _get_all_available_languages() -> str:
    """Scan the results root directory to find all available languages."""
    if not settings.RESULTS_ROOT.exists():
        return "cpp"

    langs = []
    for p in settings.RESULTS_ROOT.iterdir():
        if p.is_dir() and not p.name.startswith("."):
            langs.append(p.name)

    return ",".join(langs) if langs else "cpp"


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

    if all_issues:
        return build_repo_stats(all_issues)

    return build_repo_stats(load_global_issues(settings.RESULTS_ROOT, _get_all_available_languages()))
