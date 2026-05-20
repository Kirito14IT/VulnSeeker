"""
FastAPI router for task CRUD operations.
"""

import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.models import User, TaskSource
from services.analysis_service import AnalysisService
from services.source_paths import normalize_local_db_path, normalize_local_source_path
from services.task_workspace import TaskArtifactCleanupError
from api.auth import get_current_user
from api.schemas import TaskCreate, TaskResponse


router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def parse_github_repo(url: str) -> str:
    """
    Parses a GitHub repository string into 'org/repo' format.
    Supports both 'org/repo' and full 'https://github.com/org/repo' formats.
    """
    if not url:
        return ""
        
    url = url.strip()
    
    # Remove .git suffix
    if url.endswith('.git'):
        url = url[:-4]
        
    # Remove trailing slashes
    url = url.rstrip('/')
    
    # Check for github.com URLs
    match = re.search(r'(?:https?://)?(?:www\.)?github\.com/([^/]+)/([^/]+)', url)
    if match:
        return f"{match.group(1)}/{match.group(2)}"
    
    # Check for org/repo format
    parts = url.split('/')
    if len(parts) == 2 and not url.startswith('http'):
        return url
        
    return ""


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    source_type = body.source_type

    if source_type == TaskSource.GITHUB:
        repo_url = parse_github_repo(body.repo_url or "")
        if not repo_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GitHub mode requires repo_url in 'org/repo' or 'https://github.com/org/repo' format",
            )
        source_path = None
    else:
        if not body.source_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Local modes require source_path",
            )
        try:
            normalized_path = (
                normalize_local_db_path(body.source_path)
                if source_type == TaskSource.LOCAL_DB
                else normalize_local_source_path(body.source_path)
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        source_path = str(normalized_path)
        repo_url = source_path

    task = await service.create_task(
        current_user.id,
        repo_url,
        body.language,
        source_type=source_type,
        source_path=source_path,
        force=body.force,
    )
    return TaskResponse.model_validate(task)


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    tasks = await service.list_tasks(current_user.id)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    task = await service.get_task(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AnalysisService(db)
    try:
        deleted = await service.delete_task(task_id, current_user.id)
    except TaskArtifactCleanupError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
