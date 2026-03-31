"""
Analysis service: wraps the original VulnSeeker engine for use in the web backend.
"""

import sys
from pathlib import Path
from typing import Optional, Any
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import Task, TaskStatus, IssueDecision, TaskSource
from core.config import get_settings


# Ensure VulnSeeker src/ is on the Python path
VULNSEEKER_ROOT = get_settings().VULNSEEKER_ROOT
if str(VULNSEEKER_ROOT) not in sys.path:
    sys.path.insert(0, str(VULNSEEKER_ROOT))

settings = get_settings()
_UNSET = object()


class AnalysisService:
    """
    Provides methods for managing analysis tasks and loading results.
    The actual analysis pipeline is executed in backend.tasks.run_analysis.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_task(
        self,
        user_id: int,
        repo_url: str,
        language: str,
        source_type: TaskSource = TaskSource.GITHUB,
        source_path: Optional[str] = None,
        force: bool = False,
    ) -> Task:
        """Create a new pending task record."""
        task = Task(
            user_id=user_id,
            repo_url=repo_url,
            source_type=source_type.value,
            source_path=source_path,
            force=force,
            language=language,
            status=TaskStatus.PENDING,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def get_task(self, task_id: int, user_id: int) -> Optional[Task]:
        stmt = select(Task).where(Task.id == task_id, Task.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_tasks(self, user_id: int) -> list[Task]:
        stmt = select(Task).where(Task.user_id == user_id).order_by(Task.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def delete_task(self, task_id: int, user_id: int) -> bool:
        task = await self.get_task(task_id, user_id)
        if not task:
            return False
        await self.db.delete(task)
        await self.db.commit()
        return True

    async def update_task_status(
        self,
        task_id: int,
        status: TaskStatus,
        error_message: Optional[str] | Any = _UNSET,
        result_path: Optional[str] | Any = _UNSET,
    ) -> None:
        stmt = select(Task).where(Task.id == task_id)
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return
        task.status = status
        if error_message is not _UNSET:
            task.error_message = error_message
        if result_path is not _UNSET:
            task.result_path = result_path
        if status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
            task.completed_at = datetime.utcnow()
        await self.db.commit()

    async def save_issue_decision(
        self, task_id: int, issue_id: str, decision: str
    ) -> IssueDecision:
        stmt = select(IssueDecision).where(
            IssueDecision.task_id == task_id,
            IssueDecision.issue_id == issue_id,
        )
        result = await self.db.execute(stmt)
        record = result.scalar_one_or_none()
        if record:
            record.decision = decision
        else:
            record = IssueDecision(task_id=task_id, issue_id=issue_id, decision=decision)
            self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return record

    async def get_issue_decisions(self, task_id: int) -> dict[str, str]:
        stmt = select(IssueDecision).where(IssueDecision.task_id == task_id)
        result = await self.db.execute(stmt)
        return {rec.issue_id: rec.decision for rec in result.scalars().all()}
