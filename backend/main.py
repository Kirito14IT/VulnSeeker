"""
FastAPI main entry point with Socket.IO for real-time task logs.
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Support running uvicorn from the backend/ directory while importing the shared
# legacy engine from the repository root.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.config import get_settings
from core.database import init_db
from api import auth, legacy_results, results, system, tasks
from tasks import run_analysis


settings = get_settings()

# ── Socket.IO server ───────────────────────────────────────────────────────────

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
)

# Wire sio into the background task module so it can emit events
run_analysis.set_socketio(sio)


@sio.event
async def connect(sid, environ):
    pass


@sio.event
async def disconnect(sid):
    pass


@sio.event
async def join_task(sid, data):
    """Client requests to join a task's WebSocket room."""
    task_id = data.get("task_id")
    if task_id:
        await sio.enter_room(sid, f"task_{task_id}")


@sio.event
async def leave_task(sid, data):
    task_id = data.get("task_id")
    if task_id:
        await sio.leave_room(sid, f"task_{task_id}")


# ── FastAPI app ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create database tables
    await init_db()
    yield
    # Shutdown: cleanup if needed


app = socketio.ASGIApp(
    sio,
    FastAPI(
        title="VulnSeeker API",
        description="Web API for VulnSeeker automated CodeQL + LLM security analysis",
        version="1.0.0",
        lifespan=lifespan,
    ),
)

# ── FastAPI sub-app reference (stored inside ASGIApp) ────────────────────────
fastapi_app = app.other_asgi_app


# Apply CORS to FastAPI routes
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In dev; restrict to FRONTEND_URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount routers
fastapi_app.include_router(auth.router)
fastapi_app.include_router(tasks.router)
fastapi_app.include_router(results.router)
fastapi_app.include_router(legacy_results.router)
fastapi_app.include_router(system.router)


# ── Start task endpoint (triggers background analysis) ────────────────────────

from fastapi import BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from models.models import User
from models.models import TaskStatus
from api.auth import get_current_user
from api.schemas import TaskResponse


async def _start_analysis_background(
    task_id: int,
    repo_url: str,
    language: str,
    source_type: str,
    source_path: str | None,
    force: bool,
):
    """Background task that runs the analysis and pushes logs via Socket.IO."""
    await run_analysis.run_analysis(task_id, repo_url, language, source_type, source_path, force)


@fastapi_app.post(
    "/api/tasks/{task_id}/start",
    response_model=TaskResponse,
    tags=["tasks"],
)
async def start_task(
    task_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger analysis for an existing pending task.
    The analysis runs in the background and logs are streamed via WebSocket at /socket.io/?task_id={task_id}.
    """
    from services.analysis_service import AnalysisService
    service = AnalysisService(db)
    task = await service.get_task(task_id, current_user.id)
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ("pending", "failed"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Task is already running or completed")

    # Reset to pending before starting
    await service.update_task_status(task_id, TaskStatus.PENDING, error_message=None, result_path=None)

    background_tasks.add_task(
        _start_analysis_background,
        task_id,
        task.repo_url,
        task.language,
        str(task.source_type),
        task.source_path,
        task.force,
    )

    # Return updated task
    await db.refresh(task)
    from api.schemas import TaskResponse
    return TaskResponse.model_validate(task)


@fastapi_app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}


# ── ASGI app export (for uvicorn) ─────────────────────────────────────────────

application = app  # alias used by uvicorn
