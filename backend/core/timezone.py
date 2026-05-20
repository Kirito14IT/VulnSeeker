"""
Host-local timezone helpers for backend-visible timestamps.
"""

from __future__ import annotations

from datetime import datetime


def local_now() -> datetime:
    """Return the current time in the host machine's local timezone."""
    return datetime.now().astimezone()


def local_now_naive() -> datetime:
    """Return host-local time without tzinfo for MySQL DATETIME columns."""
    return local_now().replace(tzinfo=None)


def mysql_session_time_zone() -> str:
    """Return the current host UTC offset in MySQL '+HH:MM' session format."""
    offset = local_now().utcoffset()
    if offset is None:
        return "+00:00"

    total_minutes = int(offset.total_seconds() // 60)
    sign = "+" if total_minutes >= 0 else "-"
    total_minutes = abs(total_minutes)
    hours, minutes = divmod(total_minutes, 60)
    return f"{sign}{hours:02d}:{minutes:02d}"
