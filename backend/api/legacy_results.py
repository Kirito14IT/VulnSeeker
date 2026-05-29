"""
Global legacy-results APIs that mirror the old CLI/TUI helpers.
"""

from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from api.schemas import IssueDecisionUpdate, IssueDetail, IssueSummary, RepoStat
from core.database import get_db
from core.config import get_settings
from models.models import IssueDecision, Task, User
from services.result_loader import (
    _issue_to_detail,
    _issue_to_summary,
    build_repo_stats,
    issue_key,
    load_global_issues,
    load_task_issues,
)
from src.utils.results_loader import ResultsLoader


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


@router.get("/issues", response_model=list[IssueSummary])
async def list_global_issues(current_user: User = Depends(get_current_user)):
    issues = load_global_issues(settings.RESULTS_ROOT, _get_all_available_languages())
    return [_issue_to_summary(issue, issue.manual_decision) for issue in issues]


@router.get("/issues/{issue_id}", response_model=IssueDetail)
async def get_global_issue(issue_id: str, current_user: User = Depends(get_current_user)):
    issues = load_global_issues(settings.RESULTS_ROOT, _get_all_available_languages())
    for issue in issues:
        if issue_key(issue) == issue_id or issue.id == issue_id:
            return _issue_to_detail(issue, issue.manual_decision)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")


@router.patch("/issues/{issue_id}")
async def update_global_issue_decision(
    issue_id: str,
    body: IssueDecisionUpdate,
    current_user: User = Depends(get_current_user),
):
    issues = load_global_issues(settings.RESULTS_ROOT, _get_all_available_languages())
    target = next((issue for issue in issues if issue_key(issue) == issue_id or issue.id == issue_id), None)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    valid_decisions = {"True Positive", "False Positive", "Uncertain"}
    if body.decision is not None and body.decision not in valid_decisions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision. Must be one of: {sorted(valid_decisions)} or null",
        )

    loader = ResultsLoader(str(settings.RESULTS_ROOT))
    loader.save_manual_decision(target.final_path, body.decision)
    return {"ok": True, "decision": body.decision}


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
