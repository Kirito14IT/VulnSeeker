"""
Background analysis runner for web tasks.

Runs the legacy pipeline in a dedicated subprocess inside a per-task workspace,
streams logs over Socket.IO, and persists the same log lines to disk.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from core.config import get_settings
from models.models import TaskStatus
from services.task_workspace import (
    get_task_logs_path,
    get_task_result_path,
    get_task_results_root,
    prepare_task_workspace,
)


settings = get_settings()

# Global sio reference (set in main.py)
_sio: Any = None


def set_socketio(sio: Any) -> None:
    global _sio
    _sio = sio


async def _emit(task_id: int, payload: dict) -> None:
    if _sio is not None:
        await _sio.emit(f"task_{task_id}", payload)


async def update_task_status(
    task_id: int,
    status: TaskStatus,
    error_message: str | None = None,
    result_path: str | None = None,
) -> None:
    from core.database import AsyncSessionLocal
    from services.analysis_service import AnalysisService

    async with AsyncSessionLocal() as db:
        service = AnalysisService(db)
        await service.update_task_status(task_id, status, error_message, result_path)


async def _append_log(task_id: int, msg_type: str, content: str) -> None:
    payload = {
        "type": msg_type,
        "content": content,
        "timestamp": datetime.utcnow().isoformat(),
    }
    log_path = get_task_logs_path(task_id)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
    await _emit(task_id, payload)


async def _stream_output(task_id: int, stream: asyncio.StreamReader | None, msg_type: str) -> None:
    if stream is None:
        return
    while True:
        line = await stream.readline()
        if not line:
            break
        content = line.decode("utf-8", errors="replace").rstrip()
        if content:
            await _append_log(task_id, msg_type, content)


def _count_final_results(task_id: int, language: str) -> int:
    results_dir = get_task_result_path(task_id, language)
    if not results_dir.exists():
        return 0
    return sum(1 for _ in results_dir.rglob("*_final.json"))


def _count_raw_results(task_id: int) -> int:
    results_root = get_task_results_root(task_id)
    if not results_root.exists():
        return 0
    return sum(1 for _ in results_root.rglob("*_raw.json"))


async def run_analysis(
    task_id: int,
    repo_url: str,
    language: str,
    source_type: str,
    source_path: str | None,
    force: bool,
) -> None:
    worker_script = settings.VULNSEEKER_ROOT / "backend" / "tasks" / "analysis_worker.py"
    log_path = get_task_logs_path(task_id)
    if log_path.exists():
        log_path.unlink()

    try:
        workspace = prepare_task_workspace(task_id)
        analysis_python = settings.ANALYSIS_PYTHON_EXECUTABLE
        await update_task_status(task_id, TaskStatus.RUNNING, error_message=None)
        await _append_log(task_id, "status", f"Task started in isolated workspace: {workspace}")
        await _append_log(task_id, "log", f"Worker interpreter: {analysis_python}")

        cmd = [
            analysis_python,
            str(worker_script),
            "--mode",
            source_type,
            "--language",
            language,
            "--workspace",
            str(workspace),
        ]
        if force:
            cmd.append("--force")
        if source_type == "github":
            cmd.extend(["--repo-url", repo_url])
        elif source_path:
            cmd.extend(["--source-path", source_path])

        env = os.environ.copy()
        existing_pythonpath = env.get("PYTHONPATH")
        env["PYTHONPATH"] = (
            f"{settings.VULNSEEKER_ROOT}{os.pathsep}{existing_pythonpath}"
            if existing_pythonpath
            else str(settings.VULNSEEKER_ROOT)
        )

        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(workspace),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        await _append_log(task_id, "log", "Launching legacy analysis engine")

        await asyncio.gather(
            _stream_output(task_id, process.stdout, "log"),
            _stream_output(task_id, process.stderr, "error"),
        )
        return_code = await process.wait()

        if return_code != 0:
            message = f"Analysis worker exited with code {return_code}"
            await update_task_status(task_id, TaskStatus.FAILED, error_message=message)
            await _append_log(task_id, "error", message)
            return

        result_path = str(get_task_result_path(task_id, language))
        final_count = _count_final_results(task_id, language)
        if final_count == 0:
            raw_count = _count_raw_results(task_id)
            if raw_count == 0:
                message = "Analysis completed with no issues found."
                await update_task_status(
                    task_id,
                    TaskStatus.COMPLETED,
                    error_message=None,
                    result_path=result_path,
                )
                await _append_log(task_id, "done", message)
                return

            message = (
                "Analysis finished without finalized LLM results. "
                f"raw={raw_count}, final={final_count}. Check LLM/API configuration."
            )
            await update_task_status(
                task_id,
                TaskStatus.FAILED,
                error_message=message,
                result_path=result_path,
            )
            await _append_log(task_id, "error", message)
            return

        await update_task_status(
            task_id,
            TaskStatus.COMPLETED,
            error_message=None,
            result_path=result_path,
        )
        await _append_log(task_id, "done", f"Analysis complete with {final_count} finalized issue(s)")
    except Exception as exc:
        await update_task_status(task_id, TaskStatus.FAILED, error_message=str(exc))
        await _append_log(task_id, "error", f"Unexpected error: {exc}")
