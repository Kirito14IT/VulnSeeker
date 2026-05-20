"""
Helpers for managing isolated per-task workspaces for web analysis runs.
"""

from __future__ import annotations

import os
import re
import shutil
import stat
from pathlib import Path

from core.config import get_settings


settings = get_settings()


class TaskArtifactCleanupError(RuntimeError):
    """Raised when a task's on-disk artifacts cannot be removed."""


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


def _ensure_web_task_child(path: Path) -> None:
    root = settings.WEB_TASKS_ROOT.resolve(strict=False)
    parent = path.parent.resolve(strict=False)
    if parent != root:
        raise TaskArtifactCleanupError(f"Refusing to delete outside web task root: {path}")


def _make_writable_and_retry(func, path: str, _exc_info) -> None:
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _remove_task_root(task_root: Path) -> None:
    _ensure_web_task_child(task_root)

    if not task_root.exists() and not task_root.is_symlink():
        return

    try:
        if task_root.is_symlink() or task_root.is_file():
            task_root.unlink()
            return

        resolved_root = settings.WEB_TASKS_ROOT.resolve(strict=False)
        resolved_target = task_root.resolve(strict=False)
        if not resolved_target.is_relative_to(resolved_root):
            raise TaskArtifactCleanupError(
                f"Refusing to recursively delete outside web task root: {resolved_target}"
            )

        shutil.rmtree(task_root, onerror=_make_writable_and_retry)
    except TaskArtifactCleanupError:
        raise
    except OSError as exc:
        raise TaskArtifactCleanupError(f"Failed to delete task artifacts at {task_root}: {exc}") from exc


def clear_task_artifacts(task_id: int) -> None:
    """
    Remove stale on-disk artifacts for a web task id.

    MySQL auto-increment ids can be reused after a development database reset,
    while output/web_tasks/task_<id>/ may still contain logs from the old task.
    Clearing the task root when a fresh DB task is created prevents those old
    logs/results from appearing before the new task has actually run.
    """
    _remove_task_root(get_task_root(task_id))


def clear_orphan_task_artifacts(existing_task_ids: set[int]) -> tuple[list[int], list[str]]:
    """
    Delete output/web_tasks/task_<id> folders that no longer have DB records.
    """
    root = settings.WEB_TASKS_ROOT
    if not root.exists():
        return [], []

    removed: list[int] = []
    errors: list[str] = []
    for child in root.iterdir():
        match = re.fullmatch(r"task_(\d+)", child.name)
        if not match:
            continue
        task_id = int(match.group(1))
        if task_id in existing_task_ids:
            continue
        try:
            _remove_task_root(child)
            removed.append(task_id)
        except TaskArtifactCleanupError as exc:
            errors.append(str(exc))
    return removed, errors


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

    return workspace
