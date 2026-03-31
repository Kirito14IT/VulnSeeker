"""
Task result APIs backed by per-task isolated result snapshots.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import get_current_user
from api.schemas import IssueDecisionUpdate, IssueDetail, IssueSummary, TaskLogResponse, WSMessage
from core.database import get_db
from models.models import IssueDecision, Task, TaskStatus, User
from services.result_loader import _issue_to_detail, _issue_to_summary, find_task_issue, load_task_issues
from services.task_workspace import get_task_logs_path


router = APIRouter(prefix="/api/tasks", tags=["results"])


async def _get_owned_task(task_id: int, user_id: int, db: AsyncSession) -> Task:
    stmt = select(Task).where(Task.id == task_id, Task.user_id == user_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.get("/{task_id}/logs", response_model=TaskLogResponse)
async def get_task_logs(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_task(task_id, current_user.id, db)
    log_path = get_task_logs_path(task_id)
    if not log_path.exists():
        return TaskLogResponse(lines=[])

    lines: list[WSMessage] = []
    with log_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                lines.append(WSMessage.model_validate(json.loads(line)))
            except json.JSONDecodeError:
                continue
    return TaskLogResponse(lines=lines)


@router.get("/{task_id}/issues", response_model=list[IssueSummary])
async def list_issues(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_owned_task(task_id, current_user.id, db)
    if not task.result_path:
        return []

    decisions = {}
    dec_stmt = select(IssueDecision).where(IssueDecision.task_id == task_id)
    dec_result = await db.execute(dec_stmt)
    for record in dec_result.scalars():
        decisions[record.issue_id] = record.decision

    results_root = Path(task.result_path).parent
    issues = load_task_issues(results_root, task.language)
    return [_issue_to_summary(issue, decisions.get(issue.id)) for issue in issues]


@router.get("/{task_id}/issues/{issue_id}", response_model=IssueDetail)
async def get_issue_detail(
    task_id: int,
    issue_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _get_owned_task(task_id, current_user.id, db)
    if not task.result_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No results found")

    results_root = Path(task.result_path).parent
    issue = find_task_issue(results_root, task.language, issue_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue not found")

    decision = None
    dec_stmt = select(IssueDecision).where(
        IssueDecision.task_id == task_id,
        IssueDecision.issue_id == issue_id,
    )
    dec_result = await db.execute(dec_stmt)
    record = dec_result.scalar_one_or_none()
    if record:
        decision = record.decision

    return _issue_to_detail(issue, decision)


@router.patch("/{task_id}/issues/{issue_id}")
async def update_issue_decision(
    task_id: int,
    issue_id: str,
    body: IssueDecisionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_task(task_id, current_user.id, db)

    valid_decisions = {"True Positive", "False Positive", "Uncertain"}
    if body.decision is not None and body.decision not in valid_decisions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision. Must be one of: {sorted(valid_decisions)} or null",
        )

    dec_stmt = select(IssueDecision).where(
        IssueDecision.task_id == task_id,
        IssueDecision.issue_id == issue_id,
    )
    dec_result = await db.execute(dec_stmt)
    record = dec_result.scalar_one_or_none()

    if body.decision is None:
        if record:
            await db.delete(record)
            await db.commit()
        return {"ok": True, "decision": None}

    if record:
        record.decision = body.decision
    else:
        record = IssueDecision(task_id=task_id, issue_id=issue_id, decision=body.decision)
        db.add(record)
    await db.commit()
    return {"ok": True, "decision": body.decision}
