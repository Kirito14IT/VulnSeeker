"""
Background analysis runner for web tasks.

Runs the legacy pipeline in a dedicated subprocess inside a per-task workspace,
streams logs over Socket.IO, and persists the same log lines to disk.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import traceback
from pathlib import Path
from typing import Any

from core.config import get_settings
from core.timezone import local_now
from models.models import TaskStatus
from services.task_workspace import (
    get_task_logs_path,
    get_task_results_root,
    prepare_task_workspace,
)


settings = get_settings()
logger = logging.getLogger(__name__)

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
    log_path = get_task_logs_path(task_id)
    if not log_path.parent.exists():
        return

    payload = {
        "type": msg_type,
        "content": content,
        "timestamp": local_now().isoformat(),
    }
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


def _run_worker_blocking(cmd: list[str], cwd: str, env: dict[str, str]) -> tuple[int, list[str], list[str]]:
    process = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    stdout, stderr = process.communicate()
    return process.returncode, stdout.splitlines(), stderr.splitlines()


async def _run_worker_async_streaming(
    task_id: int,
    cmd: list[str],
    cwd: str,
    env: dict[str, str],
) -> int:
    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=cwd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    await asyncio.gather(
        _stream_output(task_id, process.stdout, "log"),
        _stream_output(task_id, process.stderr, "error"),
    )
    return await process.wait()


async def _run_worker_cross_platform(
    task_id: int,
    cmd: list[str],
    cwd: str,
    env: dict[str, str],
) -> int:
    if os.name == "nt":
        return_code, stdout_lines, stderr_lines = await asyncio.to_thread(
            _run_worker_blocking,
            cmd,
            cwd,
            env,
        )
        for line in stdout_lines:
            content = line.rstrip()
            if content:
                await _append_log(task_id, "log", content)
        for line in stderr_lines:
            content = line.rstrip()
            if content:
                await _append_log(task_id, "error", content)
        return return_code

    try:
        return await _run_worker_async_streaming(task_id, cmd, cwd, env)
    except NotImplementedError:
        logger.warning("Async subprocess unsupported; falling back to blocking worker runner")
        return_code, stdout_lines, stderr_lines = await asyncio.to_thread(
            _run_worker_blocking,
            cmd,
            cwd,
            env,
        )
        for line in stdout_lines:
            content = line.rstrip()
            if content:
                await _append_log(task_id, "log", content)
        for line in stderr_lines:
            content = line.rstrip()
            if content:
                await _append_log(task_id, "error", content)
        return return_code


def _count_final_results(task_id: int) -> int:
    results_root = get_task_results_root(task_id)
    if not results_root.exists():
        return 0
    return sum(1 for _ in results_root.rglob("*_final.json"))


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

        # Resolve enum to string if needed
        if hasattr(source_type, "value"):
            mode_value = source_type.value
        else:
            mode_value = str(source_type)

        # Fix if it got serialized as 'TaskSource.GITHUB' string
        if isinstance(mode_value, str):
            if mode_value.startswith("TaskSource."):
                mode_value = mode_value.split(".", 1)[1].lower()
            elif mode_value.isupper():
                mode_value = mode_value.lower()

        cmd = [
            analysis_python,
            str(worker_script),
            "--mode",
            mode_value,
            "--language",
            language,
            "--workspace",
            str(workspace),
        ]
        if force:
            cmd.append("--force")
        if mode_value == "github":
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
        env.setdefault("PYTHONUNBUFFERED", "1")
        if os.name == "nt":
            env.setdefault("PYTHONUTF8", "1")
            env.setdefault("PYTHONIOENCODING", "utf-8")

        await _append_log(task_id, "log", "Launching legacy analysis engine")
        return_code = await _run_worker_cross_platform(task_id, cmd, str(workspace), env)

        if return_code != 0:
            message = f"Analysis worker exited with code {return_code}"
            await update_task_status(task_id, TaskStatus.FAILED, error_message=message)
            await _append_log(task_id, "error", message)
            return

        result_path = str(get_task_results_root(task_id))
        final_count = _count_final_results(task_id)
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
        # Keep DB error_message concise while streaming full traceback to logs.
        summary = f"{exc.__class__.__name__}: {exc}" if str(exc) else exc.__class__.__name__
        await update_task_status(task_id, TaskStatus.FAILED, error_message=summary)
        await _append_log(task_id, "error", f"Unexpected error: {summary}")

        tb = traceback.format_exc().rstrip()
        logger.exception("Task %s failed with unexpected exception", task_id)
        for line in tb.splitlines():
            await _append_log(task_id, "error", line)
