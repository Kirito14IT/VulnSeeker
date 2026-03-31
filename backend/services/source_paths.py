"""
Helpers for resolving and validating server-local source paths used by web tasks.
"""

from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.config import get_settings
from src.utils.common_functions import get_all_dbs


settings = get_settings()


def resolve_server_path(raw_path: str) -> Path:
    candidate = Path(raw_path.strip()).expanduser()
    if not candidate.is_absolute():
        candidate = settings.VULNSEEKER_ROOT / candidate
    return candidate.resolve(strict=False)


def normalize_local_db_path(raw_path: str) -> Path:
    path = resolve_server_path(raw_path)
    if path.name == "codeql-database.yml":
        path = path.parent

    if not path.exists():
        raise ValueError(f"Local database path does not exist: {path}")
    if not path.is_dir():
        raise ValueError(f"Local database path must be a directory: {path}")
    if not get_all_dbs(str(path)):
        raise ValueError(
            "Local database path must point to a CodeQL database directory or a folder containing one"
        )
    return path


def normalize_local_source_path(raw_path: str) -> Path:
    path = resolve_server_path(raw_path)
    if not path.exists():
        raise ValueError(f"Local source path does not exist: {path}")
    if not path.is_dir():
        raise ValueError(f"Local source path must be a directory: {path}")
    return path
