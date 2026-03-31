"""
Global legacy-results APIs that mirror the old CLI/TUI helpers.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.auth import get_current_user
from api.schemas import IssueDecisionUpdate, IssueDetail, IssueSummary, RepoStat
from core.config import get_settings
from models.models import User
from services.result_loader import (
    _issue_to_detail,
    _issue_to_summary,
    build_repo_stats,
    load_global_issues,
)
from src.ui.results_loader import ResultsLoader


router = APIRouter(prefix="/api/legacy", tags=["legacy"])
settings = get_settings()


@router.get("/issues", response_model=list[IssueSummary])
async def list_global_issues(current_user: User = Depends(get_current_user)):
    issues = load_global_issues(settings.RESULTS_ROOT, "c")
    return [_issue_to_summary(issue, issue.manual_decision) for issue in issues]


@router.get("/issues/{issue_id}", response_model=IssueDetail)
async def get_global_issue(issue_id: str, current_user: User = Depends(get_current_user)):
    issues = load_global_issues(settings.RESULTS_ROOT, "c")
    for issue in issues:
        if issue.id == issue_id:
            return _issue_to_detail(issue, issue.manual_decision)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")


@router.patch("/issues/{issue_id}")
async def update_global_issue_decision(
    issue_id: str,
    body: IssueDecisionUpdate,
    current_user: User = Depends(get_current_user),
):
    issues = load_global_issues(settings.RESULTS_ROOT, "c")
    target = next((issue for issue in issues if issue.id == issue_id), None)
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
async def list_repo_stats(current_user: User = Depends(get_current_user)):
    return build_repo_stats(load_global_issues(settings.RESULTS_ROOT, "c"))
