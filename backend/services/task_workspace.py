"""
Helpers for managing isolated per-task workspaces for web analysis runs.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from core.config import get_settings


settings = get_settings()


def get_task_root(task_id: int) -> Path:
    return settings.WEB_TASKS_ROOT / f"task_{task_id}"


def get_task_workspace(task_id: int) -> Path:
    return get_task_root(task_id) / "workspace"


def get_task_results_root(task_id: int) -> Path:
    return get_task_workspace(task_id) / "output" / "results"


def get_task_result_path(task_id: int, language: str) -> Path:
    return get_task_results_root(task_id) / language


def get_task_logs_path(task_id: int) -> Path:
    return get_task_root(task_id) / "task.log"


def _safe_link_or_copy(src: Path, dst: Path, *, directory: bool = False) -> None:
    if dst.exists() or dst.is_symlink():
        return
    try:
        dst.symlink_to(src, target_is_directory=directory)
    except OSError:
        if directory:
            shutil.copytree(src, dst, dirs_exist_ok=True)
        else:
            shutil.copy2(src, dst)


def prepare_task_workspace(task_id: int) -> Path:
    """
    Create a clean isolated workspace for a task and project in the minimal assets
    needed by the legacy CLI engine.
    """
    task_root = get_task_root(task_id)
    workspace = get_task_workspace(task_id)

    if workspace.exists():
        shutil.rmtree(workspace)

    workspace.mkdir(parents=True, exist_ok=True)
    task_root.mkdir(parents=True, exist_ok=True)

    _safe_link_or_copy(settings.VULNSEEKER_ROOT / "data", workspace / "data", directory=True)

    output_dir = workspace / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "results").mkdir(parents=True, exist_ok=True)

    shared_databases_root = settings.DATABASES_ROOT
    shared_databases_root.mkdir(parents=True, exist_ok=True)
    _safe_link_or_copy(shared_databases_root, output_dir / "databases", directory=True)

    shared_zip_root = settings.VULNSEEKER_ROOT / "output" / "zip_dbs"
    shared_zip_root.mkdir(parents=True, exist_ok=True)
    _safe_link_or_copy(shared_zip_root, output_dir / "zip_dbs", directory=True)

    if settings.ROOT_ENV_FILE.exists():
        env_source = settings.ROOT_ENV_FILE
    elif settings.BACKEND_ENV_FILE.exists():
        env_source = settings.BACKEND_ENV_FILE
    else:
        env_source = settings.ROOT_ENV_EXAMPLE_FILE
    if env_source.exists():
        _safe_link_or_copy(env_source, workspace / ".env", directory=False)

    return workspace
